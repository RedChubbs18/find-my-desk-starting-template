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
import { WorkplaceDataAdapter } from './adapters/workplace-data-adapter';

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_ISSUER =
  process.env.JWT_ISSUER ||
  'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0';
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';
const SERVICE_NAME = 'neighbourhood-service';

const app: Express = express();

app.use(express.json());

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

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
  });
});

const workplaceDataAdapter = new WorkplaceDataAdapter();

app.get('/api/v1/offices/:officeId/neighbourhoods', requireAuth, async (req: Request, res: Response) => {
  const neighbourhoods = await workplaceDataAdapter.listNeighbourhoods(req.params.officeId);
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      neighbourhoods,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

app.get('/api/v1/offices/:officeId/desks/availability', requireAuth, async (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const slots = await workplaceDataAdapter.getAvailability(req.params.officeId, date);
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      slots,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

app.get('/api/v1/offices/:officeId/floorplans', requireAuth, async (req: Request, res: Response) => {
  const floors = await workplaceDataAdapter.getFloors(req.params.officeId);
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      floors,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

app.get('/api/v1/offices/:officeId/team-seating', requireAuth, async (req: Request, res: Response) => {
  const assignments = await workplaceDataAdapter.getTeamSeating(req.params.officeId);
  const response: ApiResponse = {
    success: true,
    correlationId: req.correlationId!,
    data: {
      assignments,
    },
    timestamp: new Date(),
  };
  res.json(response);
});

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
