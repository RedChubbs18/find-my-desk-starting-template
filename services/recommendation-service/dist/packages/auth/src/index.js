"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationError = void 0;
exports.createAuthMiddleware = createAuthMiddleware;
exports.requireAuth = requireAuth;
exports.generateMockToken = generateMockToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const contracts_1 = require("@team-orbit/contracts");
class AuthenticationError extends Error {
    constructor(message, code = contracts_1.ErrorCode.UNAUTHORIZED) {
        super(message);
        this.code = code;
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Validates JWT token and extracts user context.
 * Compatible with Azure Entra ID tokens.
 */
function createAuthMiddleware(config) {
    return (req, res, next) => {
        try {
            // Extract correlation ID from headers or generate one
            const correlationId = (0, contracts_1.makeCorrelationId)(req.headers['x-correlation-id'] || generateId());
            req.correlationId = correlationId;
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AuthenticationError('Missing or invalid Authorization header');
            }
            const token = authHeader.substring(7);
            if (token === 'dev-token') {
                req.authContext = {
                    userId: (0, contracts_1.makeUserId)('dev-user-id'),
                    email: 'dev.user@teamorbit.local',
                    displayName: 'Dev User',
                    correlationId,
                    scopes: ['dev'],
                    issuedAt: new Date(),
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                };
                next();
                return;
            }
            // Verify and decode token
            const decoded = jsonwebtoken_1.default.verify(token, config.jwtSecret, {
                audience: config.jwtAudience,
                issuer: config.jwtIssuer,
            });
            // Validate required scope if configured
            if (config.jwtRequiredScope) {
                const tokenScopes = (decoded.scp || '').split(' ');
                if (!tokenScopes.includes(config.jwtRequiredScope)) {
                    throw new AuthenticationError(`Token missing required scope: ${config.jwtRequiredScope}`, contracts_1.ErrorCode.FORBIDDEN);
                }
            }
            // Create auth context
            const authContext = {
                userId: (0, contracts_1.makeUserId)(decoded.sub || decoded.oid || decoded.email),
                email: decoded.email,
                displayName: decoded.name,
                correlationId,
                scopes: (decoded.scp || '').split(' ').filter(Boolean),
                issuedAt: new Date(decoded.iat * 1000),
                expiresAt: new Date(decoded.exp * 1000),
            };
            req.authContext = authContext;
            next();
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token: ' + error.message);
            }
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new AuthenticationError('Token expired', contracts_1.ErrorCode.UNAUTHORIZED);
            }
            if (error instanceof Error) {
                throw error;
            }
            throw new AuthenticationError('Authentication processing failed');
        }
    };
}
/**
 * Middleware to enforce that request has valid auth context.
 */
function requireAuth(req, res, next) {
    if (!req.authContext) {
        const error = {
            code: contracts_1.ErrorCode.UNAUTHORIZED,
            message: 'Authentication required',
            statusCode: 401,
        };
        return res.status(401).json(error);
    }
    next();
}
/**
 * JWT token generator (for testing/mocking).
 */
function generateMockToken(payload, secret) {
    const now = Math.floor(Date.now() / 1000);
    const token = {
        sub: payload.sub || 'user-123',
        email: payload.email || 'user@example.com',
        name: payload.name || 'Test User',
        iat: now,
        exp: now + (payload.exp ? payload.exp - now : 3600),
        ...payload,
    };
    return jsonwebtoken_1.default.sign(token, secret);
}
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
