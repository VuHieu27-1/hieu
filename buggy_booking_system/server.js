const fs = require('fs/promises');
const http = require('http');
const https = require('https');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const cors = require('cors');
const { createLogger } = require('./lib/logger');
const { loadConfig } = require('./config');

const appConfig = loadConfig();

const app = express();
const CONFIG_FILE = appConfig.configFile;
const DEFAULT_PORT = appConfig.server.port;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_FILE = appConfig.storage.databaseFile;
const DATA_DIR = path.dirname(DATABASE_FILE);
const LOG_DIR = appConfig.storage.logDir;
const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
const RAW_DISPATCH_API_URL = appConfig.dispatch.rawBaseUrl;
const DISPATCH_API_URL = appConfig.dispatch.baseUrl;
const GEOCODING_PROVIDER = appConfig.geocoding.provider;
const RAW_GEOCODING_PROVIDER = appConfig.geocoding.requestedProvider;
const GEOCODING_LANGUAGE = appConfig.geocoding.language;
const GEOCODING_COUNTRY = appConfig.geocoding.country;
const REVERSE_GEOCODE_URL = appConfig.geocoding.reverseGeocodeUrl;
const SEARCH_GEOCODE_URL = appConfig.geocoding.searchGeocodeUrl;
const MAPBOX_ACCESS_TOKEN = appConfig.geocoding.mapbox.accessToken;
const MAPBOX_FORWARD_GEOCODE_URL = appConfig.geocoding.mapbox.forwardGeocodeUrl;
const MAPBOX_REVERSE_GEOCODE_URL = appConfig.geocoding.mapbox.reverseGeocodeUrl;
const MAPBOX_TYPES = appConfig.geocoding.mapbox.types;
const LOCATION_HTTP_TIMEOUT_MS = appConfig.http.locationTimeoutMs;
const DISPATCH_HTTP_TIMEOUT_MS = appConfig.http.dispatchTimeoutMs;
const MAX_PENDING_BOOKINGS = appConfig.booking.maxPendingBookings;
const IDEMPOTENCY_TTL_MS = appConfig.booking.idempotencyTtlMs;
const SERVICE_USER_AGENT = 'd-soft-buggy-booking-system/1.2';
const PENDING_BROADCAST_STATUS = 'PENDING_BROADCAST';
const PENDING_BROADCAST_MESSAGE = 'Đã phát tín hiệu đến các tài xế gần nhất, đang chờ tài xế nhận cuốc...';

const logger = createLogger({
    logDir: LOG_DIR,
    serviceName: 'buggy-booking-system'
});

if (RAW_DISPATCH_API_URL !== DISPATCH_API_URL) {
    logger.warn('Dispatch API URL was rewritten for container networking.', {
        original_url: RAW_DISPATCH_API_URL,
        normalized_url: DISPATCH_API_URL
    });
}

if (RAW_GEOCODING_PROVIDER !== GEOCODING_PROVIDER) {
    logger.warn('Geocoding provider fallback was applied.', {
        requested_provider: RAW_GEOCODING_PROVIDER,
        effective_provider: GEOCODING_PROVIDER
    });
}

let db;
let requestCounter = 0;
let nextBookingSequence = 1;
let pendingBookingJobs = 0;
let bookingQueue = Promise.resolve();
const idempotencyStore = new Map();
const locationResponseCache = new Map();
let locationProviderBackoffUntil = 0;
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCATION_PROVIDER_BACKOFF_MS = 15 * 1000;

const sanitizeString = (value) => String(value || '').trim();

const maskPhone = (phone) => {
    if (!phone || phone.length < 4) {
        return phone;
    }

    return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
};

const summarizeBody = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return body;
    }

    return {
        ...body,
        phone: body.phone ? maskPhone(body.phone) : body.phone
    };
};

const parseBookingSequence = (bookingId) => {
    const parts = String(bookingId || '').split('-');
    const sequence = Number.parseInt(parts[parts.length - 1], 10);
    return Number.isInteger(sequence) ? sequence : 0;
};

const joinUniqueAddressParts = (parts = []) => {
    const values = parts.map((part) => sanitizeString(part)).filter(Boolean);
    return values.filter((part, index) => values.indexOf(part) === index).join(', ');
};

const normalizeIsoDateTime = (value) => {
    const rawValue = sanitizeString(value);

    if (!rawValue) {
        return null;
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeDriver = (driver) => {
    if (!driver || typeof driver !== 'object' || Array.isArray(driver)) {
        return null;
    }

    const name = sanitizeString(driver.name);
    const badgeId = sanitizeString(driver.badgeId || driver.badge_id);

    if (!name && !badgeId) {
        return null;
    }

    return {
        name: name || null,
        badgeId: badgeId || null
    };
};

const normalizeBookingPoint = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }

    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const locationName = sanitizeString(payload.locationName);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return null;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return null;
    }

    if (!locationName) {
        return null;
    }

    return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        locationName
    };
};

