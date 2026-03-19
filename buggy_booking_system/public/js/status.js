document.addEventListener('DOMContentLoaded', () => {
    const POLL_INTERVAL_MS = 5000;
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking_id');
    const feedback = document.getElementById('status-feedback');

    const elements = {
        bookingId: document.getElementById('status-booking-id'),
        label: document.getElementById('status-label'),
        pickupArea: document.getElementById('status-pickup-area'),
        dropoffPoint: document.getElementById('status-dropoff-point'),
        passengers: document.getElementById('status-passengers'),
        pickupTime: document.getElementById('status-pickup-time'),
        eta: document.getElementById('status-eta'),
        vehiclePlate: document.getElementById('status-vehicle-plate')
    };

    const formatDateTime = (value) => {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value || '-';
        }

        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(date);
    };

    const setFeedback = (message, type = 'info') => {
        feedback.textContent = message;
        feedback.className = `history-feedback history-feedback-${type}`;
    };

    const renderBooking = (booking) => {
        elements.bookingId.textContent = booking.id || '-';
        elements.label.textContent = (booking.booking_status && booking.booking_status.label) || 'Pending';
        elements.pickupArea.textContent = booking.pickup_area || '-';
        elements.dropoffPoint.textContent = booking.dropoff_point || '-';
        elements.passengers.textContent = String(booking.passenger_count || '-');
        elements.pickupTime.textContent = formatDateTime(booking.pickup_time || booking.start_time);
        elements.eta.textContent = booking.booking_status && booking.booking_status.eta_minutes
            ? `${booking.booking_status.eta_minutes} min`
            : 'Waiting';
        elements.vehiclePlate.textContent = (booking.booking_status && booking.booking_status.vehicle_plate) || 'Waiting';
    };

    const loadStatus = async () => {
        if (!bookingId) {
            setFeedback('Missing booking ID.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to load booking status.');
            }

            renderBooking(result.data);
            setFeedback('Booking status is updating automatically.', 'success');
        } catch (error) {
            setFeedback(error.message || 'Unable to load booking status.', 'error');
        }
    };

    loadStatus();
    window.setInterval(loadStatus, POLL_INTERVAL_MS);
});
