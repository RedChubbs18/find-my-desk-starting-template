# Team Orbit Architecture & Implementation Guide

## Overview

Team Orbit is a microservices-based desk booking platform that helps hybrid workers book desks near colleagues they need to collaborate with. The system uses Azure Entra ID for authentication, Microsoft Graph for directory metadata, an internal workplace data provider for desks/neighbourhoods/availability, and Azure AI Foundry for recommendation ranking.

## Architecture

### High-Level Diagram

```
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │ HTTPS
         ▼
┌──────────────────────────┐
│   API Gateway/BFF        │
│   Port: 3000             │
└──────────────────────────┘
         │
    ┌────┼────┬────────┬──────────┐
    │    │    │        │          │
    ▼    ▼    ▼        ▼          ▼
┌────┐┌────┐┌─────┐┌─────┐
│DIR ││NBR ││BOOK ││REC  │
│    ││    ││     ││     │
│3001││3002││3003 ││3004 │
└────┘└────┘└─────┘└─────┘
   │       │        │        │
   ▼       ▼        ▼        ▼
 Graph Internal  DB/    Foundry
         Cache  Cache    (Optional)
```

### Service Responsibilities

| Service | Port | Responsibility | External Dependencies |
|---------|------|-----------------|----------------------|
| API Gateway/BFF | 3000 | Request orchestration, response shaping, token validation | None (routes to services) |
| Directory Service | 3001 | User profiles, teams, collaboration signals | Microsoft Graph (required in MVP) |
| Neighbourhood Service | 3002 | Desks, neighbourhoods, availability, team seating | Internal workplace data provider |
| Booking Service | 3003 | Booking persistence, workflow, audit trail | Database (in-memory for MVP) |
| Recommendation Service | 3004 | Collaboration graph, heuristic scoring, model ranking | Foundry (optional, with fallback) |
| Frontend | 5173 | User login, booking flow, confirmation UI | None (calls BFF) |

## Repository Structure

```
├── packages/                          # Shared libraries
│   ├── contracts/                     # Canonical API types & DTOs
│   ├── auth/                          # JWT validation, service auth
│   ├── observability/                 # Logging, tracing, metrics
│   └── http-client/                   # Resilient HTTP client
├── services/                          # Microservices
│   ├── api-gateway-bff/               # API Gateway/Backend-for-Frontend
│   ├── directory-service/             # User/team metadata (Graph-backed)
│   ├── neighbourhood-service/         # Desks/neighbourhoods (internal data-backed)
│   ├── booking-service/               # Booking persistence & workflow
│   └── recommendation-service/        # Desk recommendations (heuristic + Foundry)
├── apps/
│   └── frontend/                      # React app
├── deploy/
│   ├── docker/                        # Dockerfiles for all services
│   └── helm/                          # Kubernetes manifests and Helm charts
├── data/                              # Sample data (users.json, floorplans)
├── package.json                       # Monorepo root (npm workspaces)
└── tsconfig.json                      # Root TypeScript config
```

## API Contracts Summary

All endpoints follow the canonical contract envelope defined in `@team-orbit/contracts`.

### BFF Endpoints

- `GET /health` - Service health check
- `GET /api/v1/users/me` - Get current user context
- `POST /api/v1/recommendations/query` - Query desk recommendations
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings` - List user bookings
- `DELETE /api/v1/bookings/{bookingId}` - Cancel booking

### Directory Service

- `GET /api/v1/users/{userId}` - Get user profile
- `GET /api/v1/users/{userId}/collaborators` - List collaborators
- `POST /api/v1/collaboration-signals/query` - Query collaboration signals

### Neighbourhood Service

- `GET /api/v1/offices/{officeId}/neighbourhoods` - List neighbourhoods
- `GET /api/v1/offices/{officeId}/desks/availability` - Check desk availability
- `GET /api/v1/offices/{officeId}/floorplans` - Get floorplan data
- `GET /api/v1/offices/{officeId}/team-seating` - Get team seating assignments

### Booking Service

- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings/{bookingId}` - Get booking details
- `GET /api/v1/users/{userId}/bookings` - List user bookings
- `DELETE /api/v1/bookings/{bookingId}` - Cancel booking

### Recommendation Service

- `POST /api/v1/recommendations` - Get recommendations
- `POST /api/v1/recommendations/explain` - Explain recommendation

## Data Model Summary

