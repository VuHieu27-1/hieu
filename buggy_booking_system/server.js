const fs = require('fs/promises');
const http = require('http');
const https = require('https');
const path = require('path');
const { createLogger } = require('./lib/logger');
const express = require('express');
const cors = require('cors');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
const DEFAULT_DISPATCH_API_URL = 'http://localhost:4001';
const REVERSE_GEOCODE_URL = process.env.REVERSE_GEOCODE_URL || 'https://nominatim.openstreetmap.org/reverse';
const SEARCH_GEOCODE_URL = process.env.SEARCH_GEOCODE_URL || 'https://nominatim.openstreetmap.org/search';
const DISPATCH_API_URL = String(process.env.DISPATCH_API_URL || DEFAULT_DISPATCH_API_URL).trim();
const LOCATION_HTTP_TIMEOUT_MS = Number(process.env.LOCATION_HTTP_TIMEOUT_MS || 15000);
const DISPATCH_HTTP_TIMEOUT_MS = Number(process.env.DISPATCH_HTTP_TIMEOUT_MS || 8000);
const SERVICE_USER_AGENT = 'd-soft-buggy-booking-system/1.1';

const logger = createLogger({
    logDir: LOG_DIR,
    serviceName: 'buggy-booking-system'
});

let bookings = [];
let writeQueue = Promise.resolve();
let bookingQueue = Promise.resolve();
let requestCounter = 0;
let nextBookingSequence = 1;
let pendingBookingJobs = 0;
const MAX_PENDING_BOOKINGS = Number(process.env.MAX_PENDING_BOOKINGS || 200);
const IDEMPOTENCY_TTL_MS = Number(process.env.IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const PENDING_BROADCAST_STATUS = 'PENDING_BROADCAST';
const PENDING_BROADCAST_MESSAGE = '\u0110\u00e3 ph\u00e1t t\u00edn hi\u1ec7u \u0111\u1ebfn c\u00e1c t\u00e0i x\u1ebf g\u1ea7n nh\u1ea5t, \u0111ang ch\u1edd t\u00e0i x\u1ebf nh\u1eadn cu\u1ed1c...';
const idempotencyStore = new Map();

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
    const rawSequence = parts[parts.length - 1];
    const sequence = Number.parseInt(rawSequence, 10);
    return Number.isInteger(sequence) ? sequence : 0;
};

const initializeBookingSequence = () => {
    nextBookingSequence = bookings.reduce((maxSequence, booking) => {
        return Math.max(maxSequence, parseBookingSequence(booking.id));
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

const buildCorruptBookingsBackupPath = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(DATA_DIR, `bookings.corrupt-${stamp}.json`);
};

const loadBookingsFromDisk = async () => {
    const raw = await fs.readFile(BOOKINGS_FILE, 'utf8');
    const trimmed = raw.trim();

    if (!trimmed) {
        await fs.writeFile(BOOKINGS_FILE, '[]', 'utf8');
        logger.warn('Bookings storage file was empty and has been reset.', {
            bookings_file: BOOKINGS_FILE
        });
        return [];
    }

    try {
        const parsed = JSON.parse(trimmed);

        if (!Array.isArray(parsed)) {
            throw new Error('Bookings storage root must be a JSON array.');
        }

        return parsed;
    } catch (error) {
        const backupFile = buildCorruptBookingsBackupPath();
        await fs.copyFile(BOOKINGS_FILE, backupFile);
        await fs.writeFile(BOOKINGS_FILE, '[]', 'utf8');

        logger.warn('Bookings storage file contained invalid JSON and has been recovered.', {
            bookings_file: BOOKINGS_FILE,
            backup_file: backupFile,
            error: error.message
        });

        return [];
    }
};

const ensureStorage = async () => {
    logger.info('Initializing storage directories.', {
        data_dir: DATA_DIR,
        log_dir: LOG_DIR
    });

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOG_DIR, { recursive: true });

    try {
        await fs.access(BOOKINGS_FILE);
        logger.info('Bookings storage file found.', {
            bookings_file: BOOKINGS_FILE
        });
    } catch (error) {
        await fs.writeFile(BOOKINGS_FILE, '[]', 'utf8');
        logger.warn('Bookings storage file was missing and has been created.', {
            bookings_file: BOOKINGS_FILE
        });
    }

    bookings = await loadBookingsFromDisk();
    initializeBookingSequence();

    logger.info('Storage initialized successfully.', {
        bookings_loaded: bookings.length,
        latest_log_file: logger.getLatestLogPath(),
        next_booking_sequence: nextBookingSequence
    });
};

const persistBookings = async () => {
    logger.debug('Persisting bookings to disk.', {
        bookings_count: bookings.length
    });

    writeQueue = writeQueue.then(async () => {
        const tempFile = `${BOOKINGS_FILE}.tmp`;
        await fs.writeFile(tempFile, JSON.stringify(bookings, null, 2), 'utf8');
        await fs.rename(tempFile, BOOKINGS_FILE);
    });

    await writeQueue;

    logger.info('Bookings persisted to disk.', {
        bookings_file: BOOKINGS_FILE,
        bookings_count: bookings.length
    });
};

const generateBookingId = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(nextBookingSequence).padStart(4, '0');
    nextBookingSequence += 1;
    return `BK-${stamp}-${sequence}`;
};

const sanitizeString = (value) => String(value || '').trim();

const joinUniqueAddressParts = (parts = []) => {
    const values = parts
        .map((part) => sanitizeString(part))
        .filter(Boolean);

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

const createBookingRecord = (normalized) => ({
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
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    pickupTime: normalized.pickupTime,
    createdAt: new Date().toISOString()
});

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
        bookings.push(booking);
        await persistBookings();

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

    return {
        taskId,
        status,
        message
    };
};

