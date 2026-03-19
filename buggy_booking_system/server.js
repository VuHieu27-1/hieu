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
const RAW_THINGSBOARD_URL = process.env.THINGSBOARD_URL || 'https://eu.thingsboard.cloud/entities/devices/all';
const THINGSBOARD_ACCESS_TOKEN = process.env.THINGSBOARD_ACCESS_TOKEN || '7rvm1WzxLQz8c3cKdEU0';

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
const idempotencyStore = new Map();
let lastThingsBoardSync = {
    success: false,
    at: null,
    message: 'No ThingsBoard sync attempts yet.'
};

const normalizeThingsBoardBaseUrl = (rawUrl) => {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}`;
};

const THINGSBOARD_URL = normalizeThingsBoardBaseUrl(RAW_THINGSBOARD_URL);

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

const setLastThingsBoardSync = (success, message, details = {}) => {
    lastThingsBoardSync = {
        success,
        at: new Date().toISOString(),
        message,
        ...details
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

    const raw = await fs.readFile(BOOKINGS_FILE, 'utf8');
    bookings = JSON.parse(raw);
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

const buildInitialBookingStatus = () => ({
    code: 'pending_dispatch',
    label: 'Pending dispatch',
    eta_minutes: null,
    vehicle_plate: null,
    can_change_pickup: true,
    can_cancel: true,
    updated_at: new Date().toISOString()
});

const createBookingRecord = (normalized) => ({
    id: generateBookingId(),
    name: normalized.name,
    phone: normalized.phone,
    start_time: normalized.start_time,
    end_time: normalized.end_time,
    pickup_time: normalized.pickup_time || normalized.start_time,
    pickup_time_mode: normalized.pickup_time_mode || 'now',
    passenger_count: normalized.passenger_count || 1,
    pickup_area: normalized.pickup_area || null,
    dropoff_point: normalized.dropoff_point || null,
    booking_status: buildInitialBookingStatus(),
    created_at: new Date().toISOString(),
    sync_status: 'pending',
    sync_error: null
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

const createBookingSafely = async (normalizedBooking, meta = {}) => {
    return enqueueBookingTask(async () => {
        const booking = createBookingRecord(normalizedBooking);
        bookings.push(booking);
        await persistBookings();

        logger.info('Booking saved locally.', {
            request_id: meta.request_id,
            booking_id: booking.id,
            queue_depth: pendingBookingJobs,
            customer_name: booking.name,
            passenger_count: booking.passenger_count
        });

        return booking;
    });
};

const updateBookingSyncStatus = async (bookingId, syncStatus, syncError = null) => {
    const booking = bookings.find((item) => item.id === bookingId);

    if (!booking) {
        return null;
    }

    booking.sync_status = syncStatus;
    booking.sync_error = syncError;
    booking.synced_at = syncStatus === 'synced' ? new Date().toISOString() : null;
    await persistBookings();

    return booking;
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

    request.setTimeout(30000, () => {
        request.destroy(new Error('Request timed out after 10 seconds.'));
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

const buildThingsBoardEndpoint = (pathName) => new URL(pathName, THINGSBOARD_URL).toString();

const verifyThingsBoardConnection = async () => {
    const startupTelemetryUrl = buildThingsBoardEndpoint(`/api/v1/${THINGSBOARD_ACCESS_TOKEN}/telemetry`);
    const startupPayload = {
        ts: Date.now(),
        values: {
            server_boot_check: 1,
            server_boot_time: new Date().toISOString(),
            source: 'buggy-booking-system'
        }
    };

    const response = await postJson(startupTelemetryUrl, startupPayload, {
        category: 'thingsboard',
        action: 'startup_check'
    });

    const successMessage = 'ThingsBoard startup connection verified successfully.';
    setLastThingsBoardSync(true, successMessage, {
        telemetry_url: startupTelemetryUrl,
        telemetry_status: response.status
    });

    logger.info(successMessage, {
        category: 'thingsboard',
        telemetry_url: startupTelemetryUrl,
        telemetry_status: response.status
    });
};

const buildThingsBoardPayload = (booking) => ({
    ts: Date.now(),
    values: {
        booking_id: booking.id,
        customer_name: booking.name,
        phone: booking.phone,
        start_time: booking.start_time,
        end_time: booking.end_time,
        pickup_time: booking.pickup_time || booking.start_time,
        pickup_time_mode: booking.pickup_time_mode || 'now',
        passenger_count: booking.passenger_count || 1,
        pickup_area: booking.pickup_area || '',
        dropoff_point: booking.dropoff_point || '',
        created_at: booking.created_at,
        booking_created: 1
    }
});

const sendBookingToThingsBoard = async (booking) => {
    const telemetryUrl = buildThingsBoardEndpoint(`/api/v1/${THINGSBOARD_ACCESS_TOKEN}/telemetry`);
    const attributesUrl = buildThingsBoardEndpoint(`/api/v1/${THINGSBOARD_ACCESS_TOKEN}/attributes`);

    const telemetryPayload = buildThingsBoardPayload(booking);
    const attributePayload = {
        last_booking_id: booking.id,
        last_customer_name: booking.name,
        last_passenger_count: booking.passenger_count || 1,
        last_pickup_area: booking.pickup_area || '',
        last_dropoff_point: booking.dropoff_point || '',
        last_booking_created_at: booking.created_at
    };

    const [telemetryResponse, attributesResponse] = await Promise.all([
        postJson(telemetryUrl, telemetryPayload, {
            category: 'thingsboard',
            action: 'booking_telemetry',
            booking_id: booking.id
        }),
        postJson(attributesUrl, attributePayload, {
            category: 'thingsboard',
            action: 'booking_attributes',
            booking_id: booking.id
        })
    ]);

    const successMessage = `ThingsBoard sync success for booking ${booking.id}`;
    setLastThingsBoardSync(true, successMessage, {
        booking_id: booking.id,
        telemetry_url: telemetryUrl,
        telemetry_status: telemetryResponse.status,
        attributes_status: attributesResponse.status
    });

    logger.info(successMessage, {
        category: 'thingsboard',
        booking_id: booking.id,
        telemetry_url: telemetryUrl,
        telemetry_status: telemetryResponse.status,
        attributes_url: attributesUrl,
        attributes_status: attributesResponse.status
    });

    return {
        success: true,
        skipped: false,
        telemetry_url: telemetryUrl,
        telemetry_status: telemetryResponse.status,
        attributes_status: attributesResponse.status
    };
};

const validateBooking = (payload) => {
    const normalized = {
        name: sanitizeString(payload.name),
        phone: sanitizeString(payload.phone),
        pickup_time: sanitizeString(payload.pickup_time),
        pickup_time_mode: sanitizeString(payload.pickup_time_mode || 'now'),
        passenger_count: Number.parseInt(payload.passenger_count, 10) || 0,
        pickup_area: sanitizeString(payload.pickup_area),
        dropoff_point: sanitizeString(payload.dropoff_point)
    };

    if (!normalized.name || !normalized.phone || !normalized.pickup_area || !normalized.dropoff_point || !normalized.pickup_time) {
        return { valid: false, message: 'Missing required fields.' };
    }

    if (!PHONE_REGEX.test(normalized.phone)) {
        return { valid: false, message: 'Phone number format is invalid.' };
    }

    if (!['now', 'scheduled'].includes(normalized.pickup_time_mode)) {
        return { valid: false, message: 'Pickup time mode is invalid.' };
    }

    if (!Number.isInteger(normalized.passenger_count) || normalized.passenger_count < 1 || normalized.passenger_count > 8) {
        return { valid: false, message: 'Passenger count must be between 1 and 8.' };
    }

    const pickupDate = new Date(normalized.pickup_time);
    const startDate = new Date(pickupDate);
    const endDate = new Date(pickupDate.getTime() + (30 * 60 * 1000));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(pickupDate.getTime())) {
        return { valid: false, message: 'Pickup time is invalid.' };
    }

    if (endDate <= startDate) {
        return { valid: false, message: 'End time must be later than start time.' };
    }

    if (normalized.pickup_time_mode === 'scheduled' && pickupDate <= new Date()) {
        return { valid: false, message: 'Scheduled pickup time must be in the future.' };
    }

    return {
        valid: true,
        normalizedBooking: {
            name: normalized.name,
            phone: normalized.phone,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            pickup_time: pickupDate.toISOString(),
            pickup_time_mode: normalized.pickup_time_mode,
            passenger_count: normalized.passenger_count,
            pickup_area: normalized.pickup_area || null,
            dropoff_point: normalized.dropoff_point || null
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

app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'Server is running',
        data: {
            uptime_seconds: Math.round(process.uptime()),
            bookings_count: bookings.length,
            thingsboard_url: THINGSBOARD_URL,
            latest_log_file: logger.getLatestLogPath(),
            log_directory: logger.getLogDir(),
            last_thingsboard_sync: lastThingsBoardSync
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

app.get('/api/thingsboard/logs', async (req, res) => {
    try {
        const lines = await readLatestLogLines(200);
        const entries = lines.filter((line) => line.toLowerCase().includes('thingsboard'));

        return res.json({
            success: true,
            data: {
                last_sync: lastThingsBoardSync,
                count: entries.length,
                entries
            }
        });
    } catch (error) {
        logger.error('Failed to read ThingsBoard logs.', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to read ThingsBoard logs.'
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
            const booking = await createBookingSafely(validation.normalizedBooking, {
                request_id: req.requestId
            });

            try {
                const thingsboardResult = await sendBookingToThingsBoard(booking);
                await updateBookingSyncStatus(booking.id, 'synced', null);

                logger.info('Booking created and synced successfully.', {
                    request_id: req.requestId,
                    booking_id: booking.id,
                    customer_name: booking.name,
                    passenger_count: booking.passenger_count
                });

                return {
                    status: 201,
                    body: {
                        success: true,
                        message: 'Booking created and synced to ThingsBoard',
                        data: {
                            ...booking,
                            sync_status: 'synced',
                            sync_error: null
                        },
                        integrations: {
                            thingsboard: {
                                success: true,
                                message: 'ThingsBoard accepted the booking.',
                                telemetry_url: thingsboardResult.telemetry_url,
                                telemetry_status: thingsboardResult.telemetry_status,
                                attributes_status: thingsboardResult.attributes_status
                            }
                        }
                    }
                };
            } catch (error) {
                await updateBookingSyncStatus(booking.id, 'sync_failed', error.message);
                setLastThingsBoardSync(false, error.message, {
                    booking_id: booking.id
                });

                logger.error('Booking sync failed after local save.', {
                    request_id: req.requestId,
                    booking_id: booking.id,
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });

                return {
                    status: 202,
                    body: {
                        success: true,
                        message: 'Booking saved locally, but ThingsBoard sync failed. Retry sync later.',
                        data: {
                            ...booking,
                            sync_status: 'sync_failed',
                            sync_error: error.message
                        },
                        integrations: {
                            thingsboard: {
                                success: false,
                                message: error.message
                            }
                        }
                    }
                };
            }
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

        const statusCode = error.code === 'BOOKING_QUEUE_FULL' ? 503 : 500;
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
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
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

app.get('/api/bookings/:id', (req, res) => {
    const booking = bookings.find((item) => item.id === req.params.id);

    if (!booking) {
        logger.warn('Booking lookup failed. Booking not found.', {
            request_id: req.requestId,
            booking_id: req.params.id
        });

        return res.status(404).json({
            success: false,
            message: 'Booking not found.'
        });
    }

    logger.info('Booking lookup succeeded.', {
        request_id: req.requestId,
        booking_id: req.params.id
    });

    return res.json({
        success: true,
        data: booking
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
            qr_page_url: `http://localhost:${activePort}/`,
            booking_page_url: `http://localhost:${activePort}/booking.html`,
            booking_status_url: `http://localhost:${activePort}/status.html`,
            health_check_url: `http://localhost:${activePort}/api/health`,
            system_logs_url: `http://localhost:${activePort}/api/system/logs`,
            thingsboard_logs_url: `http://localhost:${activePort}/api/thingsboard/logs`,
            thingsboard_url: THINGSBOARD_URL
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
    .then(async () => {
        await verifyThingsBoardConnection();
        startServer(DEFAULT_PORT);
    })
    .catch((error) => {
        logger.error('Failed to initialize storage or connect to ThingsBoard.', error);
        process.exit(1);
    });