### Authoritative Sources
- **Internal workplace provider**: Offices, neighbourhoods, desks, team seating, availability
- **Graph**: Users, teams, manager relationships
- **Booking Service**: Booking records, audit history

Current decision: internal workplace provider data is stored as versioned JSON at [data/workplace.json](data/workplace.json).

### Key Entities

**Booking**
```typescript
{
  id: BookingId,
  userId: UserId,
  officeId: OfficeId,
  deskId: DeskId,
  neighbourhoodId: NeighbourhoodId,
  bookingDate: string (ISO 8601),
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED',
  collaboratorIds: UserId[],
  createdAt: Date,
  updatedAt: Date
}
```

**DeskCandidate** (recommendation)
```typescript
{
  deskId: DeskId,
  neighbourhoodId: NeighbourhoodId,
  score: number (0-1),
  rationale: string
}
```

**CollaborationSignal**
```typescript
{
  sourceType: 'explicit' | 'org' | 'chat' | 'email' | 'calendar' | 'history',
  fromUserId: UserId,
  toUserId: UserId,
  score: number (0-1),
  dateWindow: { start: Date, end: Date }
}
```

## External Integration

### Microsoft Entra ID (Required)
- **Purpose**: User authentication via OAuth
- **Flow**: Frontend → Entra ID → BFF (token validation)
- **Setup**: Register app in Azure Entra, configure OAuth scopes

### Microsoft Graph (Required in MVP)
- **Purpose**: User profiles, teams, org hierarchy
- **Service**: Directory Service calls Graph with client credentials
- **Scope**: `https://graph.microsoft.com/.default`
- **Fallback**: Graph-compatible mock adapter (for local dev)

### Internal Workplace Data Provider (Required)
- **Purpose**: Desk inventory, neighbourhoods, team seating, availability
- **Service**: Neighbourhood Service serves this data via an internal provider module
- **Source**: Versioned repository file [data/workplace.json](data/workplace.json)
- **Cache**: Optional in-memory TTL cache (15-60 minutes)

### Azure AI Foundry (Optional)
- **Purpose**: Final ranking of desk candidates
- **Service**: Recommendation Service sends heuristic pre-scored candidates
- **Fallback**: Use heuristic scores if model unavailable
- **Boundary**: Heuristic pre-filter to top N candidates before model call

## Developer Task Breakdown

### Developer 1: Frontend + BFF
- Implement React auth flow (Entra ID OAuth)
- Build booking flow screens (date, collaborators, recommendation review, confirmation)
- Implement BFF orchestration endpoints
- Add contract tests for all BFF routes

### Developer 2: Directory Service + Auth
- Implement Graph client and user/team/relationship mappers
- Build Graph-compatible mock adapter
- Implement JWT validation and Graph app-auth middleware
- Contract tests for directory endpoints

### Developer 3: Neighbourhood Service + Booking Service
- Implement internal workplace data provider and neighbourhood/desk/availability mappers
- Build in-memory caching layer
- Implement booking persistence (in-memory for MVP, upgradeable to DB)
- Contract tests for both services

### Developer 4: Recommendation Service + Platform
- Implement collaboration graph construction
- Implement heuristic scoring (proximity, org structure, history)
- Implement Foundry model adapter with fallback
- Create Dockerfile templates, Helm charts
- Set up tracing/metrics infrastructure
- Create E2E test harness

## Setup & Running Services

### Prerequisites
- Node.js 20+
- Docker (for containerization)
- kubectl (for Kubernetes deployment)
- Azure subscription (for Entra ID, Graph, Foundry)

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set environment variables** (create `.env` in each service root)
   ```bash
   # .env (shared)
   JWT_SECRET=dev-secret-change-in-prod
   NODE_ENV=development
   ENTRA_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
   ENTRA_TENANT_ID=a96476fa-ab5b-4694-88e2-5843ab149973
   
   # services/directory-service/.env
   GRAPH_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
   GRAPH_CLIENT_SECRET=<app-secret>
   GRAPH_TENANT_ID=a96476fa-ab5b-4694-88e2-5843ab149973

   # services/api-gateway-bff/.env
   JWT_ISSUER=<https://login.microsoftonline.com/{tenant-id}/v2.0>
   API_AUDIENCE=<api-app-id-uri-or-client-id>
   API_REQUIRED_SCOPE=<access_as_user>

   # apps/frontend/.env
   VITE_ENTRA_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
   VITE_ENTRA_TENANT_ID=a96476fa-ab5b-4694-88e2-5843ab149973
   VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973
   VITE_ENTRA_REDIRECT_URI=http://localhost:5173
   VITE_ENTRA_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
   VITE_ENTRA_SCOPES=<openid profile email api://{api-app-id}/access_as_user>
   
   # services/recommendation-service/.env
   FOUNDRY_ENDPOINT=https://<foundry>.openai.azure.com/
   FOUNDRY_KEY=<foundry-key>
   ```