const createDispatchBooking = async (payload, meta = {}) => {
    try {
        const response = await postJson(buildDispatchEndpoint('/api/bookings'), payload, {
            ...meta,
            category: 'dispatch',
            action: 'create_booking'
        });

        let parsed;
        try {
            parsed = JSON.parse(response.body);
        } catch (error) {
            throw new Error('Dispatch server returned invalid JSON.');
        }

        return normalizeDispatchAcceptedResponse(parsed);
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
        driver: dispatchState.driver && typeof dispatchState.driver === 'object'
            ? dispatchState.driver
            : null
    };
};

const getIdempotentBookingResponse = (idempotencyKey) => {
    cleanupExpiredIdempotencyKeys();
    const entry = idempotencyStore.get(idempotencyKey);

    if (!entry) {
        return null;
    }

    return entry.promise;
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
                    duration_ms: durationMs,
                    response_body: responseBody
                });

                return resolve({
                    ok: true,
                    status: response.statusCode,
                    body: responseBody
                });
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
            return reject(error);
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
        address.amenity
        || address.building
        || address.tourism
        || address.attraction
        || address.hotel
        || address.resort
        || address.shop
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

const reverseGeocodeWithNominatim = async (latitude, longitude, language = 'vi,en') => {
    const targetUrl = new URL(REVERSE_GEOCODE_URL);
    targetUrl.searchParams.set('format', 'jsonv2');
    targetUrl.searchParams.set('lat', String(latitude));
    targetUrl.searchParams.set('lon', String(longitude));
    targetUrl.searchParams.set('zoom', '20');
    targetUrl.searchParams.set('addressdetails', '1');

    const response = await getJson(targetUrl.toString(), {
        category: 'location',
        action: 'reverse_geocode',
        accept_language: language
    });

    return normalizeNominatimReverseGeocode(response.body, latitude, longitude);
};

const normalizeNominatimSearchResult = (payload) => {
    const result = Array.isArray(payload) ? payload[0] : null;

    if (!result) {
        throw new Error('No matching address found.');
    }

    const latitude = Number.parseFloat(result.lat);
    const longitude = Number.parseFloat(result.lon);
    const address = result.address || {};
    const roadName = sanitizeString(address.road || address.pedestrian || address.footway || address.cycleway);
    const streetNumber = sanitizeString(address.house_number);
    const displayAddress = sanitizeString(result.display_name);
    const shortAddress = joinUniqueAddressParts([
        joinUniqueAddressParts([streetNumber, roadName]),
        address.neighbourhood,
        address.suburb,
        address.city_district,
        address.city
    ]) || displayAddress;

    return {
        provider: 'nominatim_search',
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        road_name: roadName || null,
        street_number: streetNumber || null,
        short_address: shortAddress || null,
        display_address: displayAddress || shortAddress || null,
        full_address: displayAddress || shortAddress || null,
        raw: result
    };
};

const searchAddressWithNominatim = async (query, language = 'vi,en') => {
    const targetUrl = new URL(SEARCH_GEOCODE_URL);
    targetUrl.searchParams.set('format', 'jsonv2');
    targetUrl.searchParams.set('q', query);
    targetUrl.searchParams.set('limit', '1');
    targetUrl.searchParams.set('addressdetails', '1');

    const response = await getJson(targetUrl.toString(), {
        category: 'location',
        action: 'forward_geocode',
        accept_language: language
    });

    return normalizeNominatimSearchResult(response.body);
};

const reverseGeocodeCoordinates = async (latitude, longitude, language = 'vi,en') => {
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

    const pickupDate = normalized.bookingType === 'SCHEDULED'
        ? new Date(normalized.scheduledTime)
        : new Date();
    const startDate = new Date(pickupDate);
    const endDate = new Date(pickupDate.getTime() + (30 * 60 * 1000));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(pickupDate.getTime())) {
        return { valid: false, message: 'Scheduled time is invalid.' };
    }

    if (endDate <= startDate) {
        return { valid: false, message: 'End time must be later than start time.' };
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

app.get('/', (req, res) => {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/booking.html', (req, res) => {
    return res.sendFile(path.join(PUBLIC_DIR, 'booking.html'));
});

app.get('/status.html', (req, res) => {
    return res.sendFile(path.join(PUBLIC_DIR, 'status.html'));
});

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
        return res.json({
            success: true,
            data
        });
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

    if (query.length < 3) {
        return res.status(400).json({
            success: false,
            message: 'Search query must be at least 3 characters.'
        });
    }

    try {
        const data = await searchAddressWithNominatim(query, language);
        return res.json({
            success: true,
            data
        });
    } catch (error) {
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

app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'Booking gateway is running.',
        data: {
            service: 'buggy-booking-system',
            uptime_seconds: Math.round(process.uptime()),
            bookings_count: bookings.length,
            dispatch_api_url: DISPATCH_API_URL,
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

    const history = bookings
        .filter((item) => item.phone === phone)
        .sort((left, right) => {
            const rightCreatedAt = right.createdAt || right.created_at || 0;
            const leftCreatedAt = left.createdAt || left.created_at || 0;
            return new Date(rightCreatedAt) - new Date(leftCreatedAt);
        })
        .slice(0, limit);

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
    const booking = bookings.find((item) => item.id === req.params.id || item.taskId === req.params.id);

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
            responseBooking = mergeBookingWithDispatchState(booking, dispatchState);
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
            dispatch_api_url: DISPATCH_API_URL
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
