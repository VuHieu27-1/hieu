const express = require('express');
const router = express.Router();
const { createBooking, getBookingById } = require('../controllers/booking.controller');

// Defines the API routes and maps them to controller functions.
// All routes here are prefixed with /api/v1 (defined in server.js)

// POST /api/v1/bookings - Create a new booking
router.post('/bookings', createBooking);

// GET /api/v1/bookings/:id - Get booking details
router.get('/bookings/:id', getBookingById);

module.exports = router;
