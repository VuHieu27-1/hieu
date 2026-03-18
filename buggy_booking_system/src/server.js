const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bookingRoutes = require('./api/routes/booking.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- Serve Static Frontend Files ---
// Serve files from the 'public' directory, which is one level up from 'src'
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// --- API Routes ---
// All booking-related routes are handled by the bookingRoutes module
app.use('/api/v1', bookingRoutes);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Serving frontend files from: ${publicPath}`);
});
