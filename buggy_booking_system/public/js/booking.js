document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('booking-form');
    const submitButton = document.getElementById('submit-button');
    const contextBanner = document.getElementById('context-banner');
    const pickupLabelDisplay = document.getElementById('pickup-label-display');
    const locationLabelDisplay = document.getElementById('location-label-display');
    const vehicleTypeDisplay = document.getElementById('vehicle-type-display');
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

    const fields = {
        name: document.getElementById('name'),
        phone: document.getElementById('phone'),
        startTime: document.getElementById('start-time'),
        endTime: document.getElementById('end-time'),
        vehicleType: document.getElementById('vehicle-type'),
        pickupLocation: document.getElementById('pickup-location'),
        locationId: document.getElementById('location-id')
    };

    const errors = {
        name: document.getElementById('name-error'),
        phone: document.getElementById('phone-error'),
        startTime: document.getElementById('start-time-error'),
        endTime: document.getElementById('end-time-error'),
        vehicleType: document.getElementById('vehicle-type-error')
    };

    const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
    const CACHE_KEY = 'buggy-booking-cache-v3';
    const DEFAULT_VEHICLE = '4_seats';
    const HISTORY_LIMIT = 6;
    const HISTORY_AUTOLOAD_DELAY = 450;
    let historyLookupTimer = null;
    let isHistoryPanelOpen = false;

    const vehicleLabels = {
        '2_seats': '2 seats',
        '4_seats': '4 seats',
        '6_seats': '6 seats',
        '8_seats': '8 seats'
    };

    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const setDateDefaults = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 15);

        const start = new Date(now);
        start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5);

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 30);

        const minStart = formatDateTimeLocal(new Date());
        fields.startTime.min = minStart;
        fields.endTime.min = minStart;

        if (!fields.startTime.value) {
            fields.startTime.value = formatDateTimeLocal(start);
        }

        if (!fields.endTime.value) {
            fields.endTime.value = formatDateTimeLocal(end);
        }
    };

    const loadCache = () => {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            fields.name.value = cached.name || '';
            fields.phone.value = cached.phone || '';
            fields.vehicleType.value = cached.vehicleType || DEFAULT_VEHICLE;
        } catch (error) {
            localStorage.removeItem(CACHE_KEY);
            fields.vehicleType.value = DEFAULT_VEHICLE;
        }
    };

    const saveCache = () => {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            name: fields.name.value.trim(),
            phone: fields.phone.value.trim(),
            vehicleType: fields.vehicleType.value
        }));
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
            renderHistoryEmpty('No bookings found', 'We could not find any previous bookings for this phone number.');
            return;
        }

        bookingHistoryList.innerHTML = items.map((booking) => `
            <article class="history-card">
                <div class="history-card-head">
                    <div>
                        <p class="history-card-label">Booking ID</p>
                        <strong>${escapeHtml(booking.id)}</strong>
                    </div>
                    <span class="history-vehicle-pill">${escapeHtml(vehicleLabels[booking.vehicle_type] || booking.vehicle_type)}</span>
                </div>
                <div class="history-card-grid">
                    <div class="history-card-item">
                        <span>Pickup point</span>
                        <strong>${escapeHtml(booking.pickup_location || 'Not provided')}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Area / station</span>
                        <strong>${escapeHtml(booking.location_id || 'Not provided')}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>Start time</span>
                        <strong>${escapeHtml(formatDisplayDateTime(booking.start_time))}</strong>
                    </div>
                    <div class="history-card-item">
                        <span>End time</span>
                        <strong>${escapeHtml(formatDisplayDateTime(booking.end_time))}</strong>
                    </div>
                    <div class="history-card-item history-card-item-wide">
                        <span>Created</span>
                        <strong>${escapeHtml(formatDisplayDateTime(booking.created_at))}</strong>
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
            setHistoryFeedback('Enter a valid phone number to load booking history.', 'error');
            renderHistoryEmpty('History unavailable', 'Please enter the same phone number used when booking.');
            return;
        }

        setHistoryLoading(true);
        setHistoryFeedback('Loading recent bookings...', 'info');

        try {
            const response = await fetch(`/api/bookings?phone=${encodeURIComponent(normalizedPhone)}&limit=${HISTORY_LIMIT}`);
            const result = await parseResponse(response);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to load booking history.');
            }

            renderHistoryList(result.data.bookings || []);
            setHistoryFeedback(`Showing ${result.data.count} recent booking(s).`, 'success');
        } catch (error) {
            setHistoryFeedback(error.message || 'Unable to load booking history.', 'error');
            renderHistoryEmpty('History unavailable', 'Please try again in a moment.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const resetHistoryState = (title = 'No history loaded yet', message = 'Enter your phone number above and your booking history will appear here.') => {
        setHistoryFeedback();
        renderHistoryEmpty(title, message);
    };

    const scheduleHistoryLookup = () => {
        if (historyLookupTimer) {
            clearTimeout(historyLookupTimer);
        }

        const phone = historyPhoneInput.value.trim();

        if (!phone) {
            resetHistoryState('No history loaded yet', 'Enter a phone number here to load recent bookings.');
            return;
        }

        if (!PHONE_REGEX.test(phone)) {
            setHistoryFeedback('Keep typing your phone number to load booking history automatically.', 'info');
            renderHistoryEmpty('Waiting for a full phone number', 'When the phone number is complete, recent bookings will appear here.');
            return;
        }

        historyLookupTimer = window.setTimeout(() => {
            loadBookingHistory(phone);
        }, HISTORY_AUTOLOAD_DELAY);
    };

    const showFieldState = (input, errorElement, isValid, message = '') => {
        input.classList.toggle('input-error', !isValid);
        errorElement.classList.toggle('hidden', isValid);
        if (message) {
            errorElement.textContent = message;
        }
        return isValid;
    };

    const validateForm = () => {
        const nameValid = showFieldState(
            fields.name,
            errors.name,
            fields.name.value.trim().length >= 2
        );

        const phoneValid = showFieldState(
            fields.phone,
            errors.phone,
            PHONE_REGEX.test(fields.phone.value.trim())
        );

        const startValue = fields.startTime.value;
        const endValue = fields.endTime.value;
        const startDate = new Date(startValue);
        const endDate = new Date(endValue);
        const now = new Date();

        const startValid = showFieldState(
            fields.startTime,
            errors.startTime,
            Boolean(startValue) && !Number.isNaN(startDate.getTime()) && startDate >= now,
            'Start time must be now or later.'
        );

        const endValid = showFieldState(
            fields.endTime,
            errors.endTime,
            Boolean(endValue) && !Number.isNaN(endDate.getTime()) && endDate > startDate,
            'End time must be later than start time.'
        );

        const vehicleValid = showFieldState(
            fields.vehicleType,
            errors.vehicleType,
            Boolean(fields.vehicleType.value)
        );

        return nameValid && phoneValid && startValid && endValid && vehicleValid;
    };

    const updateVehicleMeta = () => {
        vehicleTypeDisplay.textContent = vehicleLabels[fields.vehicleType.value] || vehicleLabels[DEFAULT_VEHICLE];
    };

    const applyQrContext = () => {
        const params = new URLSearchParams(window.location.search);
        const locationId = params.get('location_id') || '';
        const vehicleType = params.get('vehicle_type') || DEFAULT_VEHICLE;
        const pickupLabel = params.get('pickup_label') || '';

        fields.vehicleType.value = vehicleLabels[vehicleType] ? vehicleType : DEFAULT_VEHICLE;
        updateVehicleMeta();

        if (locationId) {
            fields.locationId.value = locationId;
            locationLabelDisplay.textContent = locationId;
        } else {
            locationLabelDisplay.textContent = 'Enter on form';
        }

        if (pickupLabel) {
            fields.pickupLocation.value = pickupLabel;
            pickupLabelDisplay.textContent = pickupLabel;
        } else {
            pickupLabelDisplay.textContent = 'Enter on form';
        }

        const bannerParts = [];
        if (locationId) {
            bannerParts.push(`Area / station: ${locationId}`);
        }
        if (pickupLabel) {
            bannerParts.push(`Pickup point: ${pickupLabel}`);
        }
        bannerParts.push(`Vehicle preset: ${vehicleLabels[fields.vehicleType.value]}`);

        contextBanner.textContent = bannerParts.join(' | ');
        contextBanner.classList.remove('hidden');
    };

    const setLoadingState = (isLoading) => {
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading ? 'Sending...' : 'Book Now';
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

    const parseResponse = async (response) => {
        try {
            return await response.json();
        } catch (error) {
            return {
                success: false,
                message: 'Unexpected server response. Please send again.'
            };
        }
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

        if (!validateForm()) {
            return;
        }

        saveCache();
        setLoadingState(true);
        openOverlay({
            state: 'loading',
            kicker: 'Sending booking',
            title: 'Waiting for server confirmation',
            message: 'Please wait while we send your booking to the server and ThingsBoard.'
        });

        const bookingData = {
            name: fields.name.value.trim(),
            phone: fields.phone.value.trim(),
            start_time: new Date(fields.startTime.value).toISOString(),
            end_time: new Date(fields.endTime.value).toISOString(),
            vehicle_type: fields.vehicleType.value,
            location_id: fields.locationId.value.trim() || '',
            pickup_location: fields.pickupLocation.value.trim()
        };

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            });

            const result = await parseResponse(response);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to create booking. Please send again.');
            }

            localStorage.removeItem(CACHE_KEY);
            form.reset();
            setDateDefaults();
            applyQrContext();

            openOverlay({
                state: 'success',
                kicker: 'Booking sent',
                title: 'Booking created successfully',
                message: result.message || 'The server and ThingsBoard both accepted your booking.',
                bookingId: result.data.id,
                actionLabel: 'Book another ride'
            });

            if (isHistoryPanelOpen && historyPhoneInput.value.trim() === bookingData.phone) {
                await loadBookingHistory(historyPhoneInput.value);
            }
        } catch (error) {
            openOverlay({
                state: 'error',
                kicker: 'Send failed',
                title: 'Unable to complete the booking',
                message: error.message || 'Unable to contact the server. Please send again.',
                actionLabel: 'Send again'
            });
        } finally {
            setLoadingState(false);
        }
    });

    [fields.name, fields.phone, fields.startTime, fields.endTime, fields.vehicleType].forEach((input) => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });

    fields.vehicleType.addEventListener('change', updateVehicleMeta);
    historyPhoneInput.addEventListener('input', scheduleHistoryLookup);
    fields.pickupLocation.addEventListener('input', () => {
        pickupLabelDisplay.textContent = fields.pickupLocation.value.trim() || 'Enter on form';
    });
    fields.locationId.addEventListener('input', () => {
        locationLabelDisplay.textContent = fields.locationId.value.trim() || 'Enter on form';
    });

    loadCache();
    setDateDefaults();
    applyQrContext();
    validateForm();
    resetHistoryState('No history loaded yet', 'Enter a phone number here to load recent bookings.');
    setHistoryPanelState(false);
});
