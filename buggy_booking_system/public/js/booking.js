document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-button');
    const pickupLabelDisplay = document.getElementById('pickup-label-display');
    const locationLabelDisplay = document.getElementById('location-label-display');
    const requestOverlay = document.getElementById('request-overlay');
    const requestCard = document.getElementById('request-card');
    const requestSpinner = document.getElementById('request-spinner');
    const requestKicker = document.getElementById('request-kicker');
    const requestTitle = document.getElementById('request-title');
    const requestMessage = document.getElementById('request-message');
    const requestBookingLine = document.getElementById('request-booking-line');
    const requestAction = document.getElementById('request-action');
    const bookingIdSpan = document.getElementById('booking-id');
    const toggleHistoryButton = document.getElementById('toggle-history-button');
    const historyPanel = document.getElementById('history-panel');
    const loadHistoryButton = document.getElementById('load-history-button');
    const historyPhoneInput = document.getElementById('history-phone');
    const historyFeedback = document.getElementById('history-feedback');
    const bookingHistoryList = document.getElementById('booking-history-list');
    const scheduledTimeGroup = document.getElementById('scheduled-time-group');
    const detectLocationButton = document.getElementById('detect-location-button');
    const stopLocationButton = document.getElementById('stop-location-button');
    const locationFeedback = document.getElementById('location-feedback');
    const gpsTrackerPanel = document.getElementById('gps-tracker-panel');
    const gpsMapContainer = document.getElementById('gps-map');
    const fields = {
        name: document.getElementById('name'),
        phone: document.getElementById('phone'),
        pickupArea: document.getElementById('pickup-area'),
        dropoffPoint: document.getElementById('dropoff-point'),
        passengerCount: document.getElementById('passenger-count'),
        pickupTimeMode: document.getElementById('pickup-time-mode'),
        startTime: document.getElementById('start-time')
    };

    const errors = {
        name: document.getElementById('name-error'),
        phone: document.getElementById('phone-error'),
        pickupArea: document.getElementById('pickup-area-error'),
        dropoffPoint: document.getElementById('dropoff-point-error'),
        startTime: document.getElementById('start-time-error')
    };
    const suggestionMenus = {
        pickupArea: document.getElementById('pickup-suggestions'),
        dropoffPoint: document.getElementById('dropoff-suggestions')
    };

    const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
    const CACHE_KEY = 'buggy-booking-cache-v5';
    const HISTORY_LIMIT = 6;
    const HISTORY_AUTOLOAD_DELAY = 450;
    const STATUS_REDIRECT_DELAY_MS = 900;
    const LOCATION_SUGGESTION_DEBOUNCE_MS = 420;
    const LOCATION_SUGGESTION_LIMIT = 5;
    const LOCATION_SUGGESTION_MIN_QUERY_LENGTH = 2;
    const LOCATION_SUGGESTION_QUERY_LIMIT = 2;
    const GPS_WATCH_OPTIONS = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
    };
    const GPS_MOVING_AVERAGE_WINDOW = 4;
    const GPS_HYBRID_WINDOW = 3;
    const GPS_FILTER_MODE = 'hybrid';
    const GPS_MAX_ACCEPTED_ACCURACY_METERS = 80;
    const GPS_MAX_REASONABLE_SPEED_MPS = 55;
    const GPS_MARKER_LERP = 0.18;
    const GPS_CAMERA_UPDATE_INTERVAL_MS = 1000;
    const GPS_SLOW_UPDATE_AFTER_MS = 12000;
    const GPS_TRACK_POINT_LIMIT = 80;
    const GPS_MATCH_POINT_LIMIT = 5;
    const GPS_MATCH_INTERVAL_MS = 3500;
    const GPS_OSRM_MATCH_URL = 'https://router.project-osrm.org/match/v1/driving/';
    let historyLookupTimer = null;
    let isHistoryPanelOpen = false;
    let isResolvingLocation = false;
    let hasSubmitted = false;
    let isPickupAreaUserEdited = false;
    let shouldForceGpsPickupAutofill = false;
    let deviceLocationSnapshot = null;
    let pickupAreaContext = null;
    let locationMap = null;
    let locationMarker = null;
    let locationMatchedMarker = null;
    let locationAccuracyCircle = null;
    let locationRawTrackLine = null;
    let locationFilteredTrackLine = null;
    let locationMatchedTrackLine = null;
    let locationWatchId = null;
    let locationAnimationFrameId = null;
    let isLocationTrackingActive = false;
    let locationTargetPoint = null;
    let locationRenderedPoint = null;
    let locationLastAcceptedSample = null;
    let locationLatestSample = null;
    let locationLatestFilteredPoint = null;
    let locationLatestMatchedPoint = null;
    let locationLastCameraUpdateAt = 0;
    let locationLastMatchRequestAt = 0;
    let locationLastResolvedPoint = null;
    let locationLastResolvedAt = 0;
    let locationIsResolvingAddress = false;
    let locationIsMatchingRoad = false;
    let locationSlowUpdateTimer = null;
    let locationProgrammaticMoveUntil = 0;
    let locationUserIsPanningMap = false;
    let locationManualResolveTimer = null;
    let locationLastManualInteractionAt = 0;
    const locationRawSamples = [];
    const locationRawTrack = [];
    const locationFilteredTrack = [];
    const locationMatchedTrack = [];
    const touchedFields = new Set();
    const selectedLocationResults = {
        pickupArea: null,
        dropoffPoint: null
    };
    const suggestionState = {
        pickupArea: {
            items: [],
            activeIndex: -1,
            requestToken: 0,
            blurTimer: null,
            debounceTimer: null
        },
        dropoffPoint: {
            items: [],
            activeIndex: -1,
            requestToken: 0,
            blurTimer: null,
            debounceTimer: null
        }
    };
    const suggestionCache = new Map();

    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const formatDisplayDateTime = (value) => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value || '-';
        }

        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Asia/Ho_Chi_Minh'
        }).format(date);
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const parseResponse = async (response) => {
        try {
            return await response.json();
        } catch (error) {
            return {
                success: false,
                message: 'Unexpected server response.'
            };
        }
    };

    const buildTaskId = () => {
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const suffix = Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0');
        return `BKG-${stamp}-${suffix}`;
    };

    const setDateDefaults = () => {
        const nextSlot = new Date();
        nextSlot.setMinutes(nextSlot.getMinutes() + 10);
        nextSlot.setSeconds(0, 0);
        fields.startTime.min = formatDateTimeLocal(new Date());

        if (!fields.startTime.value) {
            fields.startTime.value = formatDateTimeLocal(nextSlot);
        }
    };

    const loadCache = () => {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            fields.name.value = cached.name || '';
            fields.phone.value = cached.phone || '';
            fields.pickupArea.value = cached.pickupArea || '';
            fields.dropoffPoint.value = cached.dropoffPoint || '';
            fields.passengerCount.value = String(cached.passengerCount || 1);
            fields.pickupTimeMode.value = cached.pickupTimeMode || 'now';
        } catch (error) {
            localStorage.removeItem(CACHE_KEY);
        }
    };

    const saveCache = () => {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            name: fields.name.value.trim(),
            phone: fields.phone.value.trim(),
            pickupArea: fields.pickupArea.value.trim(),
            dropoffPoint: fields.dropoffPoint.value.trim(),
            passengerCount: Number.parseInt(fields.passengerCount.value, 10) || 1,
            pickupTimeMode: fields.pickupTimeMode.value
        }));
    };

    const updateSummary = () => {
        pickupLabelDisplay.textContent = fields.pickupArea.value.trim() || 'Enter pickup area';
        locationLabelDisplay.textContent = fields.dropoffPoint.value.trim() || 'Enter drop-off point';
    };

    const setLocationFeedback = (message = '', type = 'info') => {
        if (!message) {
            locationFeedback.className = 'location-feedback hidden';
            locationFeedback.textContent = '';
            return;
        }

        locationFeedback.textContent = message;
        locationFeedback.className = `location-feedback location-feedback-${type}`;
    };

    const setLocationLoadingState = (isLoading) => {
        isResolvingLocation = isLoading;
        detectLocationButton.disabled = isLoading;
        detectLocationButton.textContent = isLoading ? 'Locating...' : (isLocationTrackingActive ? 'Refresh GPS' : 'Use GPS');
        stopLocationButton.classList.toggle('hidden', !isLocationTrackingActive);
    };

    const buildLocationPermissionDeniedMessage = () => {
        const userAgent = navigator.userAgent || '';
        const isIPhoneOrIPad = /iPhone|iPad|iPod/i.test(userAgent);

        if (isIPhoneOrIPad) {
            return 'Location permission was denied. On iPhone/iPad, allow Location for this site in Safari settings, then tap "Use GPS" again.';
        }

        return 'Location permission was denied. Please allow location access in your browser, then tap "Use GPS" again.';
    };

    const buildCoordinateLabel = (latitude, longitude) => `Lat ${Number(latitude).toFixed(6)}, Lng ${Number(longitude).toFixed(6)}`;

    const extractLocationName = (payload) => {
        if (payload && payload.short_address) {
            return payload.short_address;
        }

        const address = payload && payload.address ? payload.address : {};

        // Build a precise street address from individual components.
        // Priority: house_number + road + area name (suburb or neighbourhood).
        const parts = [];

        // Specific place name (hotel, resort, beach, etc.)
        const placeName = address.tourism
            || address.attraction
            || address.resort
            || address.hotel
            || address.office
            || address.shop
            || address.beach
            || address.leisure
            || address.building
            || address.amenity
            || '';

        if (placeName) {
            parts.push(placeName);
        }

        // Street address: house_number + road
        const houseNumber = address.house_number || '';
        const road = address.road || address.pedestrian || address.footway || '';

        if (houseNumber && road) {
            parts.push(`${houseNumber} ${road}`);
        } else if (road) {
            parts.push(road);
        }

        // Area: neighbourhood or suburb (ward/phường)
        const area = address.neighbourhood
            || address.suburb
            || address.quarter
            || address.residential
            || address.city_district
            || address.village
            || '';
        if (area) {
            parts.push(area);
        }

        if (parts.length > 0) {
            return parts.join(', ');
        }

        // Fallback to display_name from Nominatim (full formatted address)
        if (payload.display_name) {
            return payload.display_name.split(',').slice(0, 3).join(', ').trim();
        }

        return payload.name || '';
    };

    const extractFullAddress = (payload) => {
        if (!payload) {
            return '';
        }

        return payload.full_address || payload.display_name || payload.name || extractLocationName(payload);
    };

    const splitAddressSegments = (value) => String(value || '')
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);

    const normalizeAddressText = (value) => String(value || '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizeAddressSearchKey = (value) => normalizeAddressText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const stripVietnameseDiacritics = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');

    const sanitizeAddressForSearch = (value) => normalizeAddressText(value)
        .replace(/\s+,/g, ',')
        .replace(/,+$/g, '')
        .trim();

    const buildExpandedAddressVariants = (value) => {
        const normalized = sanitizeAddressForSearch(value);
        if (!normalized) {
            return [];
        }

        const variants = new Set([normalized]);
        const expanded = normalized
            .replace(/\bTP\.?(?=\s|$)/gi, 'Thanh pho')
            .replace(/\bQ\.?(?=\s|$)/gi, 'Quan')
            .replace(/\bP\.?(?=\s|$)/gi, 'Phuong')
            .replace(/\bDg\.?(?=\s|$)/gi, 'Duong')
            .replace(/\bHem\b/gi, 'Kiet')
            .replace(/\bK(?=\s+\d)/gi, 'Kiet');
        variants.add(sanitizeAddressForSearch(expanded));

        const asciiVariant = sanitizeAddressForSearch(stripVietnameseDiacritics(normalized));
        if (asciiVariant) {
            variants.add(asciiVariant);
        }

        const expandedAscii = sanitizeAddressForSearch(stripVietnameseDiacritics(expanded));
        if (expandedAscii) {
            variants.add(expandedAscii);
        }

        return [...variants].filter(Boolean);
    };

    const mergeAddressSegments = (...groups) => {
        const seen = new Set();
        const merged = [];

        groups.flat().forEach((segment) => {
            const normalized = String(segment || '').trim();
            if (!normalized) {
                return;
            }

            const key = normalized.toLocaleLowerCase('vi-VN');
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            merged.push(normalized);
        });

        return merged;
    };

    const getAddressContextSegments = (payload) => {
        if (!payload) {
            return [];
        }

        const address = payload.address || {};
        const administrativeSegments = mergeAddressSegments(
            [
                address.neighbourhood || address.hamlet || '',
                address.suburb || address.quarter || address.residential || '',
                address.city_district || address.borough || address.county || '',
                address.city || address.town || address.village || '',
                address.state || address.region || '',
                address.postcode || '',
                address.country || ''
            ]
        );

        if (administrativeSegments.length > 0) {
            return administrativeSegments;
        }

        const fullAddress = extractFullAddress(payload);
        const segments = splitAddressSegments(fullAddress);
        return segments.length > 1 ? segments.slice(1) : [];
    };

    const buildPreferredPickupLabel = (typedValue, payload = null) => {
        const typedSegments = splitAddressSegments(typedValue);
        const gpsContextSegments = getAddressContextSegments(pickupAreaContext);
        const payloadContextSegments = getAddressContextSegments(payload);

        return mergeAddressSegments(
            typedSegments,
            gpsContextSegments,
            payloadContextSegments
        ).join(', ');
    };

    const buildPickupAreaSearchQuery = (typedValue) => mergeAddressSegments(
        splitAddressSegments(typedValue),
        getAddressContextSegments(pickupAreaContext)
    ).join(', ');

    const buildAddressSearchCandidates = (typedValue, options = {}) => {
        const {
            contextPayload = null,
            includeVietnamFallback = true
        } = options;
        const normalizedTypedValue = normalizeAddressText(typedValue);
        const contextSegments = getAddressContextSegments(contextPayload);
        const primaryContextSegments = contextSegments.slice(-4);
        const candidates = [];
        const addCandidate = (candidate) => {
            const normalizedCandidate = normalizeAddressText(candidate);

            if (!normalizedCandidate || normalizedCandidate.length < 3 || candidates.includes(normalizedCandidate)) {
                return;
            }

            candidates.push(normalizedCandidate);
        };

        buildExpandedAddressVariants(normalizedTypedValue).forEach(addCandidate);
        buildExpandedAddressVariants(buildPickupAreaSearchQuery(normalizedTypedValue)).forEach(addCandidate);

        if (primaryContextSegments.length) {
            buildExpandedAddressVariants(mergeAddressSegments(
                splitAddressSegments(normalizedTypedValue),
                primaryContextSegments
            ).join(', ')).forEach(addCandidate);
        }

        if (contextSegments.length) {
            buildExpandedAddressVariants(mergeAddressSegments(
                splitAddressSegments(normalizedTypedValue),
                contextSegments
            ).join(', ')).forEach(addCandidate);
        }

        if (includeVietnamFallback && !/viet\s*nam|việt\s*nam/i.test(normalizedTypedValue)) {
            addCandidate(`${normalizedTypedValue}, Viet Nam`);

            if (primaryContextSegments.length) {
                addCandidate(mergeAddressSegments(
                    splitAddressSegments(normalizedTypedValue),
                    primaryContextSegments,
                    ['Viet Nam']
                ).join(', '));
            }
        }

        buildExpandedAddressVariants(normalizedTypedValue).forEach(addCandidate);
        if (includeVietnamFallback) {
            buildExpandedAddressVariants(`${normalizedTypedValue}, Viet Nam`).forEach(addCandidate);
        }
        return candidates;
    };

    const searchLocationByAddressCandidates = async (queries, options = {}) => {
        let lastError = null;

        for (const query of queries) {
            try {
                return await searchLocationByAddress(query, options);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Unable to search for that address.');
    };

    const SERVICE_AREA_FALLBACKS = [
        {
            keywords: ['da nang', 'danang', 'hai chau', 'hoang dieu', 'chuong duong'],
            point: { lat: 16.054407, lng: 108.202167 }
        },
        {
            keywords: ['hoi an'],
            point: { lat: 15.880058, lng: 108.338047 }
        }
    ];

    const inferServiceAreaFallbackPoint = (typedValue, contextPayload = null) => {
        const searchCorpus = [
            typedValue,
            extractFullAddress(contextPayload),
            extractFullAddress(pickupAreaContext),
            fields.dropoffPoint ? fields.dropoffPoint.value : ''
        ]
            .map((value) => normalizeAddressSearchKey(value))
            .filter(Boolean)
            .join(' | ');

        for (const area of SERVICE_AREA_FALLBACKS) {
            if (area.keywords.some((keyword) => searchCorpus.includes(keyword))) {
                return { ...area.point };
            }
        }

        return null;
    };

    const resolveLocationDetails = async (latitude, longitude) => {
        const response = await fetch(`/api/location/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
        const result = await parseResponse(response);

        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Unable to map your location.');
        }

        return result.data;
    };

    const getSuggestionProximityPoint = (fieldKey) => {
        if (fieldKey === 'pickupArea') {
            const pickupPoint = getCurrentPickupFallbackPoint();
            if (pickupPoint) {
                return pickupPoint;
            }
        }

        if (selectedLocationResults.pickupArea?.latitude && selectedLocationResults.pickupArea?.longitude) {
            return {
                lat: Number(selectedLocationResults.pickupArea.latitude),
                lng: Number(selectedLocationResults.pickupArea.longitude)
            };
        }

        return getCurrentPickupFallbackPoint();
    };

    const setPickupAreaValue = (value, options = {}) => {
        const { persist = true } = options;
        fields.pickupArea.value = value;
        updateSummary();
        validateForm();
        if (persist) {
            saveCache();
        }
    };

    const buildResolvedPickupLabel = (payload) => {
        if (!payload) {
            return '';
        }

        return String(
            payload.display_address
            || payload.short_address
            || payload.road_name
            || extractFullAddress(payload)
            || extractLocationName(payload)
            || ''
        ).trim();
    };

    const searchLocationByAddress = async (query, options = {}) => {
        const normalizedQuery = sanitizeAddressForSearch(query);
        const params = new URLSearchParams({ q: normalizedQuery });
        const proximity = getSuggestionProximityPoint(options.fieldKey || 'pickupArea');
        if (proximity) {
            params.set('lat', String(proximity.lat));
            params.set('lng', String(proximity.lng));
        }
        const response = await fetch(`/api/location/search?${params.toString()}`);
        const result = await parseResponse(response);

        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Unable to search for that address.');
        }

        return result.data;
    };

    const searchLocationSuggestions = async (query, limit = LOCATION_SUGGESTION_LIMIT, options = {}) => {
        const normalizedQuery = sanitizeAddressForSearch(query);
        const params = new URLSearchParams({
            q: normalizedQuery,
            limit: String(limit)
        });
        const proximity = getSuggestionProximityPoint(options.fieldKey || 'pickupArea');
        if (proximity) {
            params.set('lat', String(proximity.lat));
            params.set('lng', String(proximity.lng));
        }
        const response = await fetch(`/api/location/suggest?${params.toString()}`);
        const result = await parseResponse(response);

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Unable to load address suggestions.');
        }

        return result.data;
    };

    const searchLocationSuggestionsByCandidates = async (queries, limit = LOCATION_SUGGESTION_LIMIT, options = {}) => {
        const {
            fieldKey = 'pickupArea',
            typedValue = ''
        } = options;
        let lastError = null;
        const merged = [];
        const seen = new Set();

        for (const query of queries) {
            try {
                const results = await searchLocationSuggestions(query, limit, {
                    fieldKey
                });
                results.forEach((item) => {
                    const key = `${Number(item.latitude).toFixed(6)},${Number(item.longitude).toFixed(6)}|${normalizeAddressSearchKey(item.display_address || item.short_address || '')}`;
                    if (seen.has(key)) {
                        return;
                    }

                    seen.add(key);
                    merged.push(item);
                });

                if (merged.length >= limit) {
                    return merged
                        .sort((left, right) => (
                            scoreLocationSuggestion(fieldKey, typedValue, right)
                            - scoreLocationSuggestion(fieldKey, typedValue, left)
                        ))
                        .slice(0, limit);
                }
            } catch (error) {
                lastError = error;
            }
        }

        if (merged.length) {
            return merged
                .sort((left, right) => (
                    scoreLocationSuggestion(fieldKey, typedValue, right)
                    - scoreLocationSuggestion(fieldKey, typedValue, left)
                ))
                .slice(0, limit);
        }

        if (lastError) {
            throw lastError;
        }

        return [];
    };

    const buildSuggestionPrimaryLabel = (result) => normalizeAddressText(
        result?.short_address
        || result?.display_address
        || extractFullAddress(result)
        || ''
    );

    const buildSuggestionSecondaryLabel = (result) => {
        const segments = splitAddressSegments(result?.display_address || extractFullAddress(result));
        if (segments.length > 1) {
            return normalizeAddressText(segments.slice(1).join(', '));
        }

        return normalizeAddressText(result?.display_address || '');
    };

    const createTypedLocationSuggestion = (fieldKey, typedValue) => ({
        provider: 'typed_input',
        latitude: null,
        longitude: null,
        short_address: normalizeAddressText(typedValue),
        display_address: normalizeAddressText(typedValue),
        full_address: normalizeAddressText(typedValue),
        source_field: fieldKey
    });

    const clearSelectedLocationResult = (fieldKey) => {
        selectedLocationResults[fieldKey] = null;
    };

    const hideLocationSuggestions = (fieldKey) => {
        const menu = suggestionMenus[fieldKey];
        const state = suggestionState[fieldKey];

        state.items = [];
        state.activeIndex = -1;
        if (menu) {
            menu.innerHTML = '';
            menu.classList.add('hidden');
        }
    };

    const setActiveSuggestionIndex = (fieldKey, nextIndex) => {
        const state = suggestionState[fieldKey];
        const menu = suggestionMenus[fieldKey];
        state.activeIndex = nextIndex;

        if (!menu) {
            return;
        }

        [...menu.querySelectorAll('.location-suggestion')].forEach((button, index) => {
            button.classList.toggle('is-active', index === nextIndex);
        });
    };

    const renderLocationSuggestions = (fieldKey) => {
        const menu = suggestionMenus[fieldKey];
        const state = suggestionState[fieldKey];

        if (!menu) {
            return;
        }

        if (!state.items.length) {
            hideLocationSuggestions(fieldKey);
            return;
        }

        menu.innerHTML = state.items.map((item, index) => `
            <button
                type="button"
                class="location-suggestion${index === state.activeIndex ? ' is-active' : ''}"
                data-field-key="${fieldKey}"
                data-suggestion-index="${index}"
            >
                <span class="location-suggestion-title">${escapeHtml(buildSuggestionPrimaryLabel(item))}</span>
                <span class="location-suggestion-subtitle">${escapeHtml(buildSuggestionSecondaryLabel(item))}</span>
            </button>
        `).join('');
        menu.classList.remove('hidden');
    };

    const getSuggestionContextPayload = (fieldKey) => {
        if (fieldKey === 'pickupArea') {
            return pickupAreaContext;
        }

        return selectedLocationResults.pickupArea || pickupAreaContext;
    };

    const buildSuggestionSearchQuery = (fieldKey, typedValue) => {
        const normalizedValue = normalizeAddressText(typedValue);
        if (!normalizedValue) {
            return '';
        }

        if (fieldKey === 'pickupArea') {
            return buildPickupAreaSearchQuery(normalizedValue) || normalizedValue;
        }

        return mergeAddressSegments(
            splitAddressSegments(normalizedValue),
            getAddressContextSegments(getSuggestionContextPayload(fieldKey))
        ).join(', ') || normalizedValue;
    };

    const tokenizeAddressSearch = (value) => normalizeAddressSearchKey(value)
        .split(/[^a-z0-9]+/i)
        .filter(Boolean);

    const buildLocationSuggestionCandidates = (fieldKey, typedValue) => {
        const normalizedValue = normalizeAddressText(typedValue);
        const contextPayload = getSuggestionContextPayload(fieldKey);
        const candidates = [];
        const addCandidate = (candidate) => {
            const normalizedCandidate = normalizeAddressText(candidate);
            if (!normalizedCandidate || candidates.includes(normalizedCandidate)) {
                return;
            }
            candidates.push(normalizedCandidate);
        };

        buildExpandedAddressVariants(normalizedValue).forEach(addCandidate);

        if (fieldKey === 'pickupArea') {
            buildExpandedAddressVariants(buildPickupAreaSearchQuery(normalizedValue)).forEach(addCandidate);
            const pickupContext = getAddressContextSegments(contextPayload).slice(-2);
            if (pickupContext.length) {
                buildExpandedAddressVariants(mergeAddressSegments(
                    splitAddressSegments(normalizedValue),
                    pickupContext
                ).join(', ')).forEach(addCandidate);
            }
            return candidates.slice(0, LOCATION_SUGGESTION_QUERY_LIMIT);
        }

        const contextSegments = getAddressContextSegments(contextPayload);
        const cityContext = contextSegments.slice(-2);

        buildExpandedAddressVariants(mergeAddressSegments(
            splitAddressSegments(normalizedValue),
            cityContext
        ).join(', ')).forEach(addCandidate);

        buildExpandedAddressVariants(`${normalizedValue}, Da Nang`).forEach(addCandidate);
        buildExpandedAddressVariants(`${normalizedValue}, Viet Nam`).forEach(addCandidate);

        return candidates.slice(0, LOCATION_SUGGESTION_QUERY_LIMIT);
    };

    const scoreLocationSuggestion = (fieldKey, typedValue, result) => {
        const normalizedTyped = normalizeAddressSearchKey(typedValue);
        const typedTokens = tokenizeAddressSearch(typedValue);
        const display = normalizeAddressSearchKey(result?.display_address || result?.short_address || '');
        const roadName = normalizeAddressSearchKey(result?.road_name || '');
        const contextTokens = tokenizeAddressSearch(extractFullAddress(getSuggestionContextPayload(fieldKey)));
        let score = 0;

        if (!display) {
            return score;
        }

        if (result?.provider === 'typed_input') {
            return 40;
        }

        if (display.startsWith(normalizedTyped)) {
            score += 120;
        }

        if (display.includes(normalizedTyped)) {
            score += 80;
        }

        if (roadName && normalizedTyped.includes(roadName)) {
            score += 45;
        }

        typedTokens.forEach((token) => {
            if (display.includes(token)) {
                score += token.length >= 4 ? 12 : 6;
            }
            if (roadName.includes(token)) {
                score += 10;
            }
        });

        if (fieldKey === 'dropoffPoint') {
            contextTokens.forEach((token) => {
                if (display.includes(token)) {
                    score += 3;
                }
            });
        }

        return score;
    };

    const selectLocationSuggestion = async (fieldKey, suggestion, options = {}) => {
        if (!suggestion) {
            return;
        }

        const { keepFocus = false } = options;
        const input = fields[fieldKey];
        const label = normalizeAddressText(
            suggestion.display_address
            || suggestion.short_address
            || input.value
        );

        if (Number.isFinite(suggestion.latitude) && Number.isFinite(suggestion.longitude)) {
            selectedLocationResults[fieldKey] = suggestion;
        } else {
            clearSelectedLocationResult(fieldKey);
        }
        input.value = label;
        touchedFields.add(fieldKey);
        hideLocationSuggestions(fieldKey);

        if (fieldKey === 'pickupArea') {
            isPickupAreaUserEdited = true;
            shouldForceGpsPickupAutofill = false;
            pickupAreaContext = suggestion;
            await focusMapOnAddressResult(suggestion, {
                feedback: true,
                typedValue: label
            });
        }

        updateSummary();
        validateForm();
        saveCache();

        if (keepFocus) {
            input.focus();
        }
    };

    const loadLocationSuggestions = async (fieldKey, typedValue) => {
        const menu = suggestionMenus[fieldKey];
        const state = suggestionState[fieldKey];
        const normalizedValue = normalizeAddressText(typedValue);

        if (!menu || normalizedValue.length < LOCATION_SUGGESTION_MIN_QUERY_LENGTH) {
            hideLocationSuggestions(fieldKey);
            return;
        }

        const requestToken = state.requestToken + 1;
        state.requestToken = requestToken;
        const cacheKey = `${fieldKey}:${normalizeAddressSearchKey(normalizedValue)}`;
        const cachedResults = suggestionCache.get(cacheKey);

        if (cachedResults) {
            state.items = cachedResults;
            state.activeIndex = cachedResults.length ? 0 : -1;
            renderLocationSuggestions(fieldKey);
            return;
        }

        state.items = [createTypedLocationSuggestion(fieldKey, normalizedValue)];
        state.activeIndex = 0;
        renderLocationSuggestions(fieldKey);

        try {
            const results = await searchLocationSuggestionsByCandidates(
                buildLocationSuggestionCandidates(fieldKey, buildSuggestionSearchQuery(fieldKey, normalizedValue)),
                LOCATION_SUGGESTION_LIMIT,
                {
                    fieldKey,
                    typedValue: normalizedValue
                }
            );

            if (state.requestToken !== requestToken) {
                return;
            }

            const mergedResults = [
                ...results,
                ...(results.length ? [] : [createTypedLocationSuggestion(fieldKey, normalizedValue)])
            ];
            suggestionCache.set(cacheKey, mergedResults);
            state.items = mergedResults;
            state.activeIndex = mergedResults.length ? 0 : -1;
            renderLocationSuggestions(fieldKey);
        } catch (error) {
            if (state.requestToken !== requestToken) {
                return;
            }

            const fallbackItems = [createTypedLocationSuggestion(fieldKey, normalizedValue)];
            suggestionCache.set(cacheKey, fallbackItems);
            state.items = fallbackItems;
            state.activeIndex = 0;
            renderLocationSuggestions(fieldKey);
        }
    };

    const scheduleLocationSuggestions = (fieldKey, typedValue) => {
        const state = suggestionState[fieldKey];
        if (state.debounceTimer) {
            clearTimeout(state.debounceTimer);
        }

        const normalizedValue = normalizeAddressText(typedValue);
        if (normalizedValue.length < LOCATION_SUGGESTION_MIN_QUERY_LENGTH) {
            hideLocationSuggestions(fieldKey);
            return;
        }

        state.debounceTimer = window.setTimeout(() => {
            loadLocationSuggestions(fieldKey, normalizedValue);
        }, LOCATION_SUGGESTION_DEBOUNCE_MS);
    };

    const selectActiveLocationSuggestion = async (fieldKey) => {
        const state = suggestionState[fieldKey];
        const suggestion = state.items[state.activeIndex] || state.items[0];

        if (!suggestion) {
            return false;
        }

        await selectLocationSuggestion(fieldKey, suggestion);
        return true;
    };

    const handleSuggestionMenuClick = (event) => {
        const button = event.target.closest('.location-suggestion');
        if (!button) {
            return;
        }

        const fieldKey = button.dataset.fieldKey;
        const suggestionIndex = Number.parseInt(button.dataset.suggestionIndex, 10);
        const suggestion = suggestionState[fieldKey]?.items?.[suggestionIndex];

        if (!fieldKey || !suggestion) {
            return;
        }

        event.preventDefault();
        selectLocationSuggestion(fieldKey, suggestion);
    };

    const clearSuggestionBlurTimer = (fieldKey) => {
        const state = suggestionState[fieldKey];
        if (state.blurTimer) {
            clearTimeout(state.blurTimer);
            state.blurTimer = null;
        }
    };

    const scheduleSuggestionHide = (fieldKey) => {
        clearSuggestionBlurTimer(fieldKey);
        suggestionState[fieldKey].blurTimer = window.setTimeout(() => {
            hideLocationSuggestions(fieldKey);
        }, 160);
    };

    const shouldRefreshResolvedPickup = (point) => {
        if (!locationLastResolvedPoint) {
            return true;
        }

        const distance = haversineDistanceMeters(locationLastResolvedPoint, point);
        const isStale = (Date.now() - locationLastResolvedAt) > 15000;
        return distance >= 20 || isStale;
    };

    const resolvePickupAreaFromPoint = async (point, options = {}) => {
        const {
            source = 'map_adjusted',
            feedback = true,
            force = false,
            autofillInput = !isPickupAreaUserEdited
        } = options;

        if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
            return;
        }

        if (locationIsResolvingAddress) {
            return;
        }

        if (!force && !shouldRefreshResolvedPickup(point)) {
            return;
        }

        locationIsResolvingAddress = true;

        if (feedback) {
            setLocationFeedback('Resolving the selected point into a street address...', 'info');
        }

        try {
            const place = await resolveLocationDetails(
                Number(point.lat.toFixed(6)),
                Number(point.lng.toFixed(6))
            );
            const pickupLabel = buildResolvedPickupLabel(place);

            if (!pickupLabel) {
                throw new Error('Street address not found for the selected point.');
            }

            pickupAreaContext = place;
            selectedLocationResults.pickupArea = {
                ...place,
                latitude: Number(point.lat.toFixed(6)),
                longitude: Number(point.lng.toFixed(6))
            };

            if (autofillInput) {
                isPickupAreaUserEdited = false;
                shouldForceGpsPickupAutofill = false;
                setPickupAreaValue(pickupLabel);
            }

            locationLastResolvedPoint = {
                lat: Number(point.lat.toFixed(6)),
                lng: Number(point.lng.toFixed(6))
            };
            locationLastResolvedAt = Date.now();

            if (deviceLocationSnapshot) {
                deviceLocationSnapshot.resolved_address = pickupLabel;
                deviceLocationSnapshot.full_address = place?.full_address || place?.display_address || pickupLabel;
                deviceLocationSnapshot.geocode_source = source;
            }

            if (feedback) {
                setLocationFeedback('Pickup area updated from the selected map point.', 'success');
            }
        } catch (error) {
            if (feedback) {
                setLocationFeedback(error.message || 'Unable to resolve street address for the selected point.', 'warning');
            }
        } finally {
            locationIsResolvingAddress = false;
        }
    };

    const shouldShowError = (fieldKey) => hasSubmitted || touchedFields.has(fieldKey);
    const getBookingReference = (booking) => booking?.taskId || booking?.id || '-';
    const getBookingPickupLabel = (booking) => booking?.pickup?.locationName || '-';
    const getBookingDropoffLabel = (booking) => booking?.dropoff?.locationName || '-';
    const getBookingPassengerCount = (booking) => booking?.passengerCount || '-';
    const getBookingPickupTime = (booking) => booking?.scheduledTime || booking?.pickupTime || booking?.startTime || null;
    const getCurrentPickupFallbackPoint = () => {
        if (
            deviceLocationSnapshot
            && Number.isFinite(deviceLocationSnapshot.latitude)
            && Number.isFinite(deviceLocationSnapshot.longitude)
        ) {
            return {
                lat: Number(deviceLocationSnapshot.latitude),
                lng: Number(deviceLocationSnapshot.longitude)
            };
        }

        if (locationTargetPoint && Number.isFinite(locationTargetPoint.lat) && Number.isFinite(locationTargetPoint.lng)) {
            return {
                lat: Number(locationTargetPoint.lat),
                lng: Number(locationTargetPoint.lng)
            };
        }

        if (locationLastResolvedPoint && Number.isFinite(locationLastResolvedPoint.lat) && Number.isFinite(locationLastResolvedPoint.lng)) {
            return {
                lat: Number(locationLastResolvedPoint.lat),
                lng: Number(locationLastResolvedPoint.lng)
            };
        }

        return null;
    };

    const buildBookingPointPayload = async (locationName, options = {}) => {
        const {
            selectedResult = null,
            snapshot = null,
            contextAware = false,
            contextPayload = null,
            fallbackPoint = null,
            allowFallback = false
        } = options;
        const trimmedName = String(locationName || '').trim();

        if (!trimmedName) {
            throw new Error('Location name is missing.');
        }

        if (
            selectedResult
            && Number.isFinite(selectedResult.latitude)
            && Number.isFinite(selectedResult.longitude)
        ) {
            return {
                lat: Number(selectedResult.latitude.toFixed(6)),
                lng: Number(selectedResult.longitude.toFixed(6)),
                locationName: trimmedName
            };
        }

        const searchQueries = buildAddressSearchCandidates(trimmedName, {
            contextPayload: contextAware ? pickupAreaContext : contextPayload
        });
        try {
            const result = await searchLocationByAddressCandidates(searchQueries);

            if (contextAware) {
                pickupAreaContext = result;
            }

            return {
                lat: Number(result.latitude.toFixed(6)),
                lng: Number(result.longitude.toFixed(6)),
                locationName: trimmedName
            };
        } catch (error) {
            if (
                snapshot
                && Number.isFinite(snapshot.latitude)
                && Number.isFinite(snapshot.longitude)
            ) {
                return {
                    lat: Number(snapshot.latitude.toFixed(6)),
                    lng: Number(snapshot.longitude.toFixed(6)),
                    locationName: trimmedName
                };
            }

            const inferredFallbackPoint = inferServiceAreaFallbackPoint(trimmedName, contextAware ? pickupAreaContext : contextPayload);
            const effectiveFallbackPoint = (
                fallbackPoint
                && Number.isFinite(fallbackPoint.lat)
                && Number.isFinite(fallbackPoint.lng)
            )
                ? fallbackPoint
                : inferredFallbackPoint;

            if (
                allowFallback
                && effectiveFallbackPoint
                && Number.isFinite(effectiveFallbackPoint.lat)
                && Number.isFinite(effectiveFallbackPoint.lng)
            ) {
                return {
                    lat: Number(effectiveFallbackPoint.lat.toFixed(6)),
                    lng: Number(effectiveFallbackPoint.lng.toFixed(6)),
                    locationName: trimmedName
                };
            }

            throw error;
        }
    };

    class LiveMovingAverageFilter {
        constructor(windowSize = 4) {
            this.windowSize = windowSize;
            this.samples = [];
        }

        reset() {
            this.samples = [];
        }

        update(point) {
            this.samples.push(point);

            if (this.samples.length > this.windowSize) {
                this.samples.shift();
            }

            const total = this.samples.reduce((accumulator, sample) => ({
                lat: accumulator.lat + sample.lat,
                lng: accumulator.lng + sample.lng
            }), { lat: 0, lng: 0 });

            return {
                lat: total.lat / this.samples.length,
                lng: total.lng / this.samples.length
            };
        }
    }

    class LiveScalarKalmanFilter {
        constructor({ processNoise = 1e-5, estimateError = 1 } = {}) {
            this.processNoise = processNoise;
            this.estimateError = estimateError;
            this.value = null;
        }

        reset() {
            this.value = null;
            this.estimateError = 1;
        }

        update(measurement, measurementNoise) {
            if (this.value === null) {
                this.value = measurement;
                return this.value;
            }

            const predictionError = this.estimateError + this.processNoise;
            const gain = predictionError / (predictionError + measurementNoise);
            this.value = this.value + (gain * (measurement - this.value));
            this.estimateError = (1 - gain) * predictionError;
            return this.value;
        }
    }

    class LivePositionKalmanFilter {
        constructor() {
            this.latitude = new LiveScalarKalmanFilter({ processNoise: 1e-7 });
            this.longitude = new LiveScalarKalmanFilter({ processNoise: 1e-7 });
        }

        reset() {
            this.latitude.reset();
            this.longitude.reset();
        }

        update(sample) {
            const latNoise = Math.max(sample.accuracy / 111320, 0.000001);
            const lngNoise = Math.max(sample.accuracy / (111320 * Math.max(Math.cos((sample.lat * Math.PI) / 180), 0.2)), 0.000001);

            return {
                lat: this.latitude.update(sample.lat, latNoise * latNoise),
                lng: this.longitude.update(sample.lng, lngNoise * lngNoise)
            };
        }
    }

    const liveMovingAverageFilter = new LiveMovingAverageFilter(GPS_MOVING_AVERAGE_WINDOW);
    const liveHybridAverageFilter = new LiveMovingAverageFilter(GPS_HYBRID_WINDOW);
    const liveKalmanFilter = new LivePositionKalmanFilter();

    const formatGpsMeters = (value) => Number.isFinite(value) ? `${Math.round(value)} m` : '-';
    const formatGpsSpeed = (value) => Number.isFinite(value) ? `${(value * 3.6).toFixed(1)} km/h` : '-';
    const formatGpsHeading = (value) => Number.isFinite(value) ? `${Math.round(value)} deg` : '-';
    const formatGpsPoint = (point) => point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : '-';
    const clampGpsValue = (value, min, max) => Math.min(Math.max(value, min), max);
    const markProgrammaticMapMove = (durationMs = 1200) => {
        locationProgrammaticMoveUntil = Date.now() + durationMs;
    };
    const isProgrammaticMapMoveActive = () => Date.now() < locationProgrammaticMoveUntil;

    const haversineDistanceMeters = (left, right) => {
        const toRadians = (value) => (value * Math.PI) / 180;
        const earthRadius = 6371000;
        const deltaLat = toRadians(right.lat - left.lat);
        const deltaLng = toRadians(right.lng - left.lng);
        const lat1 = toRadians(left.lat);
        const lat2 = toRadians(right.lat);
        const a = Math.sin(deltaLat / 2) ** 2
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

        return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const resetLiveGpsFilters = () => {
        liveMovingAverageFilter.reset();
        liveHybridAverageFilter.reset();
        liveKalmanFilter.reset();
    };

    const trimLiveTrack = (track) => {
        while (track.length > GPS_TRACK_POINT_LIMIT) {
            track.shift();
        }
    };

    const appendLiveTrackPoint = (track, point) => {
        track.push([point.lng, point.lat]);
        trimLiveTrack(track);
    };

    const createLeafletMarker = (className) => {
        return window.L.divIcon({
            className: '',
            html: `<span class="${className}"></span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    };

    const applyManualMapSelection = async (point, options = {}) => {
        const {
            feedback = true,
            preserveMapView = false
        } = options;

        if (!point) {
            return;
        }

        locationLastManualInteractionAt = Date.now();
        locationUserIsPanningMap = false;

        if (locationManualResolveTimer) {
            clearTimeout(locationManualResolveTimer);
            locationManualResolveTimer = null;
        }

        if (isLocationTrackingActive) {
            stopLiveLocationTracking({ clearFeedback: false });
        }

        locationLatestMatchedPoint = null;
        locationTargetPoint = { lat: point.lat, lng: point.lng };
        locationRenderedPoint = { lat: point.lat, lng: point.lng };

        if (locationMarker) {
            locationMarker.setLatLng([point.lat, point.lng]);
        }

        if (locationMatchedMarker) {
            locationMatchedMarker.setOpacity(0);
        }

        if (locationAccuracyCircle) {
            locationAccuracyCircle.setLatLng([point.lat, point.lng]);
            locationAccuracyCircle.setRadius(6);
        }

        if (locationMap && !preserveMapView) {
            markProgrammaticMapMove();
            locationMap.panTo([point.lat, point.lng], {
                animate: true,
                duration: 0.5
            });
        }

        deviceLocationSnapshot = {
            ...(deviceLocationSnapshot || {}),
            latitude: Number(point.lat.toFixed(6)),
            longitude: Number(point.lng.toFixed(6)),
            resolved_address: null,
            full_address: null,
            geocode_source: 'manual_map_adjustment',
            captured_at: new Date().toISOString()
        };

        isPickupAreaUserEdited = false;
        selectedLocationResults.pickupArea = null;
        await resolvePickupAreaFromPoint(point, {
            source: 'manual_map_adjustment',
            feedback,
            force: true,
            autofillInput: true
        });
    };

    const focusMapOnAddressResult = async (result, options = {}) => {
        const { feedback = true, typedValue = '' } = options;

        if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
            return;
        }

        try {
            ensureGpsMap();
        } catch (error) {
            if (feedback) {
                setLocationFeedback(error.message || 'Map could not be loaded for address search.', 'error');
            }
            return;
        }

        gpsTrackerPanel.classList.remove('hidden');

        if (isLocationTrackingActive) {
            stopLiveLocationTracking({ clearFeedback: false });
        }

        const point = {
            lat: Number(result.latitude),
            lng: Number(result.longitude)
        };

        locationLatestMatchedPoint = null;
        locationTargetPoint = point;
        locationRenderedPoint = { ...point };
        locationLastResolvedPoint = { ...point };
        locationLastResolvedAt = Date.now();

        if (locationMarker) {
            locationMarker.setLatLng([point.lat, point.lng]);
        }

        if (locationMatchedMarker) {
            locationMatchedMarker.setOpacity(0);
        }

        if (locationAccuracyCircle) {
            locationAccuracyCircle.setLatLng([point.lat, point.lng]);
            locationAccuracyCircle.setRadius(8);
        }

        if (locationMap) {
            markProgrammaticMapMove();
            locationMap.setView([point.lat, point.lng], 18, {
                animate: true
            });
        }

        const typedPickupValue = String(typedValue || fields.pickupArea.value || '').trim();
        const pickupLabel = buildResolvedPickupLabel(result) || typedPickupValue;

        pickupAreaContext = result;
        selectedLocationResults.pickupArea = result;
        deviceLocationSnapshot = {
            ...(deviceLocationSnapshot || {}),
            latitude: Number(point.lat.toFixed(6)),
            longitude: Number(point.lng.toFixed(6)),
            accuracy: null,
            resolved_address: pickupLabel || buildCoordinateLabel(point.lat, point.lng),
            full_address: result.full_address || result.display_address || pickupLabel || buildCoordinateLabel(point.lat, point.lng),
            geocode_source: 'forward_geocode_search',
            captured_at: new Date().toISOString()
        };

        if (feedback) {
            setLocationFeedback('Map moved to the typed address. Your typed pickup text was kept as entered.', 'success');
        }
    };

    const syncPickupAreaToMap = async (options = {}) => {
        const { feedback = true } = options;
        const query = fields.pickupArea.value.trim();
        if (query.length < 4) {
            return null;
        }

        try {
            if (feedback) {
                setLocationFeedback('Searching the typed address on the map...', 'info');
            }
            const result = await searchLocationByAddressCandidates(
                buildAddressSearchCandidates(query, {
                    contextPayload: pickupAreaContext
                })
            );
            await focusMapOnAddressResult(result, {
                feedback,
                typedValue: query
            });
            return result;
        } catch (error) {
            const fallbackPoint = getCurrentPickupFallbackPoint();

            if (fallbackPoint || pickupAreaContext) {
                if (feedback) {
                    setLocationFeedback(
                        'The map could not pin the exact typed address yet, but your typed pickup will still be kept and used.',
                        'info'
                    );
                }
                return null;
            }

            if (feedback) {
                setLocationFeedback(error.message || 'Unable to find that typed address on the map.', 'warning');
            }
            return null;
        }
    };

    const syncDropoffPointFromText = async (options = {}) => {
        const { feedback = false } = options;
        const query = fields.dropoffPoint.value.trim();

        if (query.length < 4) {
            clearSelectedLocationResult('dropoffPoint');
            return null;
        }

        try {
            const result = await searchLocationByAddressCandidates(
                buildAddressSearchCandidates(query, {
                    contextPayload: getSuggestionContextPayload('dropoffPoint')
                })
            );
            selectedLocationResults.dropoffPoint = result;
            return result;
        } catch (error) {
            clearSelectedLocationResult('dropoffPoint');
            if (feedback) {
                setLocationFeedback(error.message || 'Unable to pin the drop-off address yet.', 'warning');
            }
            return null;
        }
    };

    const ensureGpsMap = () => {
        if (!window.L) {
            throw new Error('Leaflet could not be loaded.');
        }

        gpsTrackerPanel.classList.remove('hidden');

        if (locationMap) {
            window.setTimeout(() => locationMap.invalidateSize(), 50);
            return;
        }

        locationMap = window.L.map(gpsMapContainer, {
            zoomControl: true,
            attributionControl: true
        }).setView([16.0471, 108.2068], 17);

        window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(locationMap);

        locationRawTrackLine = window.L.polyline([], {
            color: '#f97316',
            weight: 3,
            opacity: 0.35,
            dashArray: '4 6'
        }).addTo(locationMap);

        locationFilteredTrackLine = window.L.polyline([], {
            color: '#ff1f4f',
            weight: 4,
            opacity: 0.92
        }).addTo(locationMap);

        locationMatchedTrackLine = window.L.polyline([], {
            color: '#10b981',
            weight: 4,
            opacity: 0.85
        }).addTo(locationMap);

        locationAccuracyCircle = window.L.circle([16.0471, 108.2068], {
            radius: 0,
            color: '#ff1f4f',
            fillColor: '#ff1f4f',
            fillOpacity: 0.12,
            weight: 1
        }).addTo(locationMap);

        locationMarker = window.L.marker([16.0471, 108.2068], {
            icon: createLeafletMarker('gps-device-marker'),
            draggable: true
        }).addTo(locationMap);

        locationMatchedMarker = window.L.marker([16.0471, 108.2068], {
            icon: createLeafletMarker('gps-road-marker'),
            opacity: 0
        }).addTo(locationMap);

        locationMarker.on('dragstart', () => {
            locationLastManualInteractionAt = Date.now();
            if (isLocationTrackingActive) {
                stopLiveLocationTracking({ clearFeedback: false });
                setLocationFeedback('GPS tracking paused. Drag the marker to adjust the pickup point manually.', 'info');
            }
        });

        locationMarker.on('dragend', async (event) => {
            const markerPoint = event.target.getLatLng();
            await applyManualMapSelection({
                lat: markerPoint.lat,
                lng: markerPoint.lng
            }, {
                preserveMapView: true
            });
        });

        locationMap.on('click', async (event) => {
            locationLastManualInteractionAt = Date.now();
            await applyManualMapSelection({
                lat: event.latlng.lat,
                lng: event.latlng.lng
            }, {
                preserveMapView: true
            });
        });

        locationMap.on('movestart', () => {
            if (isProgrammaticMapMoveActive()) {
                return;
            }

            locationUserIsPanningMap = true;
            locationLastManualInteractionAt = Date.now();

            if (isLocationTrackingActive) {
                stopLiveLocationTracking({ clearFeedback: false });
                setLocationFeedback('GPS tracking paused. Move the map until the center pin sits on your exact pickup point.', 'info');
            }
        });

        locationMap.on('move', () => {
            if (!locationUserIsPanningMap || isProgrammaticMapMoveActive() || !locationMarker) {
                return;
            }

            const center = locationMap.getCenter();
            locationMarker.setLatLng(center);
        });

        locationMap.on('moveend', () => {
            if (!locationUserIsPanningMap || isProgrammaticMapMoveActive()) {
                return;
            }

            const center = locationMap.getCenter();
            if (locationManualResolveTimer) {
                clearTimeout(locationManualResolveTimer);
            }

            locationManualResolveTimer = window.setTimeout(() => {
                applyManualMapSelection({
                    lat: center.lat,
                    lng: center.lng
                }, {
                    feedback: true,
                    preserveMapView: true
                });
            }, 180);
        });
    };

    const redrawGpsMap = () => {
        if (!locationMap) {
            return;
        }

        locationRawTrackLine.setLatLngs(locationRawTrack.map(([lng, lat]) => [lat, lng]));
        locationFilteredTrackLine.setLatLngs(locationFilteredTrack.map(([lng, lat]) => [lat, lng]));
        locationMatchedTrackLine.setLatLngs(locationMatchedTrack.map(([lng, lat]) => [lat, lng]));
    };

    const resetLiveGpsState = () => {
        locationTargetPoint = null;
        locationRenderedPoint = null;
        locationLastAcceptedSample = null;
        locationLatestSample = null;
        locationLatestFilteredPoint = null;
        locationLatestMatchedPoint = null;
        locationLastCameraUpdateAt = 0;
        locationLastMatchRequestAt = 0;
        locationIsMatchingRoad = false;
        locationUserIsPanningMap = false;
        locationRawSamples.length = 0;
        locationRawTrack.length = 0;
        locationFilteredTrack.length = 0;
        locationMatchedTrack.length = 0;
        resetLiveGpsFilters();
        redrawGpsMap();
    };

    const buildLiveDeviceLocationSnapshot = ({ sample, filteredPoint, matchedPoint }) => {
        const finalPoint = matchedPoint || filteredPoint || sample;
        const coordinateLabel = buildCoordinateLabel(finalPoint.lat, finalPoint.lng);

        return {
            latitude: Number(finalPoint.lat.toFixed(6)),
            longitude: Number(finalPoint.lng.toFixed(6)),
            accuracy: Number.isFinite(sample.accuracy) ? Math.round(sample.accuracy) : null,
            resolved_address: coordinateLabel,
            full_address: `${coordinateLabel}${matchedPoint ? ' | Road snapped' : ' | Filtered GPS'}`,
            geocode_source: matchedPoint ? 'osrm_match' : 'leaflet_gps_filter',
            captured_at: new Date(sample.timestamp).toISOString(),
            raw_latitude: Number(sample.lat.toFixed(6)),
            raw_longitude: Number(sample.lng.toFixed(6)),
            speed_mps: Number.isFinite(sample.speed) ? Number(sample.speed.toFixed(2)) : null,
            heading_deg: Number.isFinite(sample.heading) ? Math.round(sample.heading) : null,
            filter_mode: GPS_FILTER_MODE
        };
    };

    const normalizeLiveGpsPosition = (position) => ({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp || Date.now()
    });

    const acceptLiveGpsSample = (sample) => {
        if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lng)) {
            return { accepted: false, reason: 'GPS sample is invalid.' };
        }

        if (locationLastAcceptedSample && sample.timestamp <= locationLastAcceptedSample.timestamp) {
            return { accepted: false, reason: 'Ignored an older GPS sample.' };
        }

        if (locationLastAcceptedSample) {
            const distance = haversineDistanceMeters(locationLastAcceptedSample, sample);
            const deltaSeconds = Math.max((sample.timestamp - locationLastAcceptedSample.timestamp) / 1000, 1);
            const impliedSpeed = distance / deltaSeconds;

            if (sample.accuracy > GPS_MAX_ACCEPTED_ACCURACY_METERS && locationLastAcceptedSample.accuracy < sample.accuracy) {
                return { accepted: false, reason: `Ignored low-confidence fix (${Math.round(sample.accuracy)} m).` };
            }

            if (impliedSpeed > GPS_MAX_REASONABLE_SPEED_MPS && sample.accuracy > 25) {
                return { accepted: false, reason: 'Ignored a sudden GPS jump.' };
            }
        }

        return { accepted: true };
    };

    const getLiveFilteredPoint = (sample) => {
        const rawPoint = { lat: sample.lat, lng: sample.lng };
        const averagePoint = liveMovingAverageFilter.update(rawPoint);
        const kalmanPoint = liveKalmanFilter.update(sample);
        const hybridPoint = liveHybridAverageFilter.update(kalmanPoint);

        if (GPS_FILTER_MODE === 'raw') {
            return rawPoint;
        }

        if (GPS_FILTER_MODE === 'moving-average') {
            return averagePoint;
        }

        if (GPS_FILTER_MODE === 'kalman') {
            return kalmanPoint;
        }

        return hybridPoint;
    };

    const setLiveGpsTargetPoint = (point) => {
        locationTargetPoint = { lat: point.lat, lng: point.lng };

        if (!locationRenderedPoint) {
            locationRenderedPoint = { ...locationTargetPoint };
            if (locationMarker) {
                locationMarker.setLatLng([locationRenderedPoint.lat, locationRenderedPoint.lng]);
            }
        }
    };

    const maybeUpdateGpsCamera = (point) => {
        if (!locationMap) {
            return;
        }

        if ((Date.now() - locationLastManualInteractionAt) < 4500) {
            return;
        }

        const now = Date.now();
        if (!locationLastCameraUpdateAt) {
            locationLastCameraUpdateAt = now;
            markProgrammaticMapMove(900);
            locationMap.setView([point.lat, point.lng], 18, { animate: false });
            return;
        }

        if (now - locationLastCameraUpdateAt < GPS_CAMERA_UPDATE_INTERVAL_MS) {
            return;
        }

        locationLastCameraUpdateAt = now;
        markProgrammaticMapMove(1200);
        locationMap.panTo([point.lat, point.lng], {
            animate: true,
            duration: 0.9
        });
    };

    const ensureLiveGpsAnimationLoop = () => {
        if (locationAnimationFrameId !== null) {
            return;
        }

        const tick = () => {
            if (locationTargetPoint && locationMarker) {
                if (!locationRenderedPoint) {
                    locationRenderedPoint = { ...locationTargetPoint };
                } else {
                    locationRenderedPoint = {
                        lat: locationRenderedPoint.lat + ((locationTargetPoint.lat - locationRenderedPoint.lat) * GPS_MARKER_LERP),
                        lng: locationRenderedPoint.lng + ((locationTargetPoint.lng - locationRenderedPoint.lng) * GPS_MARKER_LERP)
                    };
                }

                locationMarker.setLatLng([locationRenderedPoint.lat, locationRenderedPoint.lng]);
                maybeUpdateGpsCamera(locationRenderedPoint);
            }

            if (!isLocationTrackingActive && !locationTargetPoint) {
                locationAnimationFrameId = null;
                return;
            }

            locationAnimationFrameId = window.requestAnimationFrame(tick);
        };

        locationAnimationFrameId = window.requestAnimationFrame(tick);
    };

    const updateGpsAccuracyCircle = (point, accuracy) => {
        if (!locationAccuracyCircle) {
            return;
        }

        locationAccuracyCircle.setLatLng([point.lat, point.lng]);
        locationAccuracyCircle.setRadius(Number.isFinite(accuracy) ? accuracy : 0);
    };

    const scheduleSlowGpsUpdateWarning = () => {
        if (locationSlowUpdateTimer) {
            clearTimeout(locationSlowUpdateTimer);
        }

        locationSlowUpdateTimer = window.setTimeout(() => {
            if (isLocationTrackingActive) {
                setLocationFeedback('GPS updates are slow right now. Move to a more open area or keep the phone steady for a few seconds.', 'warning');
            }
        }, GPS_SLOW_UPDATE_AFTER_MS);
    };

    const requestFreeRoadSnap = async () => {
        if (locationIsMatchingRoad || locationRawSamples.length < 2) {
            return null;
        }

        const now = Date.now();
        if (now - locationLastMatchRequestAt < GPS_MATCH_INTERVAL_MS) {
            return null;
        }

        const samples = locationRawSamples.slice(-GPS_MATCH_POINT_LIMIT);
        const coordinateString = samples.map((sample) => `${sample.lng},${sample.lat}`).join(';');
        const radiuses = samples.map((sample) => clampGpsValue(Math.round(sample.accuracy || 15), 5, 25)).join(';');
        locationIsMatchingRoad = true;
        locationLastMatchRequestAt = now;

        try {
            const response = await fetch(`${GPS_OSRM_MATCH_URL}${coordinateString}?overview=full&geometries=geojson&radiuses=${radiuses}&tidy=true`);
            const result = await parseResponse(response);

            if (!response.ok || result.code !== 'Ok') {
                throw new Error(result.message || 'Road snap is unavailable.');
            }

            const tracepoints = Array.isArray(result.tracepoints) ? result.tracepoints : [];
            const matchings = Array.isArray(result.matchings) ? result.matchings : [];
            const latestTracepoint = [...tracepoints].reverse().find(Boolean);

            locationMatchedTrack.length = 0;
            if (matchings[0]?.geometry?.coordinates) {
                matchings[0].geometry.coordinates.forEach((coordinate) => {
                    locationMatchedTrack.push(coordinate);
                });
                trimLiveTrack(locationMatchedTrack);
            }

            redrawGpsMap();

            if (!latestTracepoint || !Array.isArray(latestTracepoint.location)) {
                return null;
            }

            return {
                lng: latestTracepoint.location[0],
                lat: latestTracepoint.location[1]
            };
        } catch (error) {
            setLocationFeedback(`GPS is live, but road snap is temporarily unavailable: ${error.message}`, 'warning');
            return null;
        } finally {
            locationIsMatchingRoad = false;
        }
    };

    const applyLiveGpsSample = (sample) => {
        locationLatestSample = sample;
        locationLastAcceptedSample = sample;
        locationRawSamples.push({ ...sample });
        trimLiveTrack(locationRawSamples);
        appendLiveTrackPoint(locationRawTrack, sample);

        const filteredPoint = getLiveFilteredPoint(sample);
        locationLatestFilteredPoint = filteredPoint;
        appendLiveTrackPoint(locationFilteredTrack, filteredPoint);
        redrawGpsMap();

        updateGpsAccuracyCircle(filteredPoint, sample.accuracy);
        setLiveGpsTargetPoint(locationLatestMatchedPoint || filteredPoint);
        ensureLiveGpsAnimationLoop();
        scheduleSlowGpsUpdateWarning();

        deviceLocationSnapshot = buildLiveDeviceLocationSnapshot({
            sample,
            filteredPoint,
            matchedPoint: locationLatestMatchedPoint
        });

        if (sample.accuracy > 35) {
            setLocationFeedback(`Tracking with reduced confidence. Current GPS accuracy is about ${Math.round(sample.accuracy)} m.`, 'warning');
        } else {
            setLocationFeedback('Live GPS tracking is active. The marker is smoothed before it updates the pickup point.', 'success');
        }

        resolvePickupAreaFromPoint(filteredPoint, {
            source: 'live_tracking',
            feedback: false,
            force: shouldForceGpsPickupAutofill,
            autofillInput: shouldForceGpsPickupAutofill || !isPickupAreaUserEdited
        });

        requestFreeRoadSnap().then((matchedPoint) => {
            if (!matchedPoint) {
                return;
            }

            locationLatestMatchedPoint = matchedPoint;
            locationMatchedMarker.setLatLng([matchedPoint.lat, matchedPoint.lng]);
            locationMatchedMarker.setOpacity(1);
            setLiveGpsTargetPoint(matchedPoint);
            deviceLocationSnapshot = buildLiveDeviceLocationSnapshot({
                sample,
                filteredPoint,
                matchedPoint
            });
            resolvePickupAreaFromPoint(matchedPoint, {
                source: 'osrm_match',
                feedback: false,
                force: true,
                autofillInput: shouldForceGpsPickupAutofill || !isPickupAreaUserEdited
            });
        });
    };

    const handleLiveGpsSuccess = (position) => {
        if (!isLocationTrackingActive) {
            return;
        }

        const sample = normalizeLiveGpsPosition(position);
        const decision = acceptLiveGpsSample(sample);

        if (!decision.accepted) {
            setLocationFeedback(decision.reason, 'warning');
            return;
        }

        setLocationLoadingState(false);
        applyLiveGpsSample(sample);
    };

    const stopLiveLocationTracking = (options = {}) => {
        const { clearFeedback = false } = options;

        if (locationWatchId !== null) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }

        if (locationAnimationFrameId !== null) {
            cancelAnimationFrame(locationAnimationFrameId);
            locationAnimationFrameId = null;
        }

        if (locationSlowUpdateTimer) {
            clearTimeout(locationSlowUpdateTimer);
            locationSlowUpdateTimer = null;
        }

        if (locationManualResolveTimer) {
            clearTimeout(locationManualResolveTimer);
            locationManualResolveTimer = null;
        }

        isLocationTrackingActive = false;
        locationTargetPoint = null;
        locationUserIsPanningMap = false;
        isResolvingLocation = false;
        detectLocationButton.disabled = false;
        detectLocationButton.textContent = 'Use GPS';
        stopLocationButton.classList.add('hidden');

        if (clearFeedback) {
            setLocationFeedback();
        }
    };

    const handleLiveGpsError = (error) => {
        const fallbackMessage = error && error.code === 1
            ? buildLocationPermissionDeniedMessage()
            : error && error.code === 3
                ? 'Location updates are timing out. Move to a clearer outdoor area and tap "Use GPS" again.'
                : 'Unable to get device location. Please stand in an open area and tap "Use GPS" again.';

        setLocationFeedback(fallbackMessage, 'error');
        stopLiveLocationTracking({ clearFeedback: false });
    };

    const startLiveLocationTracking = () => {
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setLocationFeedback('Location requires HTTPS or localhost. Please enter pickup area manually.', 'error');
            return;
        }

        if (!navigator.geolocation || !navigator.geolocation.watchPosition) {
            setLocationFeedback('This browser does not support live location tracking.', 'error');
            return;
        }

        try {
            ensureGpsMap();
        } catch (error) {
            setLocationFeedback(error.message || 'Map could not be loaded for GPS tracking.', 'error');
            return;
        }

        stopLiveLocationTracking({ clearFeedback: false });
        resetLiveGpsState();
        isPickupAreaUserEdited = false;
        shouldForceGpsPickupAutofill = true;
        selectedLocationResults.pickupArea = null;
        gpsTrackerPanel.classList.remove('hidden');
        locationMatchedMarker.setOpacity(0);
        isLocationTrackingActive = true;
        isResolvingLocation = true;
        detectLocationButton.disabled = true;
        detectLocationButton.textContent = 'Locating...';
        stopLocationButton.classList.remove('hidden');
        setLocationFeedback('Starting live GPS tracking. Keep the phone steady for the best first lock.', 'info');

        locationWatchId = navigator.geolocation.watchPosition(
            handleLiveGpsSuccess,
            handleLiveGpsError,
            GPS_WATCH_OPTIONS
        );
    };

    const updateScheduledFieldState = () => {
        const isScheduled = fields.pickupTimeMode.value === 'scheduled';
        fields.startTime.disabled = !isScheduled;
        fields.startTime.required = isScheduled;
        scheduledTimeGroup.classList.toggle('hidden', !isScheduled);
    };

    const showFieldState = (fieldKey, input, errorElement, isValid, message = '') => {
        const showError = !isValid && shouldShowError(fieldKey);
        input.classList.toggle('input-error', showError);
        errorElement.classList.toggle('hidden', !showError);
        if (message) {
            errorElement.textContent = message;
        }
        return isValid;
    };

    const validateForm = () => {
        const nameValid = showFieldState(
            'name',
            fields.name,
            errors.name,
            fields.name.value.trim().length >= 2
        );

        const phoneValid = showFieldState(
            'phone',
            fields.phone,
            errors.phone,
            !fields.phone.value.trim() || PHONE_REGEX.test(fields.phone.value.trim()),
            'Please enter a valid phone or leave it blank.'
        );

        const pickupAreaValid = showFieldState(
            'pickupArea',
            fields.pickupArea,
            errors.pickupArea,
            fields.pickupArea.value.trim().length >= 2,
            'Please enter pickup area.'
        );

        const dropoffValid = showFieldState(
            'dropoffPoint',
            fields.dropoffPoint,
            errors.dropoffPoint,
            fields.dropoffPoint.value.trim().length >= 2,
            'Please enter drop-off point.'
        );

        const isScheduled = fields.pickupTimeMode.value === 'scheduled';
        const scheduledDate = new Date(fields.startTime.value);
        const timeValid = showFieldState(
            'startTime',
            fields.startTime,
            errors.startTime,
            !isScheduled || (Boolean(fields.startTime.value) && !Number.isNaN(scheduledDate.getTime()) && scheduledDate > new Date()),
            'Please choose a valid future time.'
        );

        return nameValid && phoneValid && pickupAreaValid && dropoffValid && timeValid;
    };

    const setHistoryFeedback = (message = '', type = 'info') => {
        if (!message) {
            historyFeedback.className = 'history-feedback hidden';
            historyFeedback.textContent = '';
            return;
        }

        historyFeedback.textContent = message;
        historyFeedback.className = `history-feedback history-feedback-${type}`;
    };

    const renderHistoryEmpty = (title, message) => {
        bookingHistoryList.innerHTML = `
            <article class="history-empty">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(message)}</p>
            </article>
        `;
    };

    const renderHistoryList = (items) => {
        if (!items.length) {
            renderHistoryEmpty('No bookings found', 'No recent booking for this phone.');
            return;
        }

        bookingHistoryList.innerHTML = items.map((booking) => `
            <article class="history-card">
                <div class="history-card-head">
                    <div>
                        <p class="history-card-label">Task ID</p>
                        <strong>${escapeHtml(getBookingReference(booking))}</strong>
                    </div>
                </div>
                <div class="history-card-grid">
                    <div class="history-card-item">
                        <span>Pickup</span>
                        <strong>${escapeHtml(getBookingPickupLabel(booking))}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Drop-off</span>
                        <strong>${escapeHtml(getBookingDropoffLabel(booking))}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Guests</span>
                        <strong>${escapeHtml(getBookingPassengerCount(booking))}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Time</span>
                        <strong>${escapeHtml(formatDisplayDateTime(getBookingPickupTime(booking)))}</strong>
                    </div>
                </div>
            </article>
        `).join('');
    };

    const setHistoryLoading = (isLoading) => {
        loadHistoryButton.disabled = isLoading;
        loadHistoryButton.textContent = isLoading ? 'Loading...' : 'Load history';
    };

    const setHistoryPanelState = (isOpen) => {
        isHistoryPanelOpen = isOpen;
        historyPanel.classList.toggle('hidden', !isOpen);
        toggleHistoryButton.textContent = isOpen ? 'Hide history' : 'View history';

        if (isOpen) {
            historyPhoneInput.focus();
        }
    };

    const loadBookingHistory = async (phone) => {
        const normalizedPhone = phone.trim();

        if (!PHONE_REGEX.test(normalizedPhone)) {
            setHistoryFeedback('Enter a valid phone.', 'error');
            renderHistoryEmpty('History unavailable', 'Please enter the same phone used for booking.');
            return;
        }

        setHistoryLoading(true);
        setHistoryFeedback('Loading...', 'info');

        try {
            const response = await fetch(`/api/bookings?phone=${encodeURIComponent(normalizedPhone)}&limit=${HISTORY_LIMIT}`);
            const result = await parseResponse(response);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to load history.');
            }

            renderHistoryList(result.data.bookings || []);
            setHistoryFeedback(`Found ${result.data.count} booking(s).`, 'success');
        } catch (error) {
            setHistoryFeedback(error.message || 'Unable to load history.', 'error');
            renderHistoryEmpty('History unavailable', 'Please try again.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const scheduleHistoryLookup = () => {
        if (historyLookupTimer) {
            clearTimeout(historyLookupTimer);
        }

        const phone = historyPhoneInput.value.trim();
        if (!phone) {
            renderHistoryEmpty('No history loaded yet', 'Enter a phone number to check bookings.');
            setHistoryFeedback();
            return;
        }

        if (!PHONE_REGEX.test(phone)) {
            setHistoryFeedback('Keep typing your phone.', 'info');
            return;
        }

        historyLookupTimer = window.setTimeout(() => {
            loadBookingHistory(phone);
        }, HISTORY_AUTOLOAD_DELAY);
    };

    const openOverlay = ({ state, kicker, title, message, bookingId = '', actionLabel = '' }) => {
        requestOverlay.classList.remove('hidden');
        requestCard.classList.remove('is-loading', 'is-success', 'is-error');
        requestCard.classList.add(`is-${state}`);
        requestSpinner.classList.toggle('hidden', state !== 'loading');
        requestKicker.textContent = kicker;
        requestTitle.textContent = title;
        requestMessage.textContent = message;

        if (bookingId) {
            bookingIdSpan.textContent = bookingId;
            requestBookingLine.classList.remove('hidden');
        } else {
            requestBookingLine.classList.add('hidden');
            bookingIdSpan.textContent = '';
        }

        if (actionLabel) {
            requestAction.textContent = actionLabel;
            requestAction.classList.remove('hidden');
        } else {
            requestAction.classList.add('hidden');
        }
    };

    const closeOverlay = () => {
        requestOverlay.classList.add('hidden');
    };

    const redirectToStatusPage = (taskId) => {
        if (!taskId) {
            return;
        }

        window.setTimeout(() => {
            window.location.href = `/status.html?task_id=${encodeURIComponent(taskId)}`;
        }, STATUS_REDIRECT_DELAY_MS);
    };

    const setLoadingState = (isLoading) => {
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading ? 'Sending...' : 'Book Now';
    };

    requestAction.addEventListener('click', () => {
        closeOverlay();
    });

    toggleHistoryButton.addEventListener('click', () => {
        setHistoryPanelState(!isHistoryPanelOpen);
    });

    loadHistoryButton.addEventListener('click', () => {
        loadBookingHistory(historyPhoneInput.value);
    });

    requestOverlay.addEventListener('click', (event) => {
        if (event.target === requestOverlay && !requestCard.classList.contains('is-loading')) {
            closeOverlay();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hasSubmitted = true;

        if (!validateForm()) {
            return;
        }

        saveCache();
        setLoadingState(true);
        openOverlay({
            state: 'loading',
            kicker: 'Sending',
            title: 'Creating booking',
            message: 'Please wait a moment.'
        });

        const isScheduled = fields.pickupTimeMode.value === 'scheduled';

        try {
            if (!isLocationTrackingActive && fields.pickupArea.value.trim().length >= 4) {
                await syncPickupAreaToMap({ feedback: false });
            }
            if (!selectedLocationResults.dropoffPoint && fields.dropoffPoint.value.trim().length >= 4) {
                await syncDropoffPointFromText();
            }

            const pickup = await buildBookingPointPayload(fields.pickupArea.value, {
                selectedResult: selectedLocationResults.pickupArea,
                snapshot: deviceLocationSnapshot,
                contextAware: true,
                fallbackPoint: getCurrentPickupFallbackPoint(),
                allowFallback: true
            });
            const dropoff = await buildBookingPointPayload(fields.dropoffPoint.value, {
                selectedResult: selectedLocationResults.dropoffPoint,
                contextPayload: pickupAreaContext,
                fallbackPoint: getCurrentPickupFallbackPoint() || inferServiceAreaFallbackPoint(fields.pickupArea.value, pickupAreaContext),
                allowFallback: true
            });
            const bookingData = {
                taskId: buildTaskId(),
                guestName: fields.name.value.trim(),
                phone: fields.phone.value.trim() || null,
                passengerCount: Number.parseInt(fields.passengerCount.value, 10) || 1,
                bookingType: isScheduled ? 'SCHEDULED' : 'NOW',
                scheduledTime: isScheduled ? new Date(fields.startTime.value).toISOString() : null,
                pickup: {
                    lat: pickup.lat,
                    lng: pickup.lng,
                    locationName: pickup.locationName
                },
                dropoff: {
                    lat: dropoff.lat,
                    lng: dropoff.lng,
                    locationName: dropoff.locationName
                }
            };

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `${bookingData.phone || bookingData.guestName}-${Date.now()}`
                },
                body: JSON.stringify(bookingData)
            });

            const result = await parseResponse(response);

            if (!response.ok) {
                throw new Error(result.message || 'Unable to create booking.');
            }

            const acceptedTaskId = result?.taskId || bookingData.taskId;
            const acceptedStatus = String(result?.status || '').trim();
            const acceptedMessage = String(result?.message || '').trim() || 'Booking request was accepted by the dispatch server.';

            if (!acceptedTaskId || !acceptedStatus) {
                throw new Error('Dispatch server returned an invalid booking response.');
            }

            localStorage.removeItem(CACHE_KEY);
            form.reset();
            deviceLocationSnapshot = null;
            clearSelectedLocationResult('pickupArea');
            clearSelectedLocationResult('dropoffPoint');
            hideLocationSuggestions('pickupArea');
            hideLocationSuggestions('dropoffPoint');
            loadCache();
            fields.passengerCount.value = '1';
            fields.pickupTimeMode.value = 'now';
            setDateDefaults();
            updateScheduledFieldState();
            updateSummary();

            openOverlay({
                state: 'success',
                kicker: 'Queued',
                title: acceptedStatus,
                message: acceptedMessage,
                bookingId: acceptedTaskId,
                actionLabel: 'View status'
            });

            requestAction.onclick = () => {
                window.location.href = `/status.html?task_id=${encodeURIComponent(acceptedTaskId)}`;
            };

            redirectToStatusPage(acceptedTaskId);

            if (bookingData.phone && isHistoryPanelOpen && historyPhoneInput.value.trim() === bookingData.phone) {
                await loadBookingHistory(historyPhoneInput.value);
            }
        } catch (error) {
            openOverlay({
                state: 'error',
                kicker: 'Failed',
                title: 'Booking error',
                message: error.message || 'Please try again.',
                actionLabel: 'Close'
            });

            requestAction.onclick = () => {
                closeOverlay();
            };
        } finally {
            setLoadingState(false);
        }
    });

    [
        ['name', fields.name],
        ['phone', fields.phone],
        ['pickupArea', fields.pickupArea],
        ['dropoffPoint', fields.dropoffPoint],
        ['startTime', fields.startTime]
    ].forEach(([fieldKey, input]) => {
        input.addEventListener('input', () => {
            touchedFields.add(fieldKey);
            if (fieldKey === 'pickupArea') {
                isPickupAreaUserEdited = true;
                shouldForceGpsPickupAutofill = false;
            }
            if (fieldKey === 'pickupArea' || fieldKey === 'dropoffPoint') {
                clearSelectedLocationResult(fieldKey);
                scheduleLocationSuggestions(fieldKey, input.value);
            }
            updateSummary();
            validateForm();
            saveCache();
        });

        input.addEventListener('change', () => {
            touchedFields.add(fieldKey);
            if (fieldKey === 'pickupArea') {
                isPickupAreaUserEdited = true;
                shouldForceGpsPickupAutofill = false;
            }
            if (fieldKey === 'pickupArea' || fieldKey === 'dropoffPoint') {
                clearSelectedLocationResult(fieldKey);
            }
            updateSummary();
            validateForm();
            saveCache();
        });
    });

    fields.pickupArea.addEventListener('keydown', async (event) => {
        const pickupSuggestionState = suggestionState.pickupArea;
        if (pickupSuggestionState.items.length) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const nextIndex = pickupSuggestionState.activeIndex < 0
                    ? 0
                    : (pickupSuggestionState.activeIndex + delta + pickupSuggestionState.items.length) % pickupSuggestionState.items.length;
                setActiveSuggestionIndex('pickupArea', nextIndex);
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                if (await selectActiveLocationSuggestion('pickupArea')) {
                    return;
                }
            }

            if (event.key === 'Escape') {
                hideLocationSuggestions('pickupArea');
                return;
            }
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        touchedFields.add('pickupArea');
        updateSummary();
        validateForm();
        saveCache();
        await syncPickupAreaToMap();
    });

    fields.dropoffPoint.addEventListener('keydown', async (event) => {
        const dropoffSuggestionState = suggestionState.dropoffPoint;
        if (dropoffSuggestionState.items.length) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const nextIndex = dropoffSuggestionState.activeIndex < 0
                    ? 0
                    : (dropoffSuggestionState.activeIndex + delta + dropoffSuggestionState.items.length) % dropoffSuggestionState.items.length;
                setActiveSuggestionIndex('dropoffPoint', nextIndex);
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                if (await selectActiveLocationSuggestion('dropoffPoint')) {
                    return;
                }
            }

            if (event.key === 'Escape') {
                hideLocationSuggestions('dropoffPoint');
                return;
            }
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        touchedFields.add('dropoffPoint');
        updateSummary();
        validateForm();
        saveCache();
        await syncDropoffPointFromText();
    });

    fields.pickupArea.addEventListener('blur', async () => {
        scheduleSuggestionHide('pickupArea');
        touchedFields.add('pickupArea');
        updateSummary();
        validateForm();
        saveCache();
        await syncPickupAreaToMap();
    });

    fields.pickupArea.addEventListener('focus', () => {
        clearSuggestionBlurTimer('pickupArea');
        if (suggestionState.pickupArea.items.length) {
            renderLocationSuggestions('pickupArea');
            return;
        }
        if (fields.pickupArea.value.trim().length >= LOCATION_SUGGESTION_MIN_QUERY_LENGTH) {
            scheduleLocationSuggestions('pickupArea', fields.pickupArea.value);
        }
    });

    fields.dropoffPoint.addEventListener('blur', async () => {
        scheduleSuggestionHide('dropoffPoint');
        touchedFields.add('dropoffPoint');
        updateSummary();
        validateForm();
        saveCache();
        await syncDropoffPointFromText();
    });

    fields.dropoffPoint.addEventListener('focus', () => {
        clearSuggestionBlurTimer('dropoffPoint');
        if (suggestionState.dropoffPoint.items.length) {
            renderLocationSuggestions('dropoffPoint');
            return;
        }
        if (fields.dropoffPoint.value.trim().length >= LOCATION_SUGGESTION_MIN_QUERY_LENGTH) {
            scheduleLocationSuggestions('dropoffPoint', fields.dropoffPoint.value);
        }
    });

    fields.pickupTimeMode.addEventListener('change', () => {
        touchedFields.add('startTime');
        updateScheduledFieldState();
        validateForm();
        saveCache();
    });

    detectLocationButton.addEventListener('click', () => {
        startLiveLocationTracking();
    });

    stopLocationButton.addEventListener('click', () => {
        stopLiveLocationTracking({ clearFeedback: false });
        setLocationFeedback('Live GPS tracking has stopped. Tap "Use GPS" whenever you want a fresh lock.', 'info');
    });

    historyPhoneInput.addEventListener('input', scheduleHistoryLookup);
    suggestionMenus.pickupArea?.addEventListener('mousedown', () => {
        clearSuggestionBlurTimer('pickupArea');
    });
    suggestionMenus.pickupArea?.addEventListener('click', handleSuggestionMenuClick);
    suggestionMenus.dropoffPoint?.addEventListener('mousedown', () => {
        clearSuggestionBlurTimer('dropoffPoint');
    });
    suggestionMenus.dropoffPoint?.addEventListener('click', handleSuggestionMenuClick);

    window.addEventListener('pagehide', () => {
        stopLiveLocationTracking({ clearFeedback: false });
    });

    loadCache();
    setDateDefaults();
    updateScheduledFieldState();
    updateSummary();
    validateForm();
    setLocationFeedback('Tap "Use GPS" to start live location tracking with smoothing, accuracy filtering, and free road snap.', 'info');
    renderHistoryEmpty('No history loaded yet', 'Enter a phone number to check bookings.');
    setHistoryPanelState(false);
});