const rowToBooking = (row) => {
    if (!row) {
        return null;
    }

    const driver = normalizeDriver({
        name: row.driver_name,
        badgeId: row.driver_badge_id
    });

    return {
        id: row.id,
        taskId: row.task_id || null,
        status: row.status || PENDING_BROADCAST_STATUS,
        statusMessage: row.status_message || PENDING_BROADCAST_MESSAGE,
        guestName: row.guest_name,
        phone: row.phone || null,
        passengerCount: row.passenger_count,
        bookingType: row.booking_type,
        scheduledTime: row.scheduled_time || null,
        pickup: {
            lat: row.pickup_lat,
            lng: row.pickup_lng,
            locationName: row.pickup_location_name
        },
        dropoff: {
            lat: row.dropoff_lat,
            lng: row.dropoff_lng,
            locationName: row.dropoff_location_name
        },
        assignedVehicle: row.assigned_vehicle || null,
        estimatedPickupSeconds: Number.isFinite(Number(row.estimated_pickup_seconds))
            ? Number(row.estimated_pickup_seconds)
            : null,
        driver,
        startTime: row.start_time || null,
        endTime: row.end_time || null,
        pickupTime: row.pickup_time || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

const getDatabase = () => {
    if (!db) {
        throw new Error('Database has not been initialized yet.');
    }

    return db;
};

const getBookingsCount = () => {
    const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM bookings').get();
    return Number(row?.count || 0);
};

const initializeBookingSequence = () => {
    const rows = getDatabase().prepare('SELECT id FROM bookings').all();
    nextBookingSequence = rows.reduce((maxSequence, row) => {
        return Math.max(maxSequence, parseBookingSequence(row.id));
    }, 0) + 1;
};

const cleanupExpiredIdempotencyKeys = () => {
    const now = Date.now();

    for (const [key, entry] of idempotencyStore.entries()) {
        if (entry.expiresAt <= now) {
            idempotencyStore.delete(key);
        }
    }
};

const sanitizeIdempotencyKey = (value) => {
    const key = sanitizeString(value);
    return key || null;
};

const initializeDatabase = async () => {
    await fs.mkdir(path.dirname(DATABASE_FILE), { recursive: true });

    db = new DatabaseSync(DATABASE_FILE);
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            task_id TEXT UNIQUE,
            status TEXT NOT NULL,
            status_message TEXT,
            guest_name TEXT NOT NULL,
            phone TEXT,
            passenger_count INTEGER NOT NULL,
            booking_type TEXT NOT NULL,
            scheduled_time TEXT,
            pickup_lat REAL NOT NULL,
            pickup_lng REAL NOT NULL,
            pickup_location_name TEXT NOT NULL,
            dropoff_lat REAL NOT NULL,
            dropoff_lng REAL NOT NULL,
            dropoff_location_name TEXT NOT NULL,
            assigned_vehicle TEXT,
            estimated_pickup_seconds REAL,
            driver_name TEXT,
            driver_phone TEXT,
            driver_badge_id TEXT,
            start_time TEXT,
            end_time TEXT,
            pickup_time TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_task_id
            ON bookings (task_id);

        CREATE INDEX IF NOT EXISTS idx_bookings_phone_created_at
            ON bookings (phone, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_bookings_created_at
            ON bookings (created_at DESC);
    `);
};

const insertBookingRecord = (booking) => {
    getDatabase().prepare(`
        INSERT INTO bookings (
            id, task_id, status, status_message, guest_name, phone, passenger_count, booking_type, scheduled_time,
            pickup_lat, pickup_lng, pickup_location_name,
            dropoff_lat, dropoff_lng, dropoff_location_name,
            assigned_vehicle, estimated_pickup_seconds,
            driver_name, driver_phone, driver_badge_id,
            start_time, end_time, pickup_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        booking.id,
        booking.taskId,
        booking.status,
        booking.statusMessage,
        booking.guestName,
        booking.phone,
        booking.passengerCount,
        booking.bookingType,
        booking.scheduledTime,
        booking.pickup.lat,
        booking.pickup.lng,
        booking.pickup.locationName,
        booking.dropoff.lat,
        booking.dropoff.lng,
        booking.dropoff.locationName,
        booking.assignedVehicle || null,
        booking.estimatedPickupSeconds,
        booking.driver?.name || null,
        booking.driver?.phone || null,
        booking.driver?.badgeId || null,
        booking.startTime,
        booking.endTime,
        booking.pickupTime,
        booking.createdAt,
        booking.updatedAt
    );
};

const ensureStorage = async () => {
    logger.info('Initializing storage directories.', {
        data_dir: DATA_DIR,
        log_dir: LOG_DIR,
        database_file: DATABASE_FILE
    });

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOG_DIR, { recursive: true });
    await initializeDatabase();
    initializeBookingSequence();

    logger.info('Storage initialized successfully.', {
        bookings_loaded: getBookingsCount(),
        latest_log_file: logger.getLatestLogPath(),
        next_booking_sequence: nextBookingSequence,
        config_file: CONFIG_FILE,
        database_file: DATABASE_FILE
    });
};

const generateBookingId = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(nextBookingSequence).padStart(4, '0');
    nextBookingSequence += 1;
    return `BK-${stamp}-${sequence}`;
};

const createBookingRecord = (normalized) => {
    const timestamp = new Date().toISOString();

    return {
        id: generateBookingId(),
        taskId: normalized.taskId || null,
        status: normalized.status || PENDING_BROADCAST_STATUS,
        statusMessage: normalized.statusMessage || PENDING_BROADCAST_MESSAGE,
        guestName: normalized.guestName,
        phone: normalized.phone || null,
        passengerCount: normalized.passengerCount || 1,
        bookingType: normalized.bookingType || 'NOW',
        scheduledTime: normalized.scheduledTime || null,
        pickup: normalized.pickup,
        dropoff: normalized.dropoff,
        assignedVehicle: normalized.assignedVehicle || null,
        estimatedPickupSeconds: Number.isFinite(Number(normalized.estimatedPickupSeconds))
            ? Number(normalized.estimatedPickupSeconds)
            : null,
        driver: normalizeDriver(normalized.driver),
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        pickupTime: normalized.pickupTime,
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

const enqueueBookingTask = async (task) => {
    if (pendingBookingJobs >= MAX_PENDING_BOOKINGS) {
        const error = new Error('Booking queue is full. Please try again in a moment.');
        error.code = 'BOOKING_QUEUE_FULL';
        throw error;
    }

    pendingBookingJobs += 1;

    const runTask = bookingQueue.then(() => task());
    bookingQueue = runTask.catch(() => {});

    try {
        return await runTask;
    } finally {
        pendingBookingJobs -= 1;
    }
};

const createBookingSafely = async (normalizedBooking, meta = {}, overrides = {}) => {
    return enqueueBookingTask(async () => {
        const booking = createBookingRecord({
            ...normalizedBooking,
            ...overrides
        });

        insertBookingRecord(booking);

        logger.info('Booking saved locally.', {
            request_id: meta.request_id,
            booking_id: booking.id,
            queue_depth: pendingBookingJobs,
            customer_name: booking.guestName,
            passenger_count: booking.passengerCount
        });

        return booking;
    });
};

const buildAsyncBookingAcceptedResponse = (booking) => ({
    taskId: booking.taskId,
    status: booking.status || PENDING_BROADCAST_STATUS,
    message: booking.statusMessage || PENDING_BROADCAST_MESSAGE
});

const buildDispatchEndpoint = (pathName) => {
    const baseUrl = DISPATCH_API_URL.endsWith('/')
        ? DISPATCH_API_URL
        : `${DISPATCH_API_URL}/`;

    return new URL(String(pathName || '').replace(/^\/+/, ''), baseUrl).toString();
};

const normalizeDispatchAcceptedResponse = (payload) => {
    const taskId = sanitizeString(payload?.taskId);
    const status = sanitizeString(payload?.status || PENDING_BROADCAST_STATUS);
    const message = sanitizeString(payload?.message || PENDING_BROADCAST_MESSAGE);

    if (!taskId || !status) {
        throw new Error('Dispatch server returned an invalid acceptance response.');
    }

    return { taskId, status, message };
};

const mergeBookingWithDispatchState = (booking, dispatchState) => {
    if (!dispatchState) {
        return booking;
    }

    return {
        ...booking,
        status: sanitizeString(dispatchState.status) || booking.status,
        statusMessage: sanitizeString(dispatchState.message) || booking.statusMessage,
        assignedVehicle: sanitizeString(dispatchState.assignedVehicle) || null,
        estimatedPickupSeconds: Number.isFinite(Number(dispatchState.estimatedPickupSeconds))
            ? Number(dispatchState.estimatedPickupSeconds)
            : null,
        driver: normalizeDriver(dispatchState.driver)
    };
};

const findBookingById = (bookingId) => {
    const row = getDatabase().prepare('SELECT * FROM bookings WHERE id = ? LIMIT 1').get(bookingId);
    return rowToBooking(row);
};

const findBookingByLookupId = (lookupId) => {
    const row = getDatabase().prepare(`
        SELECT *
        FROM bookings
        WHERE id = ? OR task_id = ?
        LIMIT 1
    `).get(lookupId, lookupId);

    return rowToBooking(row);
};

const getBookingHistoryByPhone = (phone, limit) => {
    const rows = getDatabase().prepare(`
        SELECT *
        FROM bookings
        WHERE phone = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
    `).all(phone, limit);

    return rows.map(rowToBooking);
};

const updateBookingDispatchState = (bookingId, dispatchState) => {
    const currentBooking = findBookingById(bookingId);

    if (!currentBooking) {
        return null;
    }

    const merged = mergeBookingWithDispatchState(currentBooking, dispatchState);
    const updatedAt = new Date().toISOString();

    getDatabase().prepare(`
        UPDATE bookings
        SET status = ?,
            status_message = ?,
            assigned_vehicle = ?,
            estimated_pickup_seconds = ?,
            driver_name = ?,
            driver_phone = ?,
            driver_badge_id = ?,
            updated_at = ?
        WHERE id = ?
    `).run(
        merged.status,
        merged.statusMessage,
        merged.assignedVehicle,
        merged.estimatedPickupSeconds,
        merged.driver?.name || null,
        merged.driver?.phone || null,
        merged.driver?.badgeId || null,
        updatedAt,
        bookingId
    );

    return {
        ...merged,
        updatedAt
    };
};

const getIdempotentBookingResponse = (idempotencyKey) => {
    cleanupExpiredIdempotencyKeys();
    const entry = idempotencyStore.get(idempotencyKey);
    return entry ? entry.promise : null;
};

const storeIdempotentBookingResponse = (idempotencyKey, promise) => {
    cleanupExpiredIdempotencyKeys();
    idempotencyStore.set(idempotencyKey, {
        promise,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
    });
};

const postJson = (targetUrl, payload, meta = {}) => new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const startedAt = Date.now();

    logger.debug('Outgoing HTTP request started.', {
        ...meta,
        url: targetUrl,
        method: 'POST',
        payload
    });

    const request = transport.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    }, (response) => {
        let responseBody = '';

        response.on('data', (chunk) => {
            responseBody += chunk;
        });

        response.on('end', () => {
            const durationMs = Date.now() - startedAt;

            if (response.statusCode >= 200 && response.statusCode < 300) {
                logger.info('Outgoing HTTP request completed successfully.', {
                    ...meta,
                    url: targetUrl,
                    status_code: response.statusCode,
                    duration_ms: durationMs
                });

                resolve({
                    ok: true,
                    status: response.statusCode,
                    body: responseBody
                });
                return;
            }

            const error = new Error(`HTTP ${response.statusCode}: ${responseBody || 'Empty response'}`);
            logger.error('Outgoing HTTP request failed.', {
                ...meta,
                url: targetUrl,
                status_code: response.statusCode,
                duration_ms: durationMs,
                response_body: responseBody,
                error: error.message
            });
            reject(error);
        });
    });

    request.setTimeout(DISPATCH_HTTP_TIMEOUT_MS, () => {
        request.destroy(new Error(`Dispatch request timed out after ${DISPATCH_HTTP_TIMEOUT_MS}ms.`));
    });

    request.on('error', (error) => {
        logger.error('Outgoing HTTP request raised a network error.', {
            ...meta,
            url: targetUrl,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        reject(error);
    });

    request.write(body);
    request.end();
});

const getJson = (targetUrl, meta = {}) => new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const startedAt = Date.now();

    logger.debug('Outgoing HTTP request started.', {
        ...meta,
        url: targetUrl,
        method: 'GET'
    });

    const request = transport.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': meta.accept_language || 'vi,en',
            'User-Agent': SERVICE_USER_AGENT
        }
    }, (response) => {
        let responseBody = '';

        response.on('data', (chunk) => {
            responseBody += chunk;
        });

        response.on('end', () => {
            const durationMs = Date.now() - startedAt;

            if (response.statusCode < 200 || response.statusCode >= 300) {
                const error = new Error(`HTTP ${response.statusCode}: ${responseBody || 'Empty response'}`);
                logger.error('Outgoing HTTP request failed.', {
                    ...meta,
                    url: targetUrl,
                    status_code: response.statusCode,
                    duration_ms: durationMs,
                    response_body: responseBody,
                    error: error.message
                });
                reject(error);
                return;
            }

            try {
                const parsedBody = JSON.parse(responseBody);
                logger.info('Outgoing HTTP request completed successfully.', {
                    ...meta,
                    url: targetUrl,
                    status_code: response.statusCode,
                    duration_ms: durationMs
                });
                resolve({
                    ok: true,
                    status: response.statusCode,
                    body: parsedBody
                });
            } catch (error) {
                logger.error('Outgoing HTTP request failed.', {
                    ...meta,
                    url: targetUrl,
                    status_code: response.statusCode,
                    duration_ms: durationMs,
                    response_body: responseBody,
                    error: error.message
                });
                reject(error);
            }
        });
    });

    request.setTimeout(LOCATION_HTTP_TIMEOUT_MS, () => {
        request.destroy(new Error(`Request timed out after ${LOCATION_HTTP_TIMEOUT_MS}ms.`));
    });

    request.on('error', (error) => {
        logger.error('Outgoing HTTP request raised a network error.', {
            ...meta,
            url: targetUrl,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        reject(error);
    });

    request.end();
});

