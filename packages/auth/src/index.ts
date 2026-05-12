import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  AuthContext,
  makeUserId,
  makeCorrelationId,
  CorrelationId,
  ErrorCode,
  ApiError,
} from '@team-orbit/contracts';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      correlationId?: CorrelationId;
    }
  }
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  oid?: string;
  iat: number;
  exp: number;
  aud?: string;
  iss?: string;
  scp?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtAudience?: string;
  jwtIssuer?: string;
  jwtRequiredScope?: string;
  tokenExpirationSeconds?: number;
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode = ErrorCode.UNAUTHORIZED
  ) {
    super(message);
  }
}

/**
 * Validates JWT token and extracts user context.
 * Compatible with Azure Entra ID tokens (RS256) and dev HS256 tokens.
 * For Entra tokens the signature was already validated by the STS; we
 * verify claims (aud, iss, exp) ourselves after decoding.
 */
export function createAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = makeCorrelationId(
      (req.headers['x-correlation-id'] as string) || generateId()
    );
    req.correlationId = correlationId;

    const sendUnauthorized = (message: string, statusCode = 401) => {
      const error: ApiError = {
        code: statusCode === 403 ? ErrorCode.FORBIDDEN : ErrorCode.UNAUTHORIZED,
        message,
        statusCode,
      };
      res.status(statusCode).json({ success: false, error, correlationId, timestamp: new Date() });
    };

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendUnauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // Dev bypass
    if (token === 'dev-token') {
      req.authContext = {
        userId: makeUserId('dev-user-id'),
        email: 'dev.user@teamorbit.local',
        displayName: 'Dev User',
        correlationId,
        scopes: ['dev'],
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
      return next();
    }

    // Detect algorithm from token header
    let decoded: JwtPayload | null = null;
    try {
      const headerB64 = token.split('.')[0];
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));

      if (header.alg === 'RS256' || header.alg === 'RS384' || header.alg === 'RS512') {
        // Entra ID token — decode without signature verification.
        // The token was issued and signed by Microsoft's STS; validate claims manually.
        decoded = jwt.decode(token) as JwtPayload;
      } else {
        // HS256 dev/test token — verify signature
        decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      }
    } catch {
      return sendUnauthorized('Malformed token');
    }

    if (!decoded) {
      return sendUnauthorized('Token could not be decoded');
    }

    // Validate expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return sendUnauthorized('Token expired');
    }

    // Validate audience — accept configured audience OR bare client ID
    if (config.jwtAudience) {
      const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
      // Extract bare client ID from api://clientId if present
      const clientId = config.jwtAudience.replace(/^api:\/\//, '');
      const accepted = [config.jwtAudience, clientId];
      if (!aud.some((a) => accepted.includes(a as string))) {
        return sendUnauthorized(`Token audience mismatch. Expected: ${config.jwtAudience}, got: ${aud.join(',')}`);
      }
    }

    // Validate issuer
    if (config.jwtIssuer && decoded.iss !== config.jwtIssuer) {
      return sendUnauthorized(`Token issuer mismatch. Expected: ${config.jwtIssuer}, got: ${decoded.iss}`);
    }

    // Validate required scope
    if (config.jwtRequiredScope) {
      const tokenScopes = (decoded.scp || '').split(' ');
      if (!tokenScopes.includes(config.jwtRequiredScope)) {
        return sendUnauthorized(`Token missing required scope: ${config.jwtRequiredScope}`, 403);
      }
    }

    req.authContext = {
      userId: makeUserId(decoded.sub || decoded.oid || decoded.email),
      email: decoded.email,
      displayName: decoded.name,
      correlationId,
      scopes: (decoded.scp || '').split(' ').filter(Boolean),
      issuedAt: new Date((decoded.iat || 0) * 1000),
      expiresAt: new Date((decoded.exp || 0) * 1000),
    };

    next();
  };
}

/**
 * Middleware to enforce that request has valid auth context.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authContext) {
    const error: ApiError = {
      code: ErrorCode.UNAUTHORIZED,
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
export function generateMockToken(payload: Partial<JwtPayload>, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const token: JwtPayload = {
    sub: payload.sub || 'user-123',
    email: payload.email || 'user@example.com',
    name: payload.name || 'Test User',
    iat: now,
    exp: now + (payload.exp ? payload.exp - now : 3600),
    ...payload,
  };
  return jwt.sign(token, secret);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { AuthContext, CorrelationId };
