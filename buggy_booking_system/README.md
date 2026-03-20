# Buggy Booking System

Booking web app and gateway server for buggy dispatch requests.

Runtime requirement: Node.js 24+.

Detailed code walkthrough:

- `USER_MANUAL.md`: detailed explanation of the main flow, key functions, important variables, GPS logic, backend routes, and deployment configuration

This project now focuses on one clear flow:

1. Customer opens the booking page.
2. Customer submits a booking request.
3. The booking server validates and stores the request locally.
4. The booking server forwards the request to an external dispatch API.
5. The booking page receives a `taskId` with status `PENDING_BROADCAST`.
6. The status page polls the booking server until a driver accepts the task.

## Project Scope

This repository includes only the pieces needed for the booking experience:

- booking page
- booking status page
- local SQLite storage
- GPS-assisted pickup selection
- server-side geocoding proxy
- dispatch API forwarding
- Docker support for the booking gateway

## Structure

```text
buggy_booking_system/
|-- config/
|   |-- app.config.example.json
|   |-- app.config.json
|   `-- index.js
|-- data/
|   |-- bookings.db
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
|-- docker-compose.yml
|-- Dockerfile
|-- package.json
`-- server.js
```

## Configuration

Main runtime configuration lives in:

[app.config.json](/c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/config/app.config.json)

Use [app.config.example.json](/c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/config/app.config.example.json) as a template when needed.

Example:

```json
{
  "server": {
    "port": 3000
  },
  "storage": {
    "databaseFile": "./data/bookings.db",
    "logDir": "./data/logs"
  },
  "dispatch": {
    "baseUrl": "http://localhost:4001"
  }
}
```

Key variables:

- `server.port`: port for this booking server
- `storage.databaseFile`: SQLite file used for long-term booking storage
- `storage.logDir`: directory for runtime logs
- `dispatch.baseUrl`: dispatch server base URL used by the booking gateway
- `geocoding.reverseGeocodeUrl`: reverse geocoding endpoint
- `geocoding.searchGeocodeUrl`: forward geocoding endpoint
- `http.locationTimeoutMs`: timeout cho geocode request, dat `null` de cho response cho toi khi nhan duoc
- `http.dispatchTimeoutMs`: timeout cho dispatch request, dat `null` de cho response cho toi khi nhan duoc

## Run Locally

### 1. Set the dispatch server URL

Edit `dispatch.baseUrl` in [app.config.json](/c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/config/app.config.json) to the server that should receive booking requests.

Example:

```json
{
  "dispatch": {
    "baseUrl": "https://your-real-dispatch-server.example.com"
  }
}
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

### Run with Docker Compose

1. Update [app.config.json](/c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/config/app.config.json).
2. Start the booking server:

```bash
docker compose up --build
```

If the dispatch server runs on your host machine while the booking app runs in Docker, set:

```json
{
  "dispatch": {
    "baseUrl": "http://host.docker.internal:4001"
  }
}
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
- The booking server keeps local history in `data/bookings.db`.
- To switch booking requests to another server, change only `dispatch.baseUrl` in `config/app.config.json` and restart the app.
- Logs are written to `data/logs/`.
