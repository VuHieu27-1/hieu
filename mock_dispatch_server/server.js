const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 4001);
const PENDING_BROADCAST_STATUS = 'PENDING_BROADCAST';
const ACCEPTED_STATUS = 'ACCEPTED';
const PENDING_MESSAGE = 'Đã phát tín hiệu đến các tài xế gần nhất, đang chờ tài xế nhận cuốc...';

const PHONE_REGEX = /^(\+84|84|0)[0-9]{9,10}$/;
const VEHICLE_POOL = [
    {
        assignedVehicle: 'buggy01',
        driver: {
            name: 'Tran Van Minh',
            badgeId: 'DRV-001'
        }
    },
    {
        assignedVehicle: 'buggy02',
        driver: {
            name: 'Le Quoc Bao',
            badgeId: 'DRV-002'
        }
    },
    {
        assignedVehicle: 'buggy03',
        driver: {
            name: 'Nguyen Thanh Son',
            badgeId: 'DRV-003'
        }
    }
];

const tasks = new Map();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const sanitizeString = (value) => String(value || '').trim();

const normalizeIsoDateTime = (value) => {
    const rawValue = sanitizeString(value);

    if (!rawValue) {
        return null;
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeBookingPoint = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }

    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const locationName = sanitizeString(payload.locationName);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return null;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return null;
    }

    if (!locationName) {
        return null;
    }

    return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        locationName
    };
};

const validateBookingPayload = (payload) => {
    const normalized = {
        guestName: sanitizeString(payload.guestName),
        phone: sanitizeString(payload.phone),
        passengerCount: Number.parseInt(payload.passengerCount, 10) || 0,
        bookingType: sanitizeString(payload.bookingType || 'NOW').toUpperCase(),
        scheduledTime: normalizeIsoDateTime(payload.scheduledTime),
        pickup: normalizeBookingPoint(payload.pickup),
        dropoff: normalizeBookingPoint(payload.dropoff)
    };

    if (!normalized.guestName || !normalized.pickup || !normalized.dropoff) {
        return { valid: false, message: 'Missing required fields.' };
    }

    if (normalized.phone && !PHONE_REGEX.test(normalized.phone)) {
        return { valid: false, message: 'Phone number format is invalid.' };
    }

    if (!['NOW', 'SCHEDULED'].includes(normalized.bookingType)) {
        return { valid: false, message: 'Booking type is invalid.' };
    }

    if (!Number.isInteger(normalized.passengerCount) || normalized.passengerCount < 1 || normalized.passengerCount > 8) {
        return { valid: false, message: 'Passenger count must be between 1 and 8.' };
    }

    if (normalized.bookingType === 'SCHEDULED' && !normalized.scheduledTime) {
        return { valid: false, message: 'Scheduled time is required for SCHEDULED bookings.' };
    }

    if (normalized.bookingType === 'SCHEDULED' && new Date(normalized.scheduledTime) <= new Date()) {
        return { valid: false, message: 'Scheduled time must be in the future.' };
    }

    return {
        valid: true,
        normalized
    };
};

const buildTaskId = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0');
    return `BKG-${stamp}-${suffix}`;
};

const pickVehicleAssignment = (taskId) => {
    const seed = Array.from(taskId).reduce((total, character) => total + character.charCodeAt(0), 0);
    return VEHICLE_POOL[seed % VEHICLE_POOL.length];
};

const scheduleAutomaticAcceptance = (task) => {
    const acceptanceDelayMs = 9000 + Math.floor(Math.random() * 6000);

    task.acceptanceTimer = setTimeout(() => {
        const assignment = pickVehicleAssignment(task.taskId);
        const estimatedPickupSeconds = Number((45 + Math.random() * 60).toFixed(1));

        task.status = ACCEPTED_STATUS;
        task.assignedVehicle = assignment.assignedVehicle;
        task.estimatedPickupSeconds = estimatedPickupSeconds;
        task.message = `Xe ${assignment.assignedVehicle} đang đến!`;
        task.driver = {
            ...assignment.driver,
            estimatedArrivalText: `${estimatedPickupSeconds} giây`,
            assignedVehicle: assignment.assignedVehicle
        };
        task.updatedAt = new Date().toISOString();
    }, acceptanceDelayMs);
};

const toPublicTaskResponse = (task) => ({
    taskId: task.taskId,
    status: task.status,
    assignedVehicle: task.assignedVehicle,
    estimatedPickupSeconds: task.estimatedPickupSeconds,
    message: task.message,
    driver: task.driver,
    booking: {
        guestName: task.booking.guestName,
        phone: task.booking.phone,
        passengerCount: task.booking.passengerCount,
        bookingType: task.booking.bookingType,
        scheduledTime: task.booking.scheduledTime,
        pickup: task.booking.pickup,
        dropoff: task.booking.dropoff
    },
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Mock dispatch server is running.',
        data: {
            tasks: tasks.size
        }
    });
});

app.post('/api/bookings', (req, res) => {
    const validation = validateBookingPayload(req.body || {});

    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const taskId = buildTaskId();
    const task = {
        taskId,
        status: PENDING_BROADCAST_STATUS,
        assignedVehicle: null,
        estimatedPickupSeconds: null,
        message: PENDING_MESSAGE,
        driver: null,
        booking: validation.normalized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceTimer: null
    };

    tasks.set(taskId, task);
    scheduleAutomaticAcceptance(task);

    return res.status(202).json({
        taskId: task.taskId,
        status: task.status,
        message: task.message
    });
});

app.get('/api/bookings/:taskId', (req, res) => {
    const task = tasks.get(req.params.taskId);

    if (!task) {
        return res.status(404).json({
            success: false,
            message: 'Task not found.'
        });
    }

    return res.json(toPublicTaskResponse(task));
});

app.listen(PORT, () => {
    console.log(`Mock dispatch server listening on http://localhost:${PORT}`);
});