const getCachedLocationJson = async (targetUrl, meta = {}) => {
    const now = Date.now();
    const cachedEntry = locationResponseCache.get(targetUrl);
    if (cachedEntry && (now - cachedEntry.cachedAt) < LOCATION_CACHE_TTL_MS) {
        return cachedEntry.response;
    }

    if (locationProviderBackoffUntil > now) {
        if (cachedEntry) {
            return cachedEntry.response;
        }

        const backoffError = new Error('HTTP 429: Location provider cooldown active.');
        backoffError.code = 'LOCATION_PROVIDER_BACKOFF';
        throw backoffError;
    }

    try {
        const response = await getJson(targetUrl, meta);
        locationResponseCache.set(targetUrl, {
            cachedAt: now,
            response
        });
        return response;
    } catch (error) {
        if (String(error.message || '').startsWith('HTTP 429')) {
            locationProviderBackoffUntil = Date.now() + LOCATION_PROVIDER_BACKOFF_MS;

            if (cachedEntry) {
                logger.warn('Using cached location response after upstream rate limit.', {
                    ...meta,
                    url: targetUrl
                });
                return cachedEntry.response;
            }
        }

        throw error;
    }
};

const createDispatchBooking = async (payload, meta = {}) => {
    try {
        const response = await postJson(buildDispatchEndpoint('/api/bookings'), payload, {
            ...meta,
            category: 'dispatch',
            action: 'create_booking'
        });
        return normalizeDispatchAcceptedResponse(JSON.parse(response.body));
    } catch (error) {
        error.code = error.code || 'DISPATCH_UNAVAILABLE';
        throw error;
    }
};

