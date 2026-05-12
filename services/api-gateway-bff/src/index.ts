import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
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

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER =
  process.env.JWT_ISSUER ||
  'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const DIRECTORY_SERVICE_URL = process.env.DIRECTORY_SERVICE_URL || 'http://localhost:3001';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:3003';
const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004';
const SERVICE_NAME = 'api-gateway-bff';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true,
}));

// Request correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = makeCorrelationId(
    (req.headers['x-correlation-id'] as string) || `${Date.now()}-${Math.random()}`
  );
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

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

// Placeholder routes
app.get('/api/v1/users/me', requireAuth, async (req: Request, res: Response) => {
  const userResponse = await fetch(
    `${DIRECTORY_SERVICE_URL}/api/v1/users/${req.authContext!.userId}`,
    {
      headers: {
        Authorization: req.headers.authorization || 'Bearer dev-token',
        'x-correlation-id': req.correlationId!,
      },
    }
  );
  const body: any = userResponse.ok ? await userResponse.json() : null;

  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      userId: req.authContext!.userId,
      email: req.authContext!.email,
      displayName: req.authContext!.displayName,
      profile: body?.data?.user,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

app.post('/api/v1/recommendations/query', requireAuth, async (req: Request, res: Response) => {
  const downstream = await fetch(`${RECOMMENDATION_SERVICE_URL}/api/v1/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.authorization || 'Bearer dev-token',
      'x-correlation-id': req.correlationId!,
    },
    body: JSON.stringify({
      ...req.body,
      userId: req.authContext!.userId,
    }),
  });

  if (!downstream.ok) {
    const response: ApiResponse = {
      success: false,
      correlationId: req.correlationId!,
      error: {
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Recommendation service unavailable',
        statusCode: 502,
      },
      timestamp: new Date(),
    };
    res.status(502).json(response);
    return;
  }

  const body: any = await downstream.json();
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: body.data,
    timestamp: new Date(),
  };
  res.json(response);
});

app.post('/api/v1/bookings', requireAuth, async (req: Request, res: Response) => {
  const downstream = await fetch(`${BOOKING_SERVICE_URL}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.authorization || 'Bearer dev-token',
      'x-correlation-id': req.correlationId!,
    },
    body: JSON.stringify({
      ...req.body,
      userId: req.authContext!.userId,
    }),
  });

  const body: any = await downstream.json();
  const response: ApiResponse = {
    success: downstream.ok,
    correlationId: req.correlationId!,
    data: body.data,
    error: body.error,
    timestamp: new Date(),
  };
  res.status(downstream.status).json(response);
});

app.get('/api/v1/bookings', requireAuth, async (req: Request, res: Response) => {
  const downstream = await fetch(
    `${BOOKING_SERVICE_URL}/api/v1/users/${req.authContext!.userId}/bookings`,
    {
      headers: {
        Authorization: req.headers.authorization || 'Bearer dev-token',
        'x-correlation-id': req.correlationId!,
      },
    }
  );
  const body: any = await downstream.json();

  const response: ApiResponse = {
    success: downstream.ok,
    correlationId: req.correlationId!,
    data: body.data,
    error: body.error,
    timestamp: new Date(),
  };
  res.status(downstream.status).json(response);
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
