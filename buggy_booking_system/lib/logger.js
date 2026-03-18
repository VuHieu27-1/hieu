const fs = require('fs');
const path = require('path');
const util = require('util');

const pad = (value, size = 2) => String(value).padStart(size, '0');

const formatTimestamp = (date = new Date()) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetRemainder = pad(absOffset % 60);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${sign}${offsetHours}:${offsetRemainder}`;
};

const getDailyLogName = (date = new Date()) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `system-${year}-${month}-${day}.log`;
};

const isNil = (value) => value === undefined || value === null || value === '';

const formatPrimitive = (value) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return String(value);
        }

        return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    return String(value);
};

const formatCompactObject = (value) => util.inspect(value, {
    depth: 4,
    breakLength: Infinity,
    compact: true,
    sorted: false
});

const formatField = (label, value) => {
    if (isNil(value)) {
        return '';
    }

    if (typeof value === 'object') {
        return `${label}=${formatCompactObject(value)}`;
    }

    return `${label}=${formatPrimitive(value)}`;
};

const joinFields = (fields) => fields.filter(Boolean).join(' | ');

const buildCategory = (message, meta = {}) => {
    if (meta.category === 'thingsboard') {
        return 'THINGSBOARD';
    }

    if (message.startsWith('HTTP request')) {
        return 'HTTP';
    }

    if (message.toLowerCase().includes('booking')) {
        return 'BOOKING';
    }

    if (message.toLowerCase().includes('storage') || message.toLowerCase().includes('persist')) {
        return 'STORAGE';
    }

    if (message.toLowerCase().includes('server')) {
        return 'SERVER';
    }

    return 'SYSTEM';
};

const buildSummary = (message, meta = {}) => {
    if (message === 'HTTP request started.') {
        return joinFields([
            `START ${meta.request_id || '-'}`,
            formatField('method', meta.method),
            formatField('url', meta.url),
            formatField('ip', meta.client_ip)
        ]);
    }

    if (message === 'HTTP request completed.') {
        return joinFields([
            `DONE ${meta.request_id || '-'}`,
            formatField('method', meta.method),
            formatField('url', meta.url),
            formatField('status', meta.status_code),
            formatField('time_ms', meta.duration_ms)
        ]);
    }

    if (message === 'Outgoing HTTP request started.') {
        return joinFields([
            'SEND',
            formatField('action', meta.action || 'request'),
            formatField('booking', meta.booking_id),
            formatField('method', meta.method),
            formatField('url', meta.url)
        ]);
    }

    if (message === 'Outgoing HTTP request completed successfully.') {
        return joinFields([
            'SUCCESS',
            formatField('action', meta.action || 'request'),
            formatField('booking', meta.booking_id),
            formatField('status', meta.status_code),
            formatField('time_ms', meta.duration_ms)
        ]);
    }

    if (message === 'Outgoing HTTP request failed.') {
        return joinFields([
            'FAILED',
            formatField('action', meta.action || 'request'),
            formatField('booking', meta.booking_id),
            formatField('status', meta.status_code),
            formatField('time_ms', meta.duration_ms),
            formatField('error', meta.error)
        ]);
    }

    if (message === 'Outgoing HTTP request raised a network error.') {
        return joinFields([
            'NETWORK ERROR',
            formatField('action', meta.action || 'request'),
            formatField('booking', meta.booking_id),
            formatField('url', meta.url),
            formatField('error', meta.error && meta.error.message ? meta.error.message : meta.error)
        ]);
    }

    if (message === 'Initializing storage directories.') {
        return joinFields([
            'Preparing storage',
            formatField('data_dir', meta.data_dir),
            formatField('log_dir', meta.log_dir)
        ]);
    }

    if (message === 'Bookings storage file found.') {
        return joinFields([
            'Storage file ready',
            formatField('file', meta.bookings_file)
        ]);
    }

    if (message === 'Bookings storage file was missing and has been created.') {
        return joinFields([
            'Storage file created',
            formatField('file', meta.bookings_file)
        ]);
    }

    if (message === 'Storage initialized successfully.') {
        return joinFields([
            'Storage ready',
            formatField('bookings_loaded', meta.bookings_loaded),
            formatField('latest_log', meta.latest_log_file)
        ]);
    }

    if (message === 'Persisting bookings to disk.') {
        return joinFields([
            'Saving bookings',
            formatField('count', meta.bookings_count)
        ]);
    }

    if (message === 'Bookings persisted to disk.') {
        return joinFields([
            'Bookings saved',
            formatField('file', meta.bookings_file),
            formatField('count', meta.bookings_count)
        ]);
    }

    if (message === 'Booking validation failed.') {
        return joinFields([
            'Validation failed',
            formatField('req', meta.request_id),
            formatField('reason', meta.message)
        ]);
    }

    if (message === 'Booking history lookup succeeded.') {
        return joinFields([
            'History found',
            formatField('req', meta.request_id),
            formatField('phone', meta.phone),
            formatField('results', meta.results),
            formatField('limit', meta.limit)
        ]);
    }

    if (message === 'Booking history lookup failed. Phone is required.') {
        return joinFields([
            'History lookup failed',
            formatField('req', meta.request_id),
            'reason=phone_required'
        ]);
    }

    if (message === 'Booking history lookup failed. Phone format is invalid.') {
        return joinFields([
            'History lookup failed',
            formatField('req', meta.request_id),
            formatField('phone', meta.phone),
            'reason=invalid_phone'
        ]);
    }

    if (message === 'Booking created and synced successfully.') {
        return joinFields([
            'Booking created',
            formatField('req', meta.request_id),
            formatField('booking', meta.booking_id),
            formatField('customer', meta.customer_name),
            formatField('vehicle', meta.vehicle_type)
        ]);
    }

    if (message === 'Booking processing failed.') {
        return joinFields([
            'Booking failed',
            formatField('req', meta.request_id),
            formatField('booking', meta.booking_id),
            formatField('error', meta.error && meta.error.message ? meta.error.message : meta.error)
        ]);
    }

    if (message === 'Booking lookup succeeded.') {
        return joinFields([
            'Booking found',
            formatField('req', meta.request_id),
            formatField('booking', meta.booking_id)
        ]);
    }

    if (message === 'Booking lookup failed. Booking not found.') {
        return joinFields([
            'Booking not found',
            formatField('req', meta.request_id),
            formatField('booking', meta.booking_id)
        ]);
    }

    if (message === 'ThingsBoard startup connection verified successfully.') {
        return joinFields([
            'Startup connection OK',
            formatField('status', meta.telemetry_status),
            formatField('url', meta.telemetry_url)
        ]);
    }

    if (message.startsWith('ThingsBoard sync success for booking')) {
        return joinFields([
            'Booking sync OK',
            formatField('booking', meta.booking_id),
            formatField('telemetry', meta.telemetry_status),
            formatField('attributes', meta.attributes_status)
        ]);
    }

    if (message === 'Server is listening.') {
        return joinFields([
            'Server ready',
            formatField('port', meta.port),
            formatField('qr', meta.qr_generator_url),
            formatField('booking', meta.booking_page_url)
        ]);
    }

    if (message === 'Port is already in use. Retrying on the next port.') {
        return joinFields([
            'Port busy',
            formatField('requested', meta.port),
            formatField('next', meta.next_port)
        ]);
    }

    if (message === 'Default port was busy; server started on the next available port.') {
        return joinFields([
            'Fallback port used',
            formatField('requested', meta.requested_port),
            formatField('active', meta.active_port)
        ]);
    }

    if (message === 'Unknown API endpoint requested.') {
        return joinFields([
            'Unknown API route',
            formatField('req', meta.request_id),
            formatField('path', meta.path)
        ]);
    }

    return message;
};

const extractExtraDetails = (message, meta = {}) => {
    if (!meta || typeof meta !== 'object' || meta instanceof Error) {
        return '';
    }

    const ignoredKeysByMessage = {
        'HTTP request started.': ['request_id', 'method', 'url', 'client_ip'],
        'HTTP request completed.': ['request_id', 'method', 'url', 'status_code', 'duration_ms'],
        'Outgoing HTTP request started.': ['action', 'booking_id', 'method', 'url', 'category'],
        'Outgoing HTTP request completed successfully.': ['action', 'booking_id', 'status_code', 'duration_ms', 'category'],
        'Outgoing HTTP request failed.': ['action', 'booking_id', 'status_code', 'duration_ms', 'error', 'category'],
        'Outgoing HTTP request raised a network error.': ['action', 'booking_id', 'url', 'error', 'category'],
        'Booking history lookup succeeded.': ['request_id', 'phone', 'results', 'limit'],
        'Booking history lookup failed. Phone is required.': ['request_id'],
        'Booking history lookup failed. Phone format is invalid.': ['request_id', 'phone'],
        'Booking validation failed.': ['request_id', 'message'],
        'Booking created and synced successfully.': ['request_id', 'booking_id', 'customer_name', 'vehicle_type'],
        'Booking processing failed.': ['request_id', 'booking_id', 'error'],
        'Booking lookup succeeded.': ['request_id', 'booking_id'],
        'Booking lookup failed. Booking not found.': ['request_id', 'booking_id'],
        'ThingsBoard startup connection verified successfully.': ['category', 'telemetry_status', 'telemetry_url'],
        'Server is listening.': ['port', 'qr_generator_url', 'booking_page_url'],
        'Storage initialized successfully.': ['bookings_loaded', 'latest_log_file'],
        'Initializing storage directories.': ['data_dir', 'log_dir'],
        'Bookings storage file found.': ['bookings_file'],
        'Bookings storage file was missing and has been created.': ['bookings_file'],
        'Persisting bookings to disk.': ['bookings_count'],
        'Bookings persisted to disk.': ['bookings_file', 'bookings_count'],
        'Port is already in use. Retrying on the next port.': ['port', 'next_port'],
        'Default port was busy; server started on the next available port.': ['requested_port', 'active_port'],
        'Unknown API endpoint requested.': ['request_id', 'path']
    };

    const ignoredKeys = new Set(ignoredKeysByMessage[message] || []);
    const remainingEntries = Object.entries(meta).filter(([key, value]) => !ignoredKeys.has(key) && !isNil(value));

    if (!remainingEntries.length) {
        return '';
    }

    const details = remainingEntries.map(([key, value]) => formatField(key, value)).filter(Boolean).join(' | ');
    return details ? ` || details: ${details}` : '';
};

const formatErrorMeta = (meta) => {
    if (!(meta instanceof Error)) {
        return '';
    }

    return ` || details: error=${meta.message}${meta.stack ? ` | stack=${meta.stack}` : ''}`;
};

const createLogger = ({ logDir, serviceName }) => {
    fs.mkdirSync(logDir, { recursive: true });

    const writeLine = (level, message, meta) => {
        const timestamp = formatTimestamp();
        const dailyFile = path.join(logDir, getDailyLogName());
        const latestFile = path.join(logDir, 'latest.log');
        const category = buildCategory(message, meta);
        const summary = buildSummary(message, meta);
        const detailLine = meta instanceof Error ? formatErrorMeta(meta) : extractExtraDetails(message, meta);
        const header = `[${timestamp}] ${level.padEnd(5)} ${category.padEnd(11)} ${summary}`;
        const line = detailLine ? `${header}${detailLine}` : header;

        fs.appendFileSync(dailyFile, `${line}\n`, 'utf8');
        fs.appendFileSync(latestFile, `${line}\n`, 'utf8');

        if (level === 'ERROR') {
            console.error(line);
            return;
        }

        if (level === 'WARN') {
            console.warn(line);
            return;
        }

        console.log(line);
    };

    return {
        info: (message, meta) => writeLine('INFO', message, meta),
        warn: (message, meta) => writeLine('WARN', message, meta),
        error: (message, meta) => writeLine('ERROR', message, meta),
        debug: (message, meta) => writeLine('DEBUG', message, meta),
        getLatestLogPath: () => path.join(logDir, 'latest.log'),
        getLogDir: () => logDir,
        serviceName
    };
};

module.exports = {
    createLogger
};
