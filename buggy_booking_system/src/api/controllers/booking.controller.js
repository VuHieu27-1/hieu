// In-memory storage for bookings
let bookings = [];
let bookingCounter = 1;

// Generate a unique booking ID
const generateBookingId = () => {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const counterStr = String(bookingCounter++).padStart(3, '0');
    return `BK${timestamp}${counterStr}`;
};

const PHONE_REGEX = /^(\+84|0)[0-9]{9,10}$/;

// Create a new booking
const createBooking = (req, res) => {
    const { name, phone, start_time, end_time, vehicle_type, location_id } = req.body;

    // --- Validation ---
    if (!name || !phone || !start_time || !end_time || !vehicle_type) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields.'
        });
    }

    if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid phone number format.'
        });
    }

    // --- Create and Store Booking ---
    try {
        const newBooking = {
            id: generateBookingId(),
            name,
            phone,
            start_time: new Date(start_time).toISOString(),
            end_time: new Date(end_time).toISOString(),
            vehicle_type,
            location_id: location_id || null,
            createdAt: new Date().toISOString(),
        };

        bookings.push(newBooking);
        console.log('New booking created:', newBooking);

        return res.status(201).json({
            success: true,
            booking_id: newBooking.id,
            message: 'Booking created successfully',
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error. Could not create booking.'
        });
    }
};

// Get booking details by ID
const getBookingById = (req, res) => {
    const { id } = req.params;
    const booking = bookings.find(b => b.id === id);

    if (booking) {
        return res.status(200).json({
            success: true,
            data: booking,
        });
    } else {
        return res.status(404).json({
            success: false,
            message: 'Booking not found',
        });
    }
};

module.exports = {
    createBooking,
    getBookingById,
};
