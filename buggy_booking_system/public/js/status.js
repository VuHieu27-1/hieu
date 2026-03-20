document.addEventListener('DOMContentLoaded', () => {
    const POLL_INTERVAL_MS = 3000;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task_id');
    const feedback = document.getElementById('status-feedback');
    let lastAcceptedBooking = null;
    let pollTimerId = null;
    let isTerminalStateReached = false;

    const elements = {
        bookingId: document.getElementById('status-booking-id'),
        label: document.getElementById('status-label'),
        spotlight: document.getElementById('status-spotlight'),
        phasePill: document.getElementById('status-phase-pill'),
        headline: document.getElementById('status-headline'),
        description: document.getElementById('status-description'),
        driverBanner: document.getElementById('status-driver-banner'),
        driverBannerVehicle: document.getElementById('status-driver-banner-vehicle'),
        driverBannerCopy: document.getElementById('status-driver-banner-copy'),
        pickupArea: document.getElementById('status-pickup-area'),
        dropoffPoint: document.getElementById('status-dropoff-point'),
        passengers: document.getElementById('status-passengers'),
        pickupTime: document.getElementById('status-pickup-time'),
        eta: document.getElementById('status-eta'),
        vehiclePlate: document.getElementById('status-vehicle-plate'),
        driverName: document.getElementById('status-driver-name'),
        taskMessage: document.getElementById('status-task-message')
    };

    const formatDateTime = (value) => {
        if (!value) {
            return '-';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Asia/Ho_Chi_Minh'
        }).format(date);
    };

    const setFeedback = (message = '', type = 'error') => {
        if (!message || type !== 'error') {
            feedback.textContent = '';
            feedback.className = 'history-feedback history-feedback-error hidden';
            return;
        }

        feedback.textContent = message;
        feedback.className = `history-feedback history-feedback-${type}`;
    };

    const getStatusLabel = (booking) => String(booking?.status || 'PENDING_BROADCAST');
    const isAcceptedBooking = (booking) => getStatusLabel(booking).toUpperCase() === 'ACCEPTED';
    const getAssignedVehicle = (booking) => booking?.assignedVehicle || 'Waiting';
    const getEtaText = (booking) => Number.isFinite(Number(booking?.estimatedPickupSeconds))
        ? `${Number(booking.estimatedPickupSeconds).toFixed(1)} s`
        : 'Waiting';

    const setSpotlightState = (booking) => {
        const accepted = isAcceptedBooking(booking);
        const vehicle = getAssignedVehicle(booking);
        const driverName = booking?.driver?.name || 'Driver info is coming in';
        const etaText = getEtaText(booking);

        elements.spotlight.classList.toggle('status-spotlight-waiting', !accepted);
        elements.spotlight.classList.toggle('status-spotlight-accepted', accepted);
        elements.driverBanner.classList.toggle('hidden', !accepted);

        if (accepted) {
            elements.phasePill.textContent = 'Driver found';
            elements.headline.textContent = `${vehicle} accepted your booking`;
            elements.description.textContent = `${driverName} is on the way to your pickup point. You can review the ETA and assigned vehicle details below.`;
            elements.driverBannerVehicle.textContent = vehicle;
            elements.driverBannerCopy.textContent = `${driverName} - ETA ${etaText}`;
            return;
        }

        elements.phasePill.textContent = 'Finding driver';
        elements.headline.textContent = 'Broadcasting your booking to nearby drivers';
        elements.description.textContent = 'The system is contacting nearby buggy drivers now. Please keep this page open while we wait for an acceptance.';
        elements.driverBannerVehicle.textContent = 'buggy--';
        elements.driverBannerCopy.textContent = 'Waiting for driver assignment';
    };

    const setDetailEmphasis = (booking) => {
        const accepted = isAcceptedBooking(booking);

        [
            elements.eta,
            elements.vehiclePlate,
            elements.driverName
        ].forEach((element) => {
            const card = element ? element.closest('.status-card') : null;
            if (card) {
                card.classList.toggle('status-card-emphasis', accepted);
            }
        });
    };

    const renderBooking = (booking) => {
        const nextBooking = isAcceptedBooking(booking)
            ? {
                ...(lastAcceptedBooking || {}),
                ...booking
            }
            : (lastAcceptedBooking || booking);

        if (isAcceptedBooking(booking)) {
            lastAcceptedBooking = nextBooking;
            isTerminalStateReached = true;
        }

        elements.bookingId.textContent = nextBooking.taskId || '-';
        elements.label.textContent = getStatusLabel(nextBooking);
        elements.pickupArea.textContent = nextBooking?.pickup?.locationName || '-';
        elements.dropoffPoint.textContent = nextBooking?.dropoff?.locationName || '-';
        elements.passengers.textContent = String(nextBooking?.passengerCount || '-');
        elements.pickupTime.textContent = formatDateTime(nextBooking?.scheduledTime || nextBooking?.pickupTime || nextBooking?.startTime);
        elements.eta.textContent = getEtaText(nextBooking);
        elements.vehiclePlate.textContent = getAssignedVehicle(nextBooking);
        elements.driverName.textContent = nextBooking?.driver?.name || 'Waiting';
        elements.taskMessage.textContent = nextBooking?.statusMessage || nextBooking?.message || 'Waiting';
        setSpotlightState(nextBooking);
        setDetailEmphasis(nextBooking);
    };

    const loadStatus = async () => {
        if (isTerminalStateReached) {
            return;
        }

        if (!taskId) {
            setFeedback('Missing task ID in the page URL.');
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${encodeURIComponent(taskId)}`, {
                cache: 'no-store'
            });
            const result = await response.json();

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || 'Unable to load booking status.');
            }

            renderBooking(result.data);
            setFeedback();

            if (isTerminalStateReached && pollTimerId) {
                window.clearTimeout(pollTimerId);
                pollTimerId = null;
            }
        } catch (error) {
            setFeedback(error.message || 'Unable to load booking status.');
        }
    };

    const scheduleNextPoll = () => {
        if (isTerminalStateReached) {
            return;
        }

        pollTimerId = window.setTimeout(async () => {
            await loadStatus();
            scheduleNextPoll();
        }, POLL_INTERVAL_MS);
    };

    loadStatus().finally(() => {
        scheduleNextPoll();
    });
});
