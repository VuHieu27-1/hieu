# D-Soft Buggy Booking System

QR-based booking system for buggy, shuttle, or taxi service.

This project includes:

- `Admin QR Generator`: create a branded booking QR code
- `Mobile Booking Page`: customer-facing booking form
- `Node.js Backend`: booking API, JSON storage, ThingsBoard sync
- `System Logging`: detailed logs for development and troubleshooting

The project is designed so a non-technical user can run it locally, and a developer can extend it without restructuring the app first.

## 1. What This Project Does

When an operator creates a QR code and shares or prints it:

1. A customer scans the QR code
2. The customer opens the mobile booking page
3. The customer fills in booking information
4. The backend validates the booking
5. The backend sends the booking to ThingsBoard
6. The booking is saved to `data/bookings.json`
7. The customer sees success only after ThingsBoard accepts the data

## 2. Main Features

- Clean QR generator dashboard
- D-Soft branded UI
- Light mode / dark mode
- PNG and SVG QR download
- Mobile-first booking form
- Booking history lookup by phone number
- Persistent JSON storage
- ThingsBoard telemetry + attributes sync
- Detailed system logs
- Automatic fallback to the next free port if `3000` is busy

## 3. Project Structure

```text
buggy_booking_system/
|-- public/
|   |-- index.html              # Admin QR generator
|   |-- booking.html            # Customer booking page
|   |-- css/style.css           # Shared UI styles
|   |-- js/qr-generator.js      # QR generator logic
|   |-- js/booking.js           # Booking form + history logic
|   |-- js/theme.js             # Light/dark theme toggle
|   `-- img/d-soft-logo.png     # Brand logo
|-- data/
|   |-- bookings.json           # Saved bookings
|   `-- logs/                   # System logs
|-- lib/
|   `-- logger.js               # Logging utility
|-- server.js                   # Main Express server
|-- package.json
`-- README.md
```

## 4. Requirements

Install these tools first:

- `Node.js` 18 or newer recommended
- `npm` (included with Node.js)
- `Docker Desktop` if you want to run the project in a container
- `Docker Compose` support

To check if Node.js is installed:

```bash
node -v
npm -v
```

## 5. Quick Start

### Option A: Run directly with Node.js

Open a terminal in:

```text
C:\Users\OS\Desktop\hieu\Python_BE\buggy_booking_system
```

Then run:

```bash
npm install
npm start
```

If startup is successful, the terminal will show URLs like:

- `QR generator`: `http://localhost:3000/`
- `Booking page`: `http://localhost:3000/booking.html`
- `Health check`: `http://localhost:3000/api/health`

If port `3000` is already being used, the app automatically starts on the next free port, for example `3001`.

Important:

- Always open the exact URL printed in the terminal
- Do not assume the port is always `3000`

### Option B: Run with Docker

This project is already prepared for Docker.

Files already added:

- [`Dockerfile`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/Dockerfile)
- [`docker-compose.yml`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/docker-compose.yml)
- [`.dockerignore`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/.dockerignore)
- [`.env.example`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/.env.example)

What you need before using Docker:

1. Install Docker Desktop
2. Make sure Docker is running
3. Open a terminal in the project root
4. Prepare an environment file if you want custom ThingsBoard settings

### If you see this error

```text
'docker' is not recognized as an internal or external command,
operable program or batch file.
```

It means Docker is not installed yet, or Docker was installed but your terminal cannot find it.

Follow these steps carefully on Windows:

#### Step A: Check whether Docker Desktop is installed

1. Press the `Windows` key
2. Search for `Docker Desktop`
3. If you see it, open it
4. Wait until Docker Desktop says it is running

If you do not see Docker Desktop in the Start menu, install it first.

#### Step B: Install Docker Desktop

1. Open your browser
2. Go to:

```text
https://www.docker.com/products/docker-desktop/
```

3. Download `Docker Desktop for Windows`
4. Run the installer
5. Keep the default options unless your company has its own setup rules
6. Restart your computer if the installer asks you to

#### Step C: Open Docker Desktop after install

After installation:

1. Open `Docker Desktop`
2. Wait for it to finish starting
3. You should see that Docker is running

#### Step D: Open a new terminal

Important:

- if you installed Docker while an old terminal window was already open, that terminal may not know the `docker` command yet
- close the old terminal
- open a brand new terminal window

Then test:

```bash
docker --version
docker compose version
```