const fetchDispatchBookingStatus = async (taskId, meta = {}) => {
    const response = await getJson(buildDispatchEndpoint(`/api/bookings/${encodeURIComponent(taskId)}`), {
        ...meta,
        category: 'dispatch',
        action: 'get_booking_status'
    });
    return response.body;
};

const normalizeNominatimReverseGeocode = (payload, latitude, longitude) => {
    const address = payload && payload.address ? payload.address : {};
    const roadName = sanitizeString(address.road || address.pedestrian || address.footway || address.cycleway);
    const streetNumber = sanitizeString(address.house_number);
    const streetLine = joinUniqueAddressParts([streetNumber, roadName]);
    const localityLine = joinUniqueAddressParts([
        address.neighbourhood,
        address.quarter,
        address.suburb,
        address.residential,
        address.city_district,
        address.village,
        address.town,
        address.city
    ]);
    const adminLine = joinUniqueAddressParts([
        address.state_district,
        address.state,
        address.postcode,
        address.country
    ]);
    const placeName = sanitizeString(
        address.amenity || address.building || address.tourism || address.attraction || address.hotel || address.resort || address.shop
    );
    const displayAddress = joinUniqueAddressParts([streetLine, localityLine, adminLine]) || sanitizeString(payload.display_name || payload.name);
    const shortAddress = joinUniqueAddressParts([placeName, streetLine, localityLine]) || displayAddress;
    const fullAddress = sanitizeString(payload.display_name || displayAddress);

    return {
        provider: 'nominatim',
        latitude,
        longitude,
        place_name: placeName || null,
        road_name: roadName || null,
        street_number: streetNumber || null,
        short_address: shortAddress || null,
        display_address: displayAddress || null,
        full_address: fullAddress || null,
        raw: payload
    };
};

