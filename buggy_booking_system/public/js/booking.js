document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-button');
    const contextBanner = document.getElementById('context-banner');
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
    const locationFeedback = document.getElementById('location-feedback');

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

    const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
    const CACHE_KEY = 'buggy-booking-cache-v5';
    const HISTORY_LIMIT = 6;
    const HISTORY_AUTOLOAD_DELAY = 450;
    const STATUS_REDIRECT_DELAY_MS = 900;
    const REVERSE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
    const LOCATION_SAMPLE_WINDOW_MS = 8000;
    const LOCATION_TARGET_ACCURACY_METERS = 20;
    const LOCATION_AUTO_FILL_DELAY_MS = 700;
    let historyLookupTimer = null;
    let isHistoryPanelOpen = false;
    let isResolvingLocation = false;
    let hasSubmitted = false;
    let hasAutoLocationAttempted = false;
    let deviceLocationSnapshot = null;
    const touchedFields = new Set();

    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const formatDisplayDateTime = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value || '-';
        }

        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short'
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
        detectLocationButton.textContent = isLoading ? 'Locating...' : 'Use GPS';
    };

    const buildCoordinateLabel = (latitude, longitude) => `Lat ${latitude}, Lng ${longitude}`;

    const extractLocationName = (payload) => {
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

        return payload.display_name || payload.name || extractLocationName(payload);
    };

    const reverseGeocodeDirect = async (latitude, longitude) => {
        const url = new URL(REVERSE_GEOCODE_ENDPOINT);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('lat', String(latitude));
        url.searchParams.set('lon', String(longitude));
        url.searchParams.set('zoom', '20');
        url.searchParams.set('addressdetails', '1');

        const response = await fetch(url.toString(), {
            headers: {
                'Accept-Language': 'vi,en'
            }
        });

        if (!response.ok) {
            throw new Error('Unable to map your location.');
        }

        return response.json();
    };

    const reverseGeocodeViaServer = async (latitude, longitude) => {
        const response = await fetch(`/api/location/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
        const result = await parseResponse(response);

        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Unable to map your location.');
        }

        return result.data;
    };

    const resolveLocationDetails = async (latitude, longitude) => {
        try {
            const place = await reverseGeocodeViaServer(latitude, longitude);
            return {
                place,
                source: 'server'
            };
        } catch (error) {
            try {
                const place = await reverseGeocodeDirect(latitude, longitude);
                return {
                    place,
                    source: 'browser'
                };
            } catch (innerError) {
                return null;
            }
        }
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

    const getCurrentDevicePosition = async () => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            });
        });
    };

    const getBestDevicePosition = async () => {
        const firstPosition = await getCurrentDevicePosition();

        return new Promise((resolve) => {
            let bestPosition = firstPosition;

            const updateBestPosition = (position) => {
                if (typeof position.coords.accuracy !== 'number') {
                    return;
                }

                if (position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                }
            };

            updateBestPosition(firstPosition);

            if (!navigator.geolocation.watchPosition) {
                resolve(bestPosition);
                return;
            }

            const finish = () => {
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                }
                clearTimeout(timeoutId);
                resolve(bestPosition);
            };

            const timeoutId = window.setTimeout(finish, LOCATION_SAMPLE_WINDOW_MS);
            let watchId = null;

            watchId = navigator.geolocation.watchPosition((position) => {
                updateBestPosition(position);

                if (bestPosition.coords.accuracy <= LOCATION_TARGET_ACCURACY_METERS) {
                    finish();
                }
            }, () => {
                finish();
            }, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: LOCATION_SAMPLE_WINDOW_MS
            });
        });
    };

    const buildDeviceLocationSnapshot = ({ latitude, longitude, accuracy, locationName, fullAddress, source }) => ({
        latitude,
        longitude,
        accuracy,
        resolved_address: locationName || buildCoordinateLabel(latitude, longitude),
        full_address: fullAddress || locationName || buildCoordinateLabel(latitude, longitude),
        geocode_source: source || 'coordinates',
        captured_at: new Date().toISOString()
    });

    const shouldShowError = (fieldKey) => hasSubmitted || touchedFields.has(fieldKey);

    const fillPickupAreaFromDeviceLocation = async (options = {}) => {
        const { automatic = false } = options;

        if (automatic && fields.pickupArea.value.trim()) {
            return;
        }

        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setLocationFeedback('Location requires HTTPS or localhost. Please enter pickup area manually.', 'error');
            return;
        }

        if (!navigator.geolocation) {
            setLocationFeedback('This browser does not support location.', 'error');
            return;
        }

        if (isResolvingLocation) {
            return;
        }

        setLocationLoadingState(true);

        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });

                if (permission.state === 'denied') {
                    setLocationFeedback('Location permission is blocked. Please allow it in the browser and try again.', 'error');
                    return;
                }

                if (permission.state === 'prompt') {
                    setLocationFeedback(automatic
                        ? 'Allow location access so we can auto-fill your pickup area.'
                        : 'Please allow location access when your browser asks.', 'info');
                } else {
                    setLocationFeedback(automatic
                        ? 'Detecting your current location to auto-fill pickup area...'
                        : 'Detecting your current location as accurately as possible...', 'info');
                }
            } else {
                setLocationFeedback(automatic
                    ? 'Allow location access so we can auto-fill your pickup area.'
                    : 'Please allow location access when your browser asks.', 'info');
            }

            const position = await getBestDevicePosition();
            const latitude = Number(position.coords.latitude.toFixed(6));
            const longitude = Number(position.coords.longitude.toFixed(6));
            const accuracy = typeof position.coords.accuracy === 'number'
                ? Math.round(position.coords.accuracy)
                : null;
            const coordinateLabel = buildCoordinateLabel(latitude, longitude);
            const resolvedLocation = await resolveLocationDetails(latitude, longitude);
            const locationName = resolvedLocation ? extractLocationName(resolvedLocation.place) : '';
            const fullAddress = resolvedLocation ? extractFullAddress(resolvedLocation.place) : '';

            deviceLocationSnapshot = buildDeviceLocationSnapshot({
                latitude,
                longitude,
                accuracy,
                locationName,
                fullAddress,
                source: resolvedLocation ? resolvedLocation.source : 'coordinates'
            });

            if (locationName) {
                if (!automatic || !fields.pickupArea.value.trim()) {
                    setPickupAreaValue(locationName);
                }

                const detailLabel = fullAddress && fullAddress !== locationName
                    ? `${locationName} | ${fullAddress}`
                    : locationName;

                setLocationFeedback(`Detected: ${detailLabel}${accuracy ? ` | Accuracy ${accuracy}m` : ''}`, 'success');
                return;
            }

            if (!automatic || !fields.pickupArea.value.trim()) {
                setPickupAreaValue(coordinateLabel);
            }

            setLocationFeedback(`Detected: ${coordinateLabel}${accuracy ? ` | Accuracy ${accuracy}m` : ''}`, 'success');
        } catch (error) {
            const fallbackMessage = error && error.code === 1
                ? 'Location permission was denied. You can enter pickup area manually.'
                : 'Unable to get device location. You can enter pickup area manually.';

            setLocationFeedback(fallbackMessage, 'error');
        } finally {
            setLocationLoadingState(false);
        }
    };

    const tryAutoFillPickupAreaFromDeviceLocation = () => {
        if (hasAutoLocationAttempted || fields.pickupArea.value.trim()) {
            return;
        }

        hasAutoLocationAttempted = true;

        window.setTimeout(() => {
            fillPickupAreaFromDeviceLocation({ automatic: true });
        }, LOCATION_AUTO_FILL_DELAY_MS);
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
            PHONE_REGEX.test(fields.phone.value.trim())
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
                        <p class="history-card-label">Booking ID</p>
                        <strong>${escapeHtml(booking.id)}</strong>
                    </div>
                </div>
                <div class="history-card-grid">
                    <div class="history-card-item">
                        <span>Pickup</span>
                        <strong>${escapeHtml(booking.pickup_area || '-')}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Drop-off</span>
                        <strong>${escapeHtml(booking.dropoff_point || '-')}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Guests</span>
                        <strong>${escapeHtml(booking.passenger_count || '-')}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Time</span>
                        <strong>${escapeHtml(formatDisplayDateTime(booking.pickup_time || booking.start_time))}</strong>
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

    const redirectToStatusPage = (bookingId) => {
        if (!bookingId) {
            return;
        }

        window.setTimeout(() => {
            window.location.href = `/status.html?booking_id=${encodeURIComponent(bookingId)}`;
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
        const bookingData = {
            name: fields.name.value.trim(),
            phone: fields.phone.value.trim(),
            pickup_area: fields.pickupArea.value.trim(),
            dropoff_point: fields.dropoffPoint.value.trim(),
            passenger_count: Number.parseInt(fields.passengerCount.value, 10) || 1,
            pickup_time_mode: fields.pickupTimeMode.value,
            pickup_time: isScheduled ? new Date(fields.startTime.value).toISOString() : new Date().toISOString(),
            device_location: deviceLocationSnapshot ? { ...deviceLocationSnapshot } : null
        };

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `${bookingData.phone}-${Date.now()}`
                },
                body: JSON.stringify(bookingData)
            });

            const result = await parseResponse(response);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to create booking.');
            }

            localStorage.removeItem(CACHE_KEY);
            form.reset();
            deviceLocationSnapshot = null;
            loadCache();
            fields.passengerCount.value = '1';
            fields.pickupTimeMode.value = 'now';
            setDateDefaults();
            updateScheduledFieldState();
            updateSummary();

            openOverlay({
                state: 'success',
                kicker: 'Done',
                title: 'Booking created',
                message: 'Opening booking status page...',
                bookingId: result.data.id,
                actionLabel: 'View status'
            });

            requestAction.onclick = () => {
                window.location.href = `/status.html?booking_id=${encodeURIComponent(result.data.id)}`;
            };

            redirectToStatusPage(result.data.id);

            if (isHistoryPanelOpen && historyPhoneInput.value.trim() === bookingData.phone) {
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
                deviceLocationSnapshot = null;
            }
            updateSummary();
            validateForm();
            saveCache();
        });

        input.addEventListener('change', () => {
            touchedFields.add(fieldKey);
            if (fieldKey === 'pickupArea') {
                deviceLocationSnapshot = null;
            }
            updateSummary();
            validateForm();
            saveCache();
        });
    });

    fields.pickupTimeMode.addEventListener('change', () => {
        touchedFields.add('startTime');
        updateScheduledFieldState();
        validateForm();
        saveCache();
    });

    detectLocationButton.addEventListener('click', () => {
        fillPickupAreaFromDeviceLocation({ automatic: false });
    });

    historyPhoneInput.addEventListener('input', scheduleHistoryLookup);

    loadCache();
    setDateDefaults();
    updateScheduledFieldState();
    updateSummary();
    validateForm();
    renderHistoryEmpty('No history loaded yet', 'Enter a phone number to check bookings.');
    setHistoryPanelState(false);
    contextBanner.classList.add('hidden');

    if (fields.pickupArea.value.trim()) {
        setLocationFeedback('Pickup area is already filled. Tap "Use GPS" if you want to refresh it from your current location.', 'info');
    } else {
        setLocationFeedback('We will try to auto-fill pickup area from your current location. You can also tap "Use GPS".', 'info');
        tryAutoFillPickupAreaFromDeviceLocation();
    }
});