If both commands return a version number, Docker is ready.

#### Step E: If Docker Desktop is installed but the command still does not work

Try these checks:

1. Close all terminals
2. Close Docker Desktop
3. Open Docker Desktop again
4. Wait until it says Docker is running
5. Open a new terminal again
6. Run:

```bash
docker --version
```

If it still fails, restart Windows and test again.

#### Step F: If your PC asks for WSL 2 or virtualization

Some Windows machines require:

- `WSL 2`
- virtualization enabled in BIOS

If Docker Desktop asks you to enable these, follow its installer instructions first, then restart the PC.

#### Step G: If Docker cannot be installed right now

You can still run this project without Docker using Node.js:

```bash
npm install
npm start
```

So Docker is optional for local use. It is mainly useful for:

- clean deployment
- consistent environment
- easy server packaging

#### Step 1: Create `.env` from `.env.example`

PowerShell:

```powershell
Copy-Item .env.example .env
```

Windows Command Prompt:

```bat
copy .env.example .env
```

Then edit `.env` if needed:

```env
PORT=3000
THINGSBOARD_URL=https://eu.thingsboard.cloud/entities/devices/all
THINGSBOARD_ACCESS_TOKEN=your_access_token_here
```

#### Step 2: Build and start the container

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up --build -d
```

Important:

- the container checks ThingsBoard connectivity during startup
- if ThingsBoard URL, token, or internet access is wrong, the container may stop immediately
- in that case, check:
  - `.env`
  - `docker compose logs -f`
  - your ThingsBoard device access token

#### Step 3: Open the app

- `QR generator`: `http://localhost:3000/`
- `Booking page`: `http://localhost:3000/booking.html`
- `Health check`: `http://localhost:3000/api/health`

#### Step 4: Stop Docker

```bash
docker compose down
```

#### Step 5: Rebuild after code changes

```bash
docker compose up --build
```

### Docker data persistence

The compose file mounts:

```text
./data:/app/data
```

That means:

- bookings remain after container restart
- logs remain after container restart
- you can inspect `data/bookings.json` and `data/logs` directly on your machine

### Docker commands for daily use

Start:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

Rebuild after code changes:

```bash
docker compose up --build -d
```

### When to use Docker vs Node.js directly

Use Node.js directly when:

- you are actively coding
- you want the simplest local debugging flow

Use Docker when:

- you want a clean, repeatable environment
- multiple people need the same setup
- you plan to deploy later using containers

## 6. First-Time Use

### Admin workflow

1. Open the admin page
2. Confirm the booking URL
3. Adjust QR color / background if needed
4. Keep the D-Soft logo or upload another center logo
5. Download the QR as `PNG` or `SVG`
6. Print or share the QR

### Customer workflow

1. Scan the QR code
2. Fill in the booking form
3. Tap `Book Now`
4. Wait for server confirmation
5. See success only after ThingsBoard confirms the booking

### Booking history workflow

1. Open the booking page
2. Tap `View history`
3. Enter a phone number in the history panel
4. See recent bookings for that number

## 7. Running With ThingsBoard

This project is already prepared to send data to ThingsBoard.

### Current default configuration

In `server.js`, the project currently uses:

- `THINGSBOARD_URL=https://eu.thingsboard.cloud/entities/devices/all`
- a default `THINGSBOARD_ACCESS_TOKEN` already configured for local setup

For a real environment, replace the default token with your own device access token.

The server automatically normalizes:

```text
https://eu.thingsboard.cloud/entities/devices/all
```

into the correct base host:

```text
https://eu.thingsboard.cloud
```

Then it sends data to:

- `POST /api/v1/<ACCESS_TOKEN>/telemetry`
- `POST /api/v1/<ACCESS_TOKEN>/attributes`

### Override ThingsBoard configuration

If you want to change the server URL or access token, set environment variables before starting the app.

PowerShell:

```powershell
$env:THINGSBOARD_URL="https://eu.thingsboard.cloud/entities/devices/all"
$env:THINGSBOARD_ACCESS_TOKEN="your_access_token"
npm start
```

Windows Command Prompt:

```bat
set THINGSBOARD_URL=https://eu.thingsboard.cloud/entities/devices/all
set THINGSBOARD_ACCESS_TOKEN=your_access_token
npm start
```

## 8. How Booking Data Is Stored

Every successful booking is saved to:

[`data/bookings.json`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/data/bookings.json)

