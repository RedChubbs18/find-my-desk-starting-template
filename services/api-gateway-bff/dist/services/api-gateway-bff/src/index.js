"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("@team-orbit/auth");
const contracts_1 = require("@team-orbit/contracts");
const observability_1 = require("@team-orbit/observability");
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER = process.env.JWT_ISSUER ||
    'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const DIRECTORY_SERVICE_URL = process.env.DIRECTORY_SERVICE_URL || 'http://localhost:3001';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:3003';
const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004';
const SERVICE_NAME = 'api-gateway-bff';
const app = (0, express_1.default)();
// Middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_URL || 'http://localhost:5173'
    ],
    credentials: true,
}));
// Request correlation ID
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
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: SERVICE_NAME,
    });
});
// Placeholder routes
app.get('/api/v1/users/me', auth_1.requireAuth, async (req, res) => {
    const userResponse = await fetch(`${DIRECTORY_SERVICE_URL}/api/v1/users/${req.authContext.userId}`, {
        headers: {
            Authorization: req.headers.authorization || 'Bearer dev-token',
            'x-correlation-id': req.correlationId,
        },
    });
    const body = userResponse.ok ? await userResponse.json() : null;
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            userId: req.authContext.userId,
            email: req.authContext.email,
            displayName: req.authContext.displayName,
            profile: body?.data?.user,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.post('/api/v1/recommendations/query', auth_1.requireAuth, async (req, res) => {
    const downstream = await fetch(`${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization || 'Bearer dev-token',
            'x-correlation-id': req.correlationId,
        },
        body: JSON.stringify({
            ...req.body,
            userId: req.authContext.userId,
        }),
    });
    if (!downstream.ok) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.EXTERNAL_SERVICE_ERROR,
                message: 'Recommendation service unavailable',
                statusCode: 502,
            },
            timestamp: new Date(),
        };
        res.status(502).json(response);
        return;
    }
    const body = await downstream.json();
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: body.data,
        timestamp: new Date(),
    };
    res.json(response);
});
app.post('/api/v1/bookings', auth_1.requireAuth, async (req, res) => {
    const downstream = await fetch(`${BOOKING_SERVICE_URL}/api/v1/bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization || 'Bearer dev-token',
            'x-correlation-id': req.correlationId,
        },
        body: JSON.stringify({
            ...req.body,
            userId: req.authContext.userId,
        }),
    });
    const body = await downstream.json();
    const response = {
        success: downstream.ok,
        correlationId: req.correlationId,
        data: body.data,
        error: body.error,
        timestamp: new Date(),
    };
    res.status(downstream.status).json(response);
});
app.get('/api/v1/bookings', auth_1.requireAuth, async (req, res) => {
    const downstream = await fetch(`${BOOKING_SERVICE_URL}/api/v1/users/${req.authContext.userId}/bookings`, {
        headers: {
            Authorization: req.headers.authorization || 'Bearer dev-token',
            'x-correlation-id': req.correlationId,
        },
    });
    const body = await downstream.json();
    const response = {
        success: downstream.ok,
        correlationId: req.correlationId,
        data: body.data,
        error: body.error,
        timestamp: new Date(),
    };
    res.status(downstream.status).json(response);
});
// Error handler
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
