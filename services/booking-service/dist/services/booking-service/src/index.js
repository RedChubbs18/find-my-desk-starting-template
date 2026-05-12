"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("@team-orbit/auth");
const contracts_1 = require("@team-orbit/contracts");
const observability_1 = require("@team-orbit/observability");
const booking_repository_1 = require("./repositories/booking-repository");
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER = process.env.JWT_ISSUER ||
    'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const SERVICE_NAME = 'booking-service';
const repository = new booking_repository_1.InMemoryBookingRepository();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    const correlationId = (0, contracts_1.makeCorrelationId)(req.headers['x-correlation-id'] || `${Date.now()}-${Math.random()}`);
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
});
const authConfig = {
    jwtSecret: JWT_SECRET,
    jwtIssuer: JWT_ISSUER,
    jwtAudience: API_AUDIENCE,
    jwtRequiredScope: API_REQUIRED_SCOPE,
};
app.use('/api', (0, auth_1.createAuthMiddleware)(authConfig));
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: SERVICE_NAME,
    });
});
app.post('/api/v1/bookings', auth_1.requireAuth, (req, res) => {
    const { officeId, deskId, neighbourhoodId, bookingDate, collaboratorIds } = req.body ?? {};
    if (!officeId || !deskId || !neighbourhoodId || !bookingDate) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.VALIDATION_ERROR,
                message: 'officeId, deskId, neighbourhoodId, and bookingDate are required',
                statusCode: 400,
            },
            timestamp: new Date(),
        };
        res.status(400).json(response);
        return;
    }
    const existing = repository.findByDeskAndDate(deskId, bookingDate);
    if (existing) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.CONFLICT,
                message: 'Desk already booked for selected date',
                statusCode: 409,
            },
            timestamp: new Date(),
        };
        res.status(409).json(response);
        return;
    }
    const booking = repository.create({
        userId: req.authContext.userId,
        officeId,
        deskId,
        neighbourhoodId,
        bookingDate,
        collaboratorIds,
    });
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            booking,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.get('/api/v1/bookings/:bookingId', auth_1.requireAuth, (req, res) => {
    const booking = repository.findById(req.params.bookingId);
    const history = repository.getHistory(req.params.bookingId);
    if (!booking) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.NOT_FOUND,
                message: 'Booking not found',
                statusCode: 404,
            },
            timestamp: new Date(),
        };
        res.status(404).json(response);
        return;
    }
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            booking,
            history,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.get('/api/v1/users/:userId/bookings', auth_1.requireAuth, (req, res) => {
    const bookings = repository.findByUserId(req.params.userId);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            bookings,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.delete('/api/v1/bookings/:bookingId', auth_1.requireAuth, (req, res) => {
    const booking = repository.cancel(req.params.bookingId, req.authContext.userId, req.body?.reason);
    if (!booking) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.NOT_FOUND,
                message: 'Booking not found',
                statusCode: 404,
            },
            timestamp: new Date(),
        };
        res.status(404).json(response);
        return;
    }
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            booking,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.use((err, req, res, next) => {
    const correlationId = req.correlationId || (0, contracts_1.makeCorrelationId)('error');
    const logger = new observability_1.ConsoleLogger(SERVICE_NAME, {
        correlationId,
        traceId: 'trace-' + Date.now(),
        spanId: 'span-' + Math.random(),
    });
    logger.error('Unhandled error', err);
    const apiError = {
        code: contracts_1.ErrorCode.INTERNAL_ERROR,
        message: err.message || 'Internal server error',
        statusCode: 500,
    };
    const response = {
        success: false,
        correlationId,
        error: apiError,
        timestamp: new Date(),
    };
    res.status(apiError.statusCode).json(response);
});
app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} running on port ${PORT}`);
});
