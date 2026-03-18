# Buggy Booking System

Modern QR-based booking system for buggy or taxi services with:

- Admin QR generator dashboard
- Mobile-first booking page
- Node.js + Express backend
- JSON file persistence so bookings remain after server restarts

## Project structure

- `public/index.html`: Admin QR generator
- `public/booking.html`: Customer booking page
- `public/js/qr-generator.js`: QR creation logic
- `public/js/booking.js`: Booking form logic
- `server.js`: Express API + static file server
- `data/bookings.json`: Stored bookings

## Setup

1. Open a terminal in `buggy_booking_system`
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

To forward booking data to ThingsBoard, set the ThingsBoard URL before starting:

```bat
set THINGSBOARD_URL=https://eu.thingsboard.cloud/entities/devices/all
npm start
```

Important:

- You can paste the management URL `https://eu.thingsboard.cloud/entities/devices/all`.
- The server automatically normalizes it to the base host `https://eu.thingsboard.cloud`.
- The backend uses `https://eu.thingsboard.cloud/api/v1/<ACCESS_TOKEN>/telemetry` for telemetry.
- The backend also sends attributes to `https://eu.thingsboard.cloud/api/v1/<ACCESS_TOKEN>/attributes`.
- The local server now verifies ThingsBoard connectivity before it starts listening.
- Booking is now marked successful only after ThingsBoard accepts the data.
- If ThingsBoard fails, the booking page shows an error and asks the user to send again.

This project already includes these default ThingsBoard credentials in `server.js`:

- Access Token: `7rvm1WzxLQz8c3cKdEU0`

If port `3000` is already busy, this server now automatically retries on the next free port. You can also set a custom port manually:

```bash
$env:PORT=3100
npm start
```

If you are using Windows Command Prompt (`cmd`) instead of PowerShell, use:

```bat
set PORT=3100
npm start
```

4. Open:

- Admin QR generator: `http://localhost:3000/`
- Booking page: `http://localhost:3000/booking.html`
- Health check: `http://localhost:3000/api/health`

## How to use

1. Open the admin page
2. Set the booking page base URL
3. Add optional parameters like `location_id`, `vehicle_type`, `pickup_label`
4. Optionally upload a center logo
5. Download the QR as PNG or SVG
6. Scan the QR to open the booking page with pre-filled context

## API

### Create booking

`POST /api/bookings`

Example body:

```json
{
  "name": "Nguyen Van A",
  "phone": "0901234567",
  "start_time": "2026-03-18T08:30:00.000Z",
  "end_time": "2026-03-18T09:00:00.000Z",
  "vehicle_type": "4_seats",
  "location_id": "beach-club-a",
  "pickup_location": "Sunset Lobby"
}
```

Successful response:

```json
{
  "success": true,
  "message": "Booking created and synced to ThingsBoard",
  "data": {
    "id": "BK-20260318-0001"
  },
  "integrations": {
    "thingsboard": {
      "success": true
    }
  }
}
```

## Notes

- The frontend uses same-origin API calls, so it works cleanly when served by this Express server.
- Bookings are stored in `data/bookings.json`.
- Default `THINGSBOARD_URL` is `https://eu.thingsboard.cloud/entities/devices/all` and is normalized automatically.
- For the best QR scan reliability, keep the QR dark, background light, and logo small.
