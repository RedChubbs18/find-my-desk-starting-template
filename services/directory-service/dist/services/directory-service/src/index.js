"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("@team-orbit/auth");
const contracts_1 = require("@team-orbit/contracts");
const observability_1 = require("@team-orbit/observability");
const graph_adapter_1 = require("./adapters/graph-adapter");
const graph_auth_client_1 = require("./adapters/graph-auth-client");
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER = process.env.JWT_ISSUER ||
    'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID || '';
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
const GRAPH_TENANT_ID = process.env.GRAPH_TENANT_ID || '';
const SERVICE_NAME = 'directory-service';
const app = (0, express_1.default)();
// Middleware
app.use(express_1.default.json());
// Request correlation ID
app.use((req, res, next) => {
    const correlationId = (0, contracts_1.makeCorrelationId)(req.headers['x-correlation-id'] || `${Date.now()}-${Math.random()}`);
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
});
// Auth middleware
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
// TODO: Initialize Graph client if credentials available
let graphClient = null;
if (GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET) {
    graphClient = new graph_auth_client_1.GraphAuthClient({
        clientId: GRAPH_CLIENT_ID,
        clientSecret: GRAPH_CLIENT_SECRET,
        tenantId: GRAPH_TENANT_ID,
    });
}
const directoryAdapter = new graph_adapter_1.DirectoryAdapter(graphClient);
app.get('/api/v1/users/:userId', auth_1.requireAuth, async (req, res) => {
    const user = await directoryAdapter.getUser(req.params.userId);
    const response = {
        success: Boolean(user),
        correlationId: req.correlationId,
        data: user ? { user } : undefined,
        error: user
            ? undefined
            : {
                code: contracts_1.ErrorCode.NOT_FOUND,
                message: 'User not found',
                statusCode: 404,
            },
        timestamp: new Date(),
    };
    res.status(user ? 200 : 404).json(response);
});
app.get('/api/v1/users/:userId/collaborators', auth_1.requireAuth, async (req, res) => {
    const collaborators = await directoryAdapter.listCollaborators(req.params.userId);
    const signals = await directoryAdapter.buildSignals(req.params.userId, collaborators.map((c) => c.id));
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            collaborators,
            signals,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.post('/api/v1/collaboration-signals/query', auth_1.requireAuth, async (req, res) => {
    const userId = req.body?.userId || req.authContext?.userId;
    const collaboratorIds = Array.isArray(req.body?.collaboratorIds) ? req.body.collaboratorIds : [];
    const signals = await directoryAdapter.buildSignals(userId, collaboratorIds);
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            signals,
            graphSnapshot: signals.map((s) => ({
                fromUserId: s.fromUserId,
                toUserId: s.toUserId,
                normalizedWeight: s.score,
            })),
        },
        timestamp: new Date(),
    };
    res.json(response);
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