Each record contains:

- booking id
- customer name
- phone number
- start time
- end time
- vehicle type
- area / station
- pickup point
- created time

Example:

```json
{
  "id": "BK-20260318-0001",
  "name": "Nguyen Van A",
  "phone": "0901234567",
  "start_time": "2026-03-18T08:30:00.000Z",
  "end_time": "2026-03-18T09:00:00.000Z",
  "vehicle_type": "4_seats",
  "location_id": "Beach Club A",
  "pickup_location": "Sunset Lobby",
  "created_at": "2026-03-18T08:01:12.000Z"
}
```

## 9. API Reference

### `POST /api/bookings`

Create a new booking.

Request body:

```json
{
  "name": "Nguyen Van A",
  "phone": "0901234567",
  "start_time": "2026-03-18T08:30:00.000Z",
  "end_time": "2026-03-18T09:00:00.000Z",
  "vehicle_type": "4_seats",
  "location_id": "Beach Club A",
  "pickup_location": "Sunset Lobby"
}
```

Success response:

```json
{
  "success": true,
  "message": "Booking created and synced to ThingsBoard",
  "data": {
    "id": "BK-20260318-0001"
  }
}
```

### `GET /api/bookings?phone=<phone>&limit=<n>`

Load recent bookings by phone number.

Example:

```text
GET /api/bookings?phone=0901234567&limit=6
```

### `GET /api/bookings/:id`

Load one booking by booking id.

### `GET /api/health`

Health check and system status.

Includes:

- uptime
- booking count
- ThingsBoard URL
- latest log file
- last ThingsBoard sync result

### `GET /api/system/logs`

Load recent system log entries.

### `GET /api/thingsboard/logs`

Load recent ThingsBoard-related log entries.

## 10. Logging And Debugging

Logs are written to:

- [`data/logs/latest.log`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/data/logs/latest.log)
- daily log files inside [`data/logs`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/data/logs)

The logging system includes:

- timestamp with milliseconds
- request start / request finish
- ThingsBoard sync result
- validation failures
- startup checks
- uncaught errors

Useful debug URLs:

- `http://localhost:<PORT>/api/health`
- `http://localhost:<PORT>/api/system/logs`
- `http://localhost:<PORT>/api/thingsboard/logs`

## 11. Development Notes

### Start in development mode

```bash
npm run dev
```

Current `dev` script runs the same server as `start`.

### Static frontend

The frontend is served directly by Express from:

[`public`](c:/Users/OS/Desktop/hieu/Python_BE/buggy_booking_system/public)

### Same-origin API

The booking page calls the backend on the same origin, so there is no extra frontend API configuration needed when using the included server.

## 12. Troubleshooting

### Server starts but `localhost:3000` does not work

Possible reason:

- port `3000` is busy and the server moved to another port

Fix:

- read the terminal output carefully
- open the exact URL printed by the server

### Booking says failed

Possible reasons:

- ThingsBoard URL is wrong
- access token is wrong
- internet connection from the server is unavailable
- ThingsBoard rejected telemetry or attributes

Check:

- `/api/health`
- `/api/thingsboard/logs`
- `data/logs/latest.log`

### History does not show any bookings

Check:

- the phone number format is valid
- the phone number matches previous bookings exactly
- `data/bookings.json` actually contains bookings for that number

### QR scans poorly

Use these recommendations:

- dark QR color
- light background
- small center logo
- avoid low-contrast color combinations

## 13. Common Commands

Install dependencies:

```bash
npm install
```

Start server:

```bash
npm start
```

Run with custom port in PowerShell:

```powershell
$env:PORT=3100
npm start
```

Run with custom port in Command Prompt:

```bat
set PORT=3100
npm start
```

Check server health:

```text
http://localhost:3000/api/health
```

## 14. Recommended Local Test Flow

1. Run `npm start`
2. Open admin page
3. Generate QR
4. Open booking page
5. Create a booking
6. Confirm success response appears
7. Check `data/bookings.json`
8. Open booking history and confirm the record appears
9. Check `/api/thingsboard/logs`

## 15. Summary

This project is already usable as:

- a local demo
- an internal resort buggy booking tool
- a starting point for a production QR booking platform

If you want to continue improving it, the next best upgrades are:

- authentication for admin access
- database storage instead of JSON file
- booking status workflow
- booking cancellation / edit flow
- deployment with HTTPS and domain configuration
