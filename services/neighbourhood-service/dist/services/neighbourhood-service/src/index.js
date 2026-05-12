"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("@team-orbit/auth");
const contracts_1 = require("@team-orbit/contracts");
const observability_1 = require("@team-orbit/observability");
const workplace_data_adapter_1 = require("./adapters/workplace-data-adapter");
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER = process.env.JWT_ISSUER ||
    'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const SERVICE_NAME = 'neighbourhood-service';
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
const workplaceDataAdapter = new workplace_data_adapter_1.WorkplaceDataAdapter();
app.get('/api/v1/offices/:officeId/neighbourhoods', auth_1.requireAuth, async (req, res) => {
    const neighbourhoods = await workplaceDataAdapter.listNeighbourhoods(req.params.officeId);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            neighbourhoods,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.get('/api/v1/offices/:officeId/desks/availability', auth_1.requireAuth, async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const slots = await workplaceDataAdapter.getAvailability(req.params.officeId, date);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            slots,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.get('/api/v1/offices/:officeId/floorplans', auth_1.requireAuth, async (req, res) => {
    const floors = await workplaceDataAdapter.getFloors(req.params.officeId);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            floors,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.get('/api/v1/offices/:officeId/team-seating', auth_1.requireAuth, async (req, res) => {
    const assignments = await workplaceDataAdapter.getTeamSeating(req.params.officeId);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            assignments,
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
