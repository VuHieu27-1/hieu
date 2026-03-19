# Buggy Booking System

Booking web app and gateway server for buggy dispatch requests.

This project now focuses on one clear flow:

1. Customer opens the booking page.
2. Customer submits a booking request.
3. The booking server validates and stores the request locally.
4. The booking server forwards the request to an external dispatch API.
5. The booking page receives a `taskId` with status `PENDING_BROADCAST`.
6. The status page polls the booking server until a driver accepts the task.

The external dispatch API is mocked by the separate project in:

`C:\Users\OS\Desktop\hieu\Python_BE\mock_dispatch_server`

## Project Scope

This repository includes only the pieces needed for the booking experience:

- booking page
- booking status page
- local JSON storage
- GPS-assisted pickup selection
- server-side geocoding proxy
- dispatch API forwarding
- Docker support for the booking gateway

Removed from the current scope:

- ThingsBoard integration
- QR generator workflow
- extra demo pages that do not support booking

## Structure

```text
buggy_booking_system/
|-- data/
|   |-- bookings.json
|   `-- logs/
|-- lib/
|   `-- logger.js
|-- public/
|   |-- css/
|   |   `-- style.css
|   |-- img/
|   |   `-- d-soft-logo.png
|   |-- js/
|   |   |-- booking.js
|   |   |-- status.js
|   |   `-- theme.js
|   |-- booking.html
|   |-- index.html
|   `-- status.html
|-- .env.example
|-- docker-compose.yml
|-- Dockerfile
|-- package.json
`-- server.js
```

## Environment

Create `.env` from `.env.example`.

Example:

```env
PORT=3000
DISPATCH_API_URL=http://localhost:4001
REVERSE_GEOCODE_URL=https://nominatim.openstreetmap.org/reverse
SEARCH_GEOCODE_URL=https://nominatim.openstreetmap.org/search
LOCATION_HTTP_TIMEOUT_MS=15000
DISPATCH_HTTP_TIMEOUT_MS=8000
MAX_PENDING_BOOKINGS=200
IDEMPOTENCY_TTL_MS=600000
```

Key variables:

- `PORT`: port for this booking server
- `DISPATCH_API_URL`: external dispatch server base URL
- `REVERSE_GEOCODE_URL`: reverse geocoding endpoint
- `SEARCH_GEOCODE_URL`: forward geocoding endpoint

## Run Locally

### 1. Choose a dispatch server

Option A: use the local mock server

In a separate terminal:

```bash
cd c:\Users\OS\Desktop\hieu\Python_BE\mock_dispatch_server
npm install
npm start
```

Expected URL:

```text
http://localhost:4001
```

Option B: use a real dispatch server

Set `DISPATCH_API_URL` in `.env` to the real base URL.

Example:

```env
DISPATCH_API_URL=https://your-real-dispatch-server.example.com
```

### 2. Start this booking server

```bash
cd c:\Users\OS\Desktop\hieu\Python_BE\buggy_booking_system
npm install
npm start
```

Main URLs:

- `http://localhost:3000/`
- `http://localhost:3000/booking.html`
- `http://localhost:3000/status.html`
- `http://localhost:3000/api/health`

## Docker

This Docker setup can run in two modes:

- `mock` mode: run the bundled `mock_dispatch_server`
- `external` mode: point to any real dispatch server URL through `DISPATCH_API_URL`

### Run with Docker Compose

1. Create `.env` from `.env.example`.
2. To use an external real server, set:

```env
DISPATCH_API_URL=https://your-real-dispatch-server.example.com
```

3. Start with the local mock server:

```bash
docker compose --profile mock up --build
```

4. Or start only the booking server and connect it to an external dispatch URL:

```bash
docker compose up --build
```

Stop it:

```bash
docker compose down
```

## Booking Request Format

`POST /api/bookings`

```json
{
  "guestName": "Nguyen Van A",
  "phone": "0901234567",
  "passengerCount": 2,
  "bookingType": "NOW",
  "scheduledTime": null,
  "pickup": {
    "lat": 16.1205,
    "lng": 108.3061,
    "locationName": "La Maison 1888"
  },
  "dropoff": {
    "lat": 16.1215,
    "lng": 108.308,
    "locationName": "Bai bien Bac"
  }
}
```

Accepted response:

```json
{
  "taskId": "BKG-20260319-3443D3",
  "status": "PENDING_BROADCAST",
  "message": "Da phat tin hieu den cac tai xe gan nhat, dang cho tai xe nhan cuoc..."
}
```

## Polling Status

`GET /api/bookings/:taskId`

Pending example:

```json
{
  "taskId": "BKG-20260319-3443D3",
  "status": "PENDING_BROADCAST",
  "assignedVehicle": null,
  "estimatedPickupSeconds": null,
  "message": "Dang cho tai xe nhan cuoc..."
}
```

Accepted example:

```json
{
  "taskId": "BKG-20260319-3443D3",
  "status": "ACCEPTED",
  "assignedVehicle": "buggy02",
  "estimatedPickupSeconds": 60.5,
  "message": "Xe buggy02 dang den!"
}
```

The status page polls this endpoint every 5 seconds.

## Useful Commands

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Run local syntax checks:

```bash
npm run check
```

## Notes

- GPS features require `https` or `localhost`.
- Browser geolocation only provides coordinates; address text comes from reverse geocoding.
- The booking server keeps local history in `data/bookings.json`.
- Logs are written to `data/logs/`.