const reverseGeocodeWithNominatim = async (latitude, longitude, language = 'vi,en') => {
    const targetUrl = new URL(REVERSE_GEOCODE_URL);
    targetUrl.searchParams.set('format', 'jsonv2');
    targetUrl.searchParams.set('lat', String(latitude));
    targetUrl.searchParams.set('lon', String(longitude));
    targetUrl.searchParams.set('zoom', '20');
    targetUrl.searchParams.set('addressdetails', '1');

    const response = await getCachedLocationJson(targetUrl.toString(), {
        category: 'location',
        action: 'reverse_geocode',
        accept_language: language
    });

    return normalizeNominatimReverseGeocode(response.body, latitude, longitude);
};

const normalizeSingleNominatimSearchResult = (result) => {
    if (!result) {
        return null;
    }

    const latitude = Number.parseFloat(result.lat);
    const longitude = Number.parseFloat(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    const address = result.address || {};
    const roadName = sanitizeString(address.road || address.pedestrian || address.footway || address.cycleway);
    const streetNumber = sanitizeString(address.house_number);
    const displayAddress = sanitizeString(result.display_name);

    return {
        provider: 'nominatim_search',
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        road_name: roadName || null,
        street_number: streetNumber || null,
        short_address: joinUniqueAddressParts([
            joinUniqueAddressParts([streetNumber, roadName]),
            address.neighbourhood,
            address.suburb,
            address.city_district,
            address.city
        ]) || displayAddress,
        display_address: displayAddress || null,
        full_address: displayAddress || null,
        raw: result
    };
};

const normalizeNominatimSearchResults = (payload, limit = 5) => {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 1), 8);
    const results = Array.isArray(payload) ? payload : [];

    return results
        .slice(0, normalizedLimit)
        .map((item) => normalizeSingleNominatimSearchResult(item))
        .filter(Boolean);
};

const normalizeNominatimSearchResult = (payload) => {
    const result = normalizeNominatimSearchResults(payload, 1)[0];

    if (!result) {
        throw new Error('No matching address found.');
    }

    return result;
};

const searchAddressWithNominatim = async (query, language = 'vi,en', limit = 1, options = {}) => {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 1, 1), 8);
    const targetUrl = new URL(SEARCH_GEOCODE_URL);
    targetUrl.searchParams.set('format', 'jsonv2');
    targetUrl.searchParams.set('q', query);
    targetUrl.searchParams.set('limit', String(normalizedLimit));
    targetUrl.searchParams.set('addressdetails', '1');
    if (GEOCODING_COUNTRY) {
        targetUrl.searchParams.set('countrycodes', GEOCODING_COUNTRY);
    }
    if (Number.isFinite(options.proximityLat) && Number.isFinite(options.proximityLng)) {
        targetUrl.searchParams.set('viewbox', [
            Number(options.proximityLng) - 0.1,
            Number(options.proximityLat) + 0.1,
            Number(options.proximityLng) + 0.1,
            Number(options.proximityLat) - 0.1
        ].join(','));
        targetUrl.searchParams.set('bounded', '0');
    }

    const response = await getCachedLocationJson(targetUrl.toString(), {
        category: 'location',
        action: 'forward_geocode',
        accept_language: language
    });

    if (normalizedLimit === 1) {
        return normalizeNominatimSearchResult(response.body);
    }

    const results = normalizeNominatimSearchResults(response.body, normalizedLimit);
    if (results.length === 0) {
        throw new Error('No matching address found.');
    }

    return results;
};

const searchAddress = async (query, language = GEOCODING_LANGUAGE, limit = 1, options = {}) => {
    if (GEOCODING_PROVIDER === 'mapbox') {
        return searchAddressWithMapbox(query, language, limit, options);
    }

    return searchAddressWithNominatim(query, language, limit, options);
};

const buildNormalizedAddressObject = (context = {}, properties = {}) => ({
    neighbourhood: sanitizeString(context?.neighborhood?.name || context?.locality?.name),
    suburb: sanitizeString(context?.district?.name || context?.place?.name),
    city_district: sanitizeString(context?.district?.name),
    city: sanitizeString(context?.place?.name || context?.locality?.name),
    state: sanitizeString(context?.region?.name),
    postcode: sanitizeString(context?.postcode?.name),
    country: sanitizeString(context?.country?.name),
    road: sanitizeString(context?.street?.name || context?.address?.street_name),
    house_number: sanitizeString(context?.address?.address_number || properties?.name?.split(' ')[0])
});

