const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_FILE = path.join(__dirname, 'app.config.json');

const readJsonFile = (filePath) => {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Config file not found: ${filePath}`);
        }

        throw new Error(`Failed to read config file ${filePath}: ${error.message}`);
    }
};

const assertNonEmptyString = (value, fieldName) => {
    const normalized = String(value || '').trim();

    if (!normalized) {
        throw new Error(`Config field "${fieldName}" is required.`);
    }

    return normalized;
};

const assertPositiveInteger = (value, fieldName) => {
    const normalized = Number.parseInt(value, 10);

    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw new Error(`Config field "${fieldName}" must be a positive integer.`);
    }

    return normalized;
};

const resolveProjectPath = (value, fieldName) => {
    const normalized = assertNonEmptyString(value, fieldName);
    return path.isAbsolute(normalized)
        ? normalized
        : path.resolve(PROJECT_ROOT, normalized);
};

const normalizeOptionalString = (value) => sanitizeString(value);

function sanitizeString(value) {
    return String(value || '').trim();
}

const normalizeDispatchBaseUrl = (rawUrl) => {
    const normalized = assertNonEmptyString(rawUrl, 'dispatch.baseUrl');

    try {
        const parsed = new URL(normalized);
        const isRunningInDocker = fs.existsSync('/.dockerenv');
        const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);

        if (isRunningInDocker && isLoopbackHost) {
            parsed.hostname = 'host.docker.internal';
            return {
                raw: normalized,
                effective: parsed.toString()
            };
        }

        return {
            raw: normalized,
            effective: normalized
        };
    } catch (error) {
        throw new Error(`Config field "dispatch.baseUrl" must be a valid URL. Received: ${normalized}`);
    }
};

const loadConfig = () => {
    const configFile = process.env.CONFIG_FILE
        ? path.resolve(process.env.CONFIG_FILE)
        : DEFAULT_CONFIG_FILE;
    const parsed = readJsonFile(configFile);
    const dispatchBaseUrl = normalizeDispatchBaseUrl(parsed?.dispatch?.baseUrl);
    const requestedGeocodingProvider = sanitizeString(parsed?.geocoding?.provider || 'nominatim').toLowerCase();
    const mapboxAccessToken = normalizeOptionalString(parsed?.geocoding?.mapbox?.accessToken);
    const effectiveGeocodingProvider = requestedGeocodingProvider === 'mapbox' && mapboxAccessToken
        ? 'mapbox'
        : 'nominatim';

    return {
        configFile,
        server: {
            port: assertPositiveInteger(parsed?.server?.port, 'server.port')
        },
        storage: {
            databaseFile: resolveProjectPath(parsed?.storage?.databaseFile, 'storage.databaseFile'),
            logDir: resolveProjectPath(parsed?.storage?.logDir, 'storage.logDir')
        },
        dispatch: {
            rawBaseUrl: dispatchBaseUrl.raw,
            baseUrl: dispatchBaseUrl.effective
        },
        geocoding: {
            requestedProvider: requestedGeocodingProvider,
            provider: effectiveGeocodingProvider,
            language: normalizeOptionalString(parsed?.geocoding?.language) || 'vi',
            country: normalizeOptionalString(parsed?.geocoding?.country) || 'vn',
            reverseGeocodeUrl: assertNonEmptyString(parsed?.geocoding?.reverseGeocodeUrl, 'geocoding.reverseGeocodeUrl'),
            searchGeocodeUrl: assertNonEmptyString(parsed?.geocoding?.searchGeocodeUrl, 'geocoding.searchGeocodeUrl'),
            mapbox: {
                accessToken: mapboxAccessToken,
                forwardGeocodeUrl: normalizeOptionalString(parsed?.geocoding?.mapbox?.forwardGeocodeUrl) || 'https://api.mapbox.com/search/geocode/v6/forward',
                reverseGeocodeUrl: normalizeOptionalString(parsed?.geocoding?.mapbox?.reverseGeocodeUrl) || 'https://api.mapbox.com/search/geocode/v6/reverse',
                types: normalizeOptionalString(parsed?.geocoding?.mapbox?.types) || 'address,street,locality,neighborhood,place'
            }
        },
        http: {
            locationTimeoutMs: assertPositiveInteger(parsed?.http?.locationTimeoutMs, 'http.locationTimeoutMs'),
            dispatchTimeoutMs: assertPositiveInteger(parsed?.http?.dispatchTimeoutMs, 'http.dispatchTimeoutMs')
        },
        booking: {
            maxPendingBookings: assertPositiveInteger(parsed?.booking?.maxPendingBookings, 'booking.maxPendingBookings'),
            idempotencyTtlMs: assertPositiveInteger(parsed?.booking?.idempotencyTtlMs, 'booking.idempotencyTtlMs')
        }
    };
};

module.exports = {
    DEFAULT_CONFIG_FILE,
    loadConfig
};
