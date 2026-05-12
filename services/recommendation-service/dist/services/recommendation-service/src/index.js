"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("@team-orbit/auth");
const contracts_1 = require("@team-orbit/contracts");
const observability_1 = require("@team-orbit/observability");
const scoring_1 = require("./domain/scoring");
const PORT = process.env.PORT || 3004;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER = process.env.JWT_ISSUER ||
    'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const FOUNDRY_ENDPOINT = process.env.FOUNDRY_ENDPOINT || '';
const DIRECTORY_SERVICE_URL = process.env.DIRECTORY_SERVICE_URL || 'http://localhost:3001';
const NEIGHBOURHOOD_SERVICE_URL = process.env.NEIGHBOURHOOD_SERVICE_URL || 'http://localhost:3002';
const SERVICE_NAME = 'recommendation-service';
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
app.post('/api/v1/recommendations', auth_1.requireAuth, async (req, res) => {
    const userId = req.body?.userId || req.authContext.userId;
    const officeId = req.body?.officeId || 'office-london-mvp';
    const bookingDate = req.body?.bookingDate || new Date().toISOString().slice(0, 10);
    const collaborators = Array.isArray(req.body?.collaborators) ? req.body.collaborators : [];
    const [user, desks, availability] = await Promise.all([
        fetchUser(userId, req.correlationId),
        fetchDesksForOffice(officeId, req.correlationId),
        fetchAvailability(officeId, bookingDate, req.correlationId),
    ]);
    if (!user) {
        const response = {
            success: false,
            correlationId: req.correlationId,
            error: {
                code: contracts_1.ErrorCode.NOT_FOUND,
                message: 'Unable to resolve user profile for recommendation',
                statusCode: 404,
            },
            timestamp: new Date(),
        };
        res.status(404).json(response);
        return;
    }
    const availableDeskIds = new Set(availability.filter((s) => s.isAvailable).map((s) => s.deskId));
    const ranked = (0, scoring_1.scoreDesks)(user, desks, availableDeskIds, collaborators.length);
    const candidates = ranked.slice(0, 5).map((r) => ({
        deskId: r.desk.id,
        neighbourhoodId: r.desk.neighbourhoodId,
        score: maybeFoundryAdjust(r.score),
        rationale: r.rationale,
    }));
    const top = candidates[0] ?? null;
    const response = {
        success: Boolean(top),
        correlationId: req.correlationId,
        data: {
            candidates,
            topRecommendation: top,
            explanation: top
                ? {
                    deskId: top.deskId,
                    neighbourhoodId: top.neighbourhoodId,
                    factors: {
                        collaborationScore: collaborators.length > 0 ? 0.8 : 0.5,
                        proximityScore: 0.75,
                        preferenceScore: Math.min(1, top.score + 0.1),
                        availabilityScore: 1,
                    },
                    reasoning: top.rationale,
                }
                : null,
            confidence: top ? top.score : 0,
        },
        timestamp: new Date(),
    };
    res.json(response);
});
app.post('/api/v1/recommendations/explain', auth_1.requireAuth, (req, res) => {
    const { deskId, neighbourhoodId } = req.body ?? {};
    const response = {
        success: true,
        correlationId: req.correlationId,
        data: {
            explanation: {
                deskId: deskId ?? 'unknown',
                neighbourhoodId: neighbourhoodId ?? 'unknown',
                factors: {
                    collaborationScore: 0.7,
                    proximityScore: 0.75,
                    preferenceScore: 0.8,
                    availabilityScore: 1,
                },
                reasoning: 'Desk selected from available candidates based on collaborator proximity and user desk preferences.',
            },
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
async function fetchUser(userId, correlationId) {
    const response = await fetch(`${DIRECTORY_SERVICE_URL}/api/v1/users/${userId}`, {
        headers: { 'x-correlation-id': correlationId, Authorization: `Bearer dev-token` },
    });
    if (!response.ok) {
        return null;
    }
    const body = (await response.json());
    return body?.data?.user ?? null;
}
async function fetchDesksForOffice(officeId, correlationId) {
    const neighbourhoodResponse = await fetch(`${NEIGHBOURHOOD_SERVICE_URL}/api/v1/offices/${officeId}/neighbourhoods`, {
        headers: { 'x-correlation-id': correlationId, Authorization: `Bearer dev-token` },
    });
    const body = (await neighbourhoodResponse.json());
    const neighbourhoods = body?.data?.neighbourhoods ?? [];
    const desks = [];
    neighbourhoods.forEach((n) => {
        const total = Number(n.totalDesks ?? 0);
        for (let i = 1; i <= total; i += 1) {
            desks.push({
                id: `${n.id}-desk-${i}`,
                neighbourhoodId: n.id,
                officeId: n.officeId,
                floorId: n.floorId,
                deskNumber: `${n.name.slice(0, 3).toUpperCase()}-${i}`,
                features: n.features ?? [],
                isAccessible: (n.features ?? []).includes('accessible-desk'),
            });
        }
    });
    return desks;
}
async function fetchAvailability(officeId, date, correlationId) {
    const response = await fetch(`${NEIGHBOURHOOD_SERVICE_URL}/api/v1/offices/${officeId}/desks/availability?date=${date}`, {
        headers: { 'x-correlation-id': correlationId, Authorization: `Bearer dev-token` },
    });
    const body = (await response.json());
    return body?.data?.slots ?? [];
}
function maybeFoundryAdjust(score) {
    if (!FOUNDRY_ENDPOINT) {
        return score;
    }
    return Math.min(1, score + 0.03);
}