const normalizeSingleMapboxFeature = (feature) => {
    if (!feature || typeof feature !== 'object') {
        return null;
    }

    const properties = feature.properties || {};
    const coordinates = properties.coordinates || {};
    const geometry = feature.geometry || {};
    const longitude = Number.parseFloat(coordinates.longitude ?? geometry.coordinates?.[0]);
    const latitude = Number.parseFloat(coordinates.latitude ?? geometry.coordinates?.[1]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    const context = properties.context || {};
    const address = buildNormalizedAddressObject(context, properties);
    const roadName = sanitizeString(address.road || properties.name);
    const streetNumber = sanitizeString(address.house_number);
    const fullAddress = sanitizeString(properties.full_address || joinUniqueAddressParts([properties.name, properties.place_formatted]));
    const shortAddress = joinUniqueAddressParts([
        sanitizeString(properties.name),
        address.neighbourhood,
        address.city_district,
        address.city
    ]) || fullAddress;

    return {
        provider: 'mapbox',
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        place_name: sanitizeString(properties.name_preferred || properties.name),
        road_name: roadName || null,
        street_number: streetNumber || null,
        short_address: shortAddress || null,
        display_address: fullAddress || null,
        full_address: fullAddress || null,
        address,
        raw: feature
    };
};

const reverseGeocodeWithMapbox = async (latitude, longitude, language = GEOCODING_LANGUAGE) => {
    const targetUrl = new URL(MAPBOX_REVERSE_GEOCODE_URL);
    targetUrl.searchParams.set('longitude', String(longitude));
    targetUrl.searchParams.set('latitude', String(latitude));
    targetUrl.searchParams.set('language', sanitizeString(language) || GEOCODING_LANGUAGE);
    targetUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    targetUrl.searchParams.set('limit', '1');
    if (GEOCODING_COUNTRY) {
        targetUrl.searchParams.set('country', GEOCODING_COUNTRY);
    }
    if (MAPBOX_TYPES) {
        targetUrl.searchParams.set('types', MAPBOX_TYPES);
    }

    const response = await getCachedLocationJson(targetUrl.toString(), {
        category: 'location',
        action: 'reverse_geocode_mapbox',
        accept_language: language
    });

    const features = Array.isArray(response.body?.features) ? response.body.features : [];
    const result = normalizeSingleMapboxFeature(features[0]);
    if (!result) {
        throw new Error('No matching address found.');
    }
    return result;
};

const searchAddressWithMapbox = async (query, language = GEOCODING_LANGUAGE, limit = 1, options = {}) => {
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 1, 1), 8);
    const targetUrl = new URL(MAPBOX_FORWARD_GEOCODE_URL);
    targetUrl.searchParams.set('q', query);
    targetUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    targetUrl.searchParams.set('limit', String(normalizedLimit));
    targetUrl.searchParams.set('language', sanitizeString(language) || GEOCODING_LANGUAGE);
    targetUrl.searchParams.set('autocomplete', 'true');
    if (GEOCODING_COUNTRY) {
        targetUrl.searchParams.set('country', GEOCODING_COUNTRY);
    }
    if (MAPBOX_TYPES) {
        targetUrl.searchParams.set('types', MAPBOX_TYPES);
    }
    if (Number.isFinite(options.proximityLat) && Number.isFinite(options.proximityLng)) {
        targetUrl.searchParams.set('proximity', `${Number(options.proximityLng).toFixed(6)},${Number(options.proximityLat).toFixed(6)}`);
    }

    const response = await getCachedLocationJson(targetUrl.toString(), {
        category: 'location',
        action: 'forward_geocode_mapbox',
        accept_language: language
    });

    const results = (Array.isArray(response.body?.features) ? response.body.features : [])
        .slice(0, normalizedLimit)
        .map((feature) => normalizeSingleMapboxFeature(feature))
        .filter(Boolean);

    if (normalizedLimit === 1) {
        if (!results[0]) {
            throw new Error('No matching address found.');
        }
        return results[0];
    }

    if (!results.length) {
        throw new Error('No matching address found.');
    }

    return results;
};

const reverseGeocodeCoordinates = async (latitude, longitude, language = GEOCODING_LANGUAGE) => {
    if (GEOCODING_PROVIDER === 'mapbox') {
        return reverseGeocodeWithMapbox(latitude, longitude, language);
    }

    return reverseGeocodeWithNominatim(latitude, longitude, language);
};

const validateBooking = (payload) => {
    const normalized = {
        guestName: sanitizeString(payload.guestName),
        phone: sanitizeString(payload.phone),
        passengerCount: Number.parseInt(payload.passengerCount, 10) || 0,
        bookingType: sanitizeString(payload.bookingType || 'NOW').toUpperCase(),
        scheduledTime: normalizeIsoDateTime(payload.scheduledTime),
        pickup: normalizeBookingPoint(payload.pickup),
        dropoff: normalizeBookingPoint(payload.dropoff)
    };

    if (!normalized.guestName || !normalized.pickup || !normalized.dropoff) {
        return { valid: false, message: 'Missing required fields.' };
    }

    if (normalized.phone && !PHONE_REGEX.test(normalized.phone)) {
        return { valid: false, message: 'Phone number format is invalid.' };
    }

    if (!['NOW', 'SCHEDULED'].includes(normalized.bookingType)) {
        return { valid: false, message: 'Booking type is invalid.' };
    }

    if (!Number.isInteger(normalized.passengerCount) || normalized.passengerCount < 1 || normalized.passengerCount > 8) {
        return { valid: false, message: 'Passenger count must be between 1 and 8.' };
    }

    if (normalized.bookingType === 'SCHEDULED' && !normalized.scheduledTime) {
        return { valid: false, message: 'Scheduled time is required for SCHEDULED bookings.' };
    }

    const pickupDate = normalized.bookingType === 'SCHEDULED' ? new Date(normalized.scheduledTime) : new Date();
    const startDate = new Date(pickupDate);
    const endDate = new Date(pickupDate.getTime() + (30 * 60 * 1000));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(pickupDate.getTime())) {
        return { valid: false, message: 'Scheduled time is invalid.' };
    }

    if (normalized.bookingType === 'SCHEDULED' && pickupDate <= new Date()) {
        return { valid: false, message: 'Scheduled time must be in the future.' };
    }

    return {
        valid: true,
        normalizedBooking: {
            guestName: normalized.guestName,
            phone: normalized.phone || null,
            passengerCount: normalized.passengerCount,
            bookingType: normalized.bookingType,
            scheduledTime: normalized.bookingType === 'SCHEDULED' ? pickupDate.toISOString() : null,
            pickup: normalized.pickup,
            dropoff: normalized.dropoff,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            pickupTime: pickupDate.toISOString()
        }
    };
};