3. **Build all services**
   ```bash
   npm run build
   ```

4. **Start services** (in separate terminals)
   ```bash
   # Terminal 1: BFF
   cd services/api-gateway-bff
   npm run dev
   
   # Terminal 2: Directory
   cd services/directory-service
   npm run dev
   
   # Terminal 3: Neighbourhood
   cd services/neighbourhood-service
   npm run dev
   
   # Terminal 4: Booking
   cd services/booking-service
   npm run dev
   
   # Terminal 5: Recommendation
   cd services/recommendation-service
   npm run dev
   
   # Terminal 6: Frontend
   cd apps/frontend
   npm run dev
   ```

5. **Access**
   - Frontend: http://localhost:5173
   - BFF: http://localhost:3000/health
   - Services: http://localhost:300X/health

### Docker Build

```bash
# Build service containers
docker build -f deploy/docker/Dockerfile.service -t team-orbit/api-gateway-bff services/api-gateway-bff/
docker build -f deploy/docker/Dockerfile.service -t team-orbit/directory-service services/directory-service/
# ... repeat for other services

# Build frontend
docker build -f deploy/docker/Dockerfile.frontend -t team-orbit/frontend apps/frontend/
```

### Kubernetes Deployment (AKS)

```bash
# Update Helm values with your container registry and secrets
# deploy/helm/values.yaml

# Deploy to AKS
kubectl apply -f deploy/helm/services.yaml
kubectl apply -f deploy/helm/configmap.yaml

# Monitor
kubectl get pods -n team-orbit
kubectl logs -n team-orbit -l app=api-gateway-bff
```

## Testing Strategy

### Unit Tests
- Contract validators for API types
- Domain logic (booking workflow, recommendation scoring)
- Adapter mocks (Graph, internal provider, Foundry)

### Integration Tests
- Service-to-service calls
- External adapter integration (Graph, Foundry)
- End-to-end happy path: login → search → recommend → book

### Contract Tests
- Shared `@team-orbit/contracts` schema validation
- Request/response shape validation per service

### Smoke Tests
- All health endpoints respond 200 OK
- BFF orchestration endpoints accept valid payloads
- Services boot without errors

## Integration Points Checklist

- [ ] Entra ID OAuth flow working in frontend
- [ ] JWT validation middleware in all services
- [ ] Directory Service queries Graph for users
- [ ] Neighbourhood Service serves desk data from internal provider
- [ ] Booking Service persists bookings (in-memory OK for MVP)
- [ ] Recommendation Service calls Foundry (or falls back to heuristic)
- [ ] BFF orchestrates all services for booking flow
- [ ] Frontend renders recommendation and booking confirmation
- [ ] Health checks pass on all services
- [ ] Docker containers build and run
- [ ] Helm charts deploy to dev AKS

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Internal provider data drift from reality | Add scheduled data refresh job and validation checks |
| Graph scopes not approved | Pre-stage Graph-compatible mock; maintain adapter interface |
| Foundry unavailable | Pre-filter to top N with heuristics, fall back to heuristic ranking |
| Contract drift | Shared contracts package + CI schema validation |
| Booking conflicts | Optimistic locking + timestamp-based conflict detection |
| Cross-office scope creep | explicit officeId in all queries, error if multi-office unsupported |

## Next Steps

1. **Immediate** (Days 1-2)
   - [ ] Implement core BFF and frontend OAuth flow
   - [ ] Implement Directory Service Graph integration
   - [ ] Create E2E contract test harness

2. **Short-term** (Days 3-4)
   - [ ] Implement Neighbourhood Service internal data provider integration
   - [ ] Implement Booking Service persistence
   - [ ] Integrate Recommendation Service heuristics

3. **Polish** (Days 5-6)
   - [ ] Integrate Foundry model (optional)
   - [ ] End-to-end testing
   - [ ] Helm deployment to AKS
   - [ ] Performance profiling

## References

- [Contracts Package](packages/contracts/src/index.ts)
- [Auth Package](packages/auth/src/index.ts)
- [Shared Plan](../PLAN.md)
- [Original Requirements](../README.md)
