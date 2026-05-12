import { Request, Response, NextFunction } from 'express';
import { AuthContext, CorrelationId, ErrorCode } from '@team-orbit/contracts';
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
export declare class AuthenticationError extends Error {
    readonly code: ErrorCode;
    constructor(message: string, code?: ErrorCode);
}
/**
 * Validates JWT token and extracts user context.
 * Compatible with Azure Entra ID tokens.
 */
export declare function createAuthMiddleware(config: AuthConfig): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware to enforce that request has valid auth context.
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * JWT token generator (for testing/mocking).
 */
export declare function generateMockToken(payload: Partial<JwtPayload>, secret: string): string;
export { AuthContext, CorrelationId };