const readLatestLogLines = async (limit = 200) => {
    const content = await fs.readFile(logger.getLatestLogPath(), 'utf8');
    return content.split('\n').filter(Boolean).slice(-limit).reverse();
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
    requestCounter += 1;
    const requestId = `req-${String(requestCounter).padStart(6, '0')}`;
    const startedAt = process.hrtime.bigint();
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor || req.socket.remoteAddress || req.ip || 'unknown');

    req.requestId = requestId;

    logger.info('HTTP request started.', {
        request_id: requestId,
        method: req.method,
        url: req.originalUrl,
        client_ip: clientIp,
        query: req.query,
        body: summarizeBody(req.body)
    });

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        logger.info('HTTP request completed.', {
            request_id: requestId,
            method: req.method,
            url: req.originalUrl,
            status_code: res.statusCode,
            duration_ms: Number(durationMs.toFixed(3))
        });
    });

    next();
});

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/booking.html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'booking.html')));
app.get('/status.html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'status.html')));
app.use(express.static(PUBLIC_DIR));

app.get('/api/location/reverse-geocode', async (req, res) => {
    const latitude = Number.parseFloat(req.query.lat);
    const longitude = Number.parseFloat(req.query.lng);
    const language = sanitizeString(req.headers['accept-language']) || 'vi,en';

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({
            success: false,
            message: 'Latitude/longitude is invalid.'
        });
    }

    try {
        const data = await reverseGeocodeCoordinates(Number(latitude.toFixed(6)), Number(longitude.toFixed(6)), language);
        return res.json({ success: true, data });
    } catch (error) {
        logger.error('Reverse geocode lookup failed.', {
            request_id: req.requestId,
            latitude,
            longitude,
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        return res.status(502).json({
            success: false,
            message: 'Unable to map the current device location.'
        });
    }
});

app.get('/api/location/search', async (req, res) => {
    const query = sanitizeString(req.query.q);
    const language = sanitizeString(req.headers['accept-language']) || 'vi,en';
    const proximityLat = Number.parseFloat(req.query.lat);
    const proximityLng = Number.parseFloat(req.query.lng);

    if (query.length < 3) {
        return res.status(400).json({
            success: false,
            message: 'Search query must be at least 3 characters.'
        });
    }

    try {
        const data = await searchAddress(query, language, 1, {
            proximityLat,
            proximityLng
        });
        return res.json({ success: true, data });
    } catch (error) {
        if (error.code === 'LOCATION_PROVIDER_BACKOFF' || String(error.message || '').startsWith('HTTP 429')) {
            logger.warn('Address search lookup skipped because provider is rate limited.', {
                request_id: req.requestId,
                query
            });
            return res.status(503).json({
                success: false,
                message: 'Address lookup is temporarily busy. Please try again in a moment.'
            });
        }

        logger.error('Address search lookup failed.', {
            request_id: req.requestId,
            query,
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        return res.status(502).json({
            success: false,
            message: 'Unable to search for that address right now.'
        });
    }
});

app.get('/api/location/suggest', async (req, res) => {
    const query = sanitizeString(req.query.q);
    const language = sanitizeString(req.headers['accept-language']) || 'vi,en';
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 5);
    const proximityLat = Number.parseFloat(req.query.lat);
    const proximityLng = Number.parseFloat(req.query.lng);

    if (query.length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Suggestion query must be at least 2 characters.'
        });
    }

    try {
        const data = await searchAddress(query, language, limit, {
            proximityLat,
            proximityLng
        });
        return res.json({ success: true, data: Array.isArray(data) ? data : [data] });
    } catch (error) {
        if (error.code === 'LOCATION_PROVIDER_BACKOFF' || String(error.message || '').startsWith('HTTP 429')) {
            logger.warn('Address suggestion lookup skipped because provider is rate limited.', {
                request_id: req.requestId,
                query,
                limit
            });
            return res.json({
                success: true,
                data: []
            });
        }

        if (error.message === 'No matching address found.') {
            return res.json({
                success: true,
                data: []
            });
        }

        logger.error('Address suggestion lookup failed.', {
            request_id: req.requestId,
            query,
            limit,
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        return res.status(502).json({
            success: false,
            message: 'Unable to load address suggestions right now.'
        });
    }
});

app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'Booking gateway is running.',
        data: {
            service: 'buggy-booking-system',
            uptime_seconds: Math.round(process.uptime()),
            bookings_count: getBookingsCount(),
            config_file: CONFIG_FILE,
            dispatch_api_url: DISPATCH_API_URL,
            geocoding_provider: GEOCODING_PROVIDER,
            database_file: DATABASE_FILE,
            latest_log_file: logger.getLatestLogPath(),
            log_directory: logger.getLogDir()
        }
    });
});

app.get('/api/system/logs', async (req, res) => {
    try {
        const lines = await readLatestLogLines(200);
        return res.json({
            success: true,
            data: {
                count: lines.length,
                latest_log_file: logger.getLatestLogPath(),
                entries: lines
            }
        });
    } catch (error) {
        logger.error('Failed to read system logs.', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to read system logs.'
        });
    }
});

