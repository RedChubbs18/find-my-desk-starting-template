import express, { Express, Request, Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  requireAuth,
  AuthConfig,
} from '@team-orbit/auth';
import {
  ApiResponse,
  ErrorCode,
  ApiError,
  makeCorrelationId,
} from '@team-orbit/contracts';
import { ConsoleLogger } from '@team-orbit/observability';
import { DirectoryAdapter } from './adapters/graph-adapter';
import { GraphAuthClient } from './adapters/graph-auth-client';

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER =
  process.env.JWT_ISSUER ||
  'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID || '';
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
const GRAPH_TENANT_ID = process.env.GRAPH_TENANT_ID || '';
const SERVICE_NAME = 'directory-service';

const app: Express = express();

// Middleware
app.use(express.json());

// Request correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = makeCorrelationId(
    (req.headers['x-correlation-id'] as string) || `${Date.now()}-${Math.random()}`
  );
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Auth middleware
const authConfig: AuthConfig = {
  jwtSecret: JWT_SECRET,
  jwtIssuer: JWT_ISSUER,
  jwtAudience: API_AUDIENCE,
  jwtRequiredScope: API_REQUIRED_SCOPE,
};
app.use('/api', createAuthMiddleware(authConfig));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
  });
});

// TODO: Initialize Graph client if credentials available
let graphClient: GraphAuthClient | null = null;
if (GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET) {
  graphClient = new GraphAuthClient({
    clientId: GRAPH_CLIENT_ID,
    clientSecret: GRAPH_CLIENT_SECRET,
    tenantId: GRAPH_TENANT_ID,
  });
}

const directoryAdapter = new DirectoryAdapter(graphClient);

app.get('/api/v1/users/:userId', requireAuth, async (req: Request, res: Response) => {
  const user = await directoryAdapter.getUser(req.params.userId);
  const response: ApiResponse = {
    success: Boolean(user),
    correlationId: req.correlationId!,
    data: user ? { user } : undefined,
    error: user
      ? undefined
      : {
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
          statusCode: 404,
        },
    timestamp: new Date(),
  };
  res.status(user ? 200 : 404).json(response);
});

app.get('/api/v1/users/:userId/collaborators', requireAuth, async (req: Request, res: Response) => {
  const collaborators = await directoryAdapter.listCollaborators(req.params.userId);
  const signals = await directoryAdapter.buildSignals(
    req.params.userId,
    collaborators.map((c) => c.id)
  );
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      collaborators,
      signals,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

app.post('/api/v1/collaboration-signals/query', requireAuth, async (req: Request, res: Response) => {
  const userId = req.body?.userId || req.authContext?.userId;
  const collaboratorIds = Array.isArray(req.body?.collaboratorIds) ? req.body.collaboratorIds : [];
  const signals = await directoryAdapter.buildSignals(userId, collaboratorIds);
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.correlationId || makeCorrelationId('error');
  const logger = new ConsoleLogger(SERVICE_NAME, {
    correlationId,
    traceId: 'trace-' + Date.now(),
    spanId: 'span-' + Math.random(),
  });

  logger.error('Unhandled error', err);

  const apiError: ApiError = {
    code: ErrorCode.INTERNAL_ERROR,
    message: err.message || 'Internal server error',
    statusCode: 500,
  };

  const response: ApiResponse = {
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
