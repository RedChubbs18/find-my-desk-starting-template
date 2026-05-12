// ============================================================================
// Core Domain Types
// ============================================================================

export type UserId = string & { readonly __brand: 'UserId' };
export type DeskId = string & { readonly __brand: 'DeskId' };
export type NeighbourhoodId = string & { readonly __brand: 'NeighbourhoodId' };
export type OfficeId = string & { readonly __brand: 'OfficeId' };
export type BookingId = string & { readonly __brand: 'BookingId' };
export type RecommendationId = string & { readonly __brand: 'RecommendationId' };
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

export function makeUserId(value: string): UserId {
  return value as UserId;
}
export function makeDeskId(value: string): DeskId {
  return value as DeskId;
}
export function makeNeighbourhoodId(value: string): NeighbourhoodId {
  return value as NeighbourhoodId;
}
export function makeOfficeId(value: string): OfficeId {
  return value as OfficeId;
}
export function makeBookingId(value: string): BookingId {
  return value as BookingId;
}
export function makeRecommendationId(value: string): RecommendationId {
  return value as RecommendationId;
}
export function makeCorrelationId(value: string): CorrelationId {
  return value as CorrelationId;
}

// ============================================================================
// Auth & Identity
// ============================================================================

export interface AuthContext {
  userId: UserId;
  email: string;
  displayName: string;
  correlationId: CorrelationId;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
}

export interface ServiceIdentity {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  scope: string[];
}

// ============================================================================
// API Request/Response Envelopes
// ============================================================================

export interface ApiRequest<T = unknown> {
  correlationId: CorrelationId;
  userId?: UserId;
  timestamp: Date;
  payload: T;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  correlationId: CorrelationId;
  data?: T;
  error?: ApiError;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

// ============================================================================
// Directory Service Contracts
// ============================================================================

export interface UserProfile {
  id: UserId;
  email: string;
  displayName: string;
  team: string;
  role: string;
  location: string;
  lineManager?: {
    name: string;
    email: string;
  };
  anchorDays: string[];
  defaultWorkingPattern: Record<string, 'office' | 'remote'>;
  preferredNeighbourhood: string;
  deskPreferences: string[];
  accessibilityNeeds?: string;
  bookingWindowDays: number;
}

export interface TeamNode {
  teamId: string;
  name: string;
  members: UserId[];
}

export interface ManagerRelationship {
  reporterId: UserId;
  managerId: UserId;
  managerName: string;
  managerEmail: string;
}

export interface CollaborationSignal {
  sourceType: 'explicit' | 'org' | 'chat' | 'email' | 'calendar' | 'history';
  fromUserId: UserId;
  toUserId: UserId;
  score: number; // 0.0 to 1.0
  dateWindow: {
    start: Date;
    end: Date;
  };
}

// Directory Service API
export namespace DirectoryServiceApi {
  export interface GetUserRequest {
    userId: UserId;
  }

  export interface GetUserResponse {
    user: UserProfile;
  }

  export interface ListCollaboratorsRequest {
    userId: UserId;
    includeOrgGraph?: boolean;
  }

  export interface ListCollaboratorsResponse {
    collaborators: UserProfile[];
    signals: CollaborationSignal[];
  }

  export interface QueryCollaborationSignalsRequest {
    userId: UserId;
    collaboratorIds: UserId[];
    dateWindow?: {
      start: Date;
      end: Date;
    };
  }

  export interface QueryCollaborationSignalsResponse {
    signals: CollaborationSignal[];
    graphSnapshot: CollaborationEdge[];
  }
}

export interface CollaborationEdge {
  fromUserId: UserId;
  toUserId: UserId;
  normalizedWeight: number; // 0.0 to 1.0
}

// ============================================================================
// Neighbourhood Service Contracts
// ============================================================================

export interface Office {
  id: OfficeId;
  name: string;
  location: string;
  floors: Floor[];
}

export interface Floor {
  id: string;
  number: number;
  neighbourhoods: Neighbourhood[];
}

export interface Neighbourhood {
  id: NeighbourhoodId;
  name: string;
  officeId: OfficeId;
  floorId: string;
  description: string;
  features: string[];
  totalDesks: number;
  coordinate?: {
    x: number;
    y: number;
  };
}

export interface Desk {
  id: DeskId;
  neighbourhoodId: NeighbourhoodId;
  officeId: OfficeId;
  floorId: string;
  deskNumber: string;
  features: string[];
  isAccessible: boolean;
  coordinate?: {
    x: number;
    y: number;
  };
}

export interface AvailabilitySlot {
  officeId: OfficeId;
  deskId: DeskId;
  date: string; // ISO 8601 date
  isAvailable: boolean;
  sourceTimestamp: Date;
}

export interface TeamSeatingAssignment {
  teamId: string;
  officeId: OfficeId;
  neighbourhoodId: NeighbourhoodId;
  primaryFloor: string;
  members: UserId[];
}

// Neighbourhood Service API
export namespace NeighbourhoodServiceApi {
  export interface ListNeighbourhoodsRequest {
    officeId: OfficeId;
  }

  export interface ListNeighbourhoodsResponse {
    neighbourhoods: Neighbourhood[];
  }