app.post('/api/bookings', async (req, res) => {
    const validation = validateBooking(req.body || {});
    const idempotencyKey = sanitizeIdempotencyKey(req.headers['idempotency-key'] || req.body?.client_request_id);

    if (!validation.valid) {
        logger.warn('Booking validation failed.', {
            request_id: req.requestId,
            message: validation.message,
            body: summarizeBody(req.body)
        });

        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    try {
        if (idempotencyKey) {
            const existingResponse = getIdempotentBookingResponse(idempotencyKey);

            if (existingResponse) {
                logger.info('Idempotent booking request reused existing result.', {
                    request_id: req.requestId,
                    idempotency_key: idempotencyKey
                });

                const responsePayload = await existingResponse;
                return res.status(responsePayload.status).json(responsePayload.body);
            }
        }

        const bookingPromise = (async () => {
            const dispatchAccepted = await createDispatchBooking(req.body || {}, {
                request_id: req.requestId
            });

            const booking = await createBookingSafely(validation.normalizedBooking, {
                request_id: req.requestId
            }, {
                taskId: dispatchAccepted.taskId,
                status: dispatchAccepted.status,
                statusMessage: dispatchAccepted.message
            });

            logger.info('Booking task accepted for asynchronous broadcast.', {
                request_id: req.requestId,
                booking_id: booking.id,
                task_id: booking.taskId,
                customer_name: booking.guestName,
                passenger_count: booking.passengerCount
            });

            return {
                status: 202,
                body: buildAsyncBookingAcceptedResponse(booking)
            };
        })();

        if (idempotencyKey) {
            storeIdempotentBookingResponse(idempotencyKey, bookingPromise);
        }

        const responsePayload = await bookingPromise;
        return res.status(responsePayload.status).json(responsePayload.body);
    } catch (error) {
        logger.error('Booking processing failed.', {
            request_id: req.requestId,
            booking_id: null,
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        const statusCode = error.code === 'BOOKING_QUEUE_FULL'
            ? 503
            : error.code === 'DISPATCH_UNAVAILABLE'
                ? 502
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

app.get('/api/bookings', (req, res) => {
    const phone = sanitizeString(req.query.phone);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 20);

    if (!phone) {
        logger.warn('Booking history lookup failed. Phone is required.', {
            request_id: req.requestId
        });

        return res.status(400).json({
            success: false,
            message: 'Phone number is required to load booking history.'
        });
    }

    if (!PHONE_REGEX.test(phone)) {
        logger.warn('Booking history lookup failed. Phone format is invalid.', {
            request_id: req.requestId,
            phone: maskPhone(phone)
        });

        return res.status(400).json({
            success: false,
            message: 'Phone number format is invalid.'
        });
    }

    const history = getBookingHistoryByPhone(phone, limit);

    logger.info('Booking history lookup succeeded.', {
        request_id: req.requestId,
        phone: maskPhone(phone),
        results: history.length,
        limit
    });

    return res.json({
        success: true,
        data: {
            phone,
            count: history.length,
            bookings: history
        }
    });
});

app.get('/api/bookings/:id', async (req, res) => {
    const booking = findBookingByLookupId(req.params.id);

    if (!booking) {
        logger.warn('Booking lookup failed. Booking not found.', {
            request_id: req.requestId,
            booking_lookup_id: req.params.id
        });

        return res.status(404).json({
            success: false,
            message: 'Booking not found.'
        });
    }

    let responseBooking = booking;

    if (booking.taskId) {
        try {
            const dispatchState = await fetchDispatchBookingStatus(booking.taskId, {
                request_id: req.requestId
            });
            responseBooking = updateBookingDispatchState(booking.id, dispatchState) || mergeBookingWithDispatchState(booking, dispatchState);
        } catch (error) {
            logger.warn('Booking lookup could not refresh dispatch state. Falling back to local data.', {
                request_id: req.requestId,
                booking_lookup_id: req.params.id,
                booking_id: booking.id,
                task_id: booking.taskId,
                error: error.message
            });
        }
    }

    logger.info('Booking lookup succeeded.', {
        request_id: req.requestId,
        booking_lookup_id: req.params.id,
        booking_id: booking.id,
        task_id: booking.taskId
    });

    return res.json({
        success: true,
        data: responseBooking
    });
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        logger.warn('Unknown API endpoint requested.', {
            request_id: req.requestId,
            path: req.path
        });

        return res.status(404).json({
            success: false,
            message: 'API endpoint not found.'
        });
    }

    return res.sendFile(path.join(PUBLIC_DIR, 'booking.html'));
});

const startServer = (port) => {
    const server = app.listen(port);

    server.on('listening', () => {
        const address = server.address();
        const activePort = typeof address === 'object' && address ? address.port : port;

        logger.info('Server is listening.', {
            port: activePort,
            root_url: `http://localhost:${activePort}/`,
            booking_page_url: `http://localhost:${activePort}/booking.html`,
            booking_status_url: `http://localhost:${activePort}/status.html`,
            health_check_url: `http://localhost:${activePort}/api/health`,
            system_logs_url: `http://localhost:${activePort}/api/system/logs`,
            config_file: CONFIG_FILE,
            dispatch_api_url: DISPATCH_API_URL,
            database_file: DATABASE_FILE
        });

        if (activePort !== DEFAULT_PORT) {
            logger.warn('Default port was busy; server started on the next available port.', {
                requested_port: DEFAULT_PORT,
                active_port: activePort
            });
        }
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            logger.warn('Port is already in use. Retrying on the next port.', {
                port,
                next_port: nextPort
            });
            return startServer(nextPort);
        }

        logger.error('Server failed to start.', error);
        process.exit(1);
    });
};

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception detected.', error);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection detected.', {
        reason
    });
});

ensureStorage()
    .then(() => {
        startServer(DEFAULT_PORT);
    })
    .catch((error) => {
        logger.error('Failed to initialize booking server.', error);
        process.exit(1);
    });