  export interface GetAvailabilityRequest {
    officeId: OfficeId;
    date: string; // ISO 8601
  }

  export interface GetAvailabilityResponse {
    slots: AvailabilitySlot[];
  }

  export interface GetFloorplansRequest {
    officeId: OfficeId;
  }

  export interface GetFloorplansResponse {
    floors: Floor[];
  }

  export interface GetTeamSeatingRequest {
    officeId: OfficeId;
  }

  export interface GetTeamSeatingResponse {
    assignments: TeamSeatingAssignment[];
  }
}

// ============================================================================
// Booking Service Contracts
// ============================================================================

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface Booking {
  id: BookingId;
  userId: UserId;
  officeId: OfficeId;
  deskId: DeskId;
  neighbourhoodId: NeighbourhoodId;
  bookingDate: string; // ISO 8601
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  collaboratorIds: UserId[];
  recommendationSnapshotId?: RecommendationId;
}

export interface BookingStatusHistory {
  id: string;
  bookingId: BookingId;
  previousStatus: BookingStatus;
  newStatus: BookingStatus;
  changedBy: UserId;
  changedAt: Date;
  reason?: string;
}

export interface BookingCollaborator {
  bookingId: BookingId;
  collaboratorUserId: UserId;
  signalWeight: number;
}

export interface RecommendationSnapshot {
  id: RecommendationId;
  bookingId?: BookingId;
  candidateSet: DeskCandidate[];
  selectedDeskId: DeskId;
  selectedNeighbourhoodId: NeighbourhoodId;
  modelVersion: string;
  rationale: string;
  createdAt: Date;
}

export interface DeskCandidate {
  deskId: DeskId;
  neighbourhoodId: NeighbourhoodId;
  score: number;
  rationale: string;
}

// Booking Service API
export namespace BookingServiceApi {
  export interface CreateBookingRequest {
    userId: UserId;
    officeId: OfficeId;
    deskId: DeskId;
    neighbourhoodId: NeighbourhoodId;
    bookingDate: string; // ISO 8601
    collaboratorIds: UserId[];
    recommendationSnapshotId?: RecommendationId;
  }

  export interface CreateBookingResponse {
    booking: Booking;
  }

  export interface GetBookingRequest {
    bookingId: BookingId;
  }

  export interface GetBookingResponse {
    booking: Booking;
    history: BookingStatusHistory[];
  }

  export interface ListUserBookingsRequest {
    userId: UserId;
    officeId?: OfficeId;
  }

  export interface ListUserBookingsResponse {
    bookings: Booking[];
  }

  export interface CancelBookingRequest {
    bookingId: BookingId;
    reason?: string;
  }

  export interface CancelBookingResponse {
    booking: Booking;
  }
}

// ============================================================================
// Recommendation Service Contracts
// ============================================================================

export interface RecommendationRequest {
  userId: UserId;
  officeId: OfficeId;
  bookingDate: string; // ISO 8601
  explicitCollaborators: UserId[];
  maxCandidates?: number;
}

export interface RecommendationResponse {
  candidates: DeskCandidate[];
  topRecommendation: DeskCandidate;
  explanation: string;
  confidence: number;
  processingTimeMs: number;
}

export interface RecommendationExplanation {
  deskId: DeskId;
  neighbourhoodId: NeighbourhoodId;
  factors: {
    collaborationScore: number;
    proximityScore: number;
    preferenceScore: number;
    availabilityScore: number;
  };
  reasoning: string;
}

// Recommendation Service API
export namespace RecommendationServiceApi {
  export interface RecommendRequest {
    userId: UserId;
    officeId: OfficeId;
    bookingDate: string;
    collaborators: UserId[];
  }

  export interface RecommendResponse {
    candidates: DeskCandidate[];
    topRecommendation: DeskCandidate;
    explanation: RecommendationExplanation;
    confidence: number;
  }

  export interface ExplainRequest {
    deskId: DeskId;
    userId: UserId;
  }

  export interface ExplainResponse {
    explanation: RecommendationExplanation;
  }
}

// ============================================================================
// BFF API Contracts
// ============================================================================

export namespace BffApi {
  export interface RecommendationQuery {
    bookingDate: string;
    collaborators: UserId[];
  }

  export interface RecommendationQueryResponse {
    candidates: DeskCandidate[];
    topRecommendation: DeskCandidate;
    neighbourhoodContext: Neighbourhood;
    deskContext: Desk;
    explanation: RecommendationExplanation;
  }

  export interface BookingCreateRequest {
    deskId: DeskId;
    neighbourhoodId: NeighbourhoodId;
    bookingDate: string;
    collaborators: UserId[];
  }

  export interface BookingCreateResponse {
    booking: Booking;
    confirmation: {
      bookingId: BookingId;
      deskNumber: string;
      neighbourhoodName: string;
      date: string;
    };
  }

  export interface UserContextResponse {
    user: UserProfile;
    office: Office;
  }
}

// ============================================================================
// Health & Observability
// ============================================================================

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  dependencies: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
}

export interface TraceContext {
  correlationId: CorrelationId;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  traceContext: TraceContext;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
