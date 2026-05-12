export type UserId = string & {
    readonly __brand: 'UserId';
};
export type DeskId = string & {
    readonly __brand: 'DeskId';
};
export type NeighbourhoodId = string & {
    readonly __brand: 'NeighbourhoodId';
};
export type OfficeId = string & {
    readonly __brand: 'OfficeId';
};
export type BookingId = string & {
    readonly __brand: 'BookingId';
};
export type RecommendationId = string & {
    readonly __brand: 'RecommendationId';
};
export type CorrelationId = string & {
    readonly __brand: 'CorrelationId';
};
export declare function makeUserId(value: string): UserId;
export declare function makeDeskId(value: string): DeskId;
export declare function makeNeighbourhoodId(value: string): NeighbourhoodId;
export declare function makeOfficeId(value: string): OfficeId;
export declare function makeBookingId(value: string): BookingId;
export declare function makeRecommendationId(value: string): RecommendationId;
export declare function makeCorrelationId(value: string): CorrelationId;
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
export declare enum ErrorCode {
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    NOT_FOUND = "NOT_FOUND",
    CONFLICT = "CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    RATE_LIMITED = "RATE_LIMITED"
}
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
    score: number;
    dateWindow: {
        start: Date;
        end: Date;
    };
}
export declare namespace DirectoryServiceApi {
    interface GetUserRequest {
        userId: UserId;
    }
    interface GetUserResponse {
        user: UserProfile;
    }
    interface ListCollaboratorsRequest {
        userId: UserId;
        includeOrgGraph?: boolean;
    }
    interface ListCollaboratorsResponse {
        collaborators: UserProfile[];
        signals: CollaborationSignal[];
    }
    interface QueryCollaborationSignalsRequest {
        userId: UserId;
        collaboratorIds: UserId[];
        dateWindow?: {
            start: Date;
            end: Date;
        };
    }
    interface QueryCollaborationSignalsResponse {
        signals: CollaborationSignal[];
        graphSnapshot: CollaborationEdge[];
    }
}
export interface CollaborationEdge {
    fromUserId: UserId;
    toUserId: UserId;
    normalizedWeight: number;
}
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
    date: string;
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
export declare namespace NeighbourhoodServiceApi {
    interface ListNeighbourhoodsRequest {
        officeId: OfficeId;
    }
    interface ListNeighbourhoodsResponse {
        neighbourhoods: Neighbourhood[];
    }
    interface GetAvailabilityRequest {
        officeId: OfficeId;
        date: string;
    }
    interface GetAvailabilityResponse {
        slots: AvailabilitySlot[];
    }
    interface GetFloorplansRequest {
        officeId: OfficeId;
    }
    interface GetFloorplansResponse {
        floors: Floor[];
    }
    interface GetTeamSeatingRequest {
        officeId: OfficeId;
    }
    interface GetTeamSeatingResponse {
        assignments: TeamSeatingAssignment[];
    }
}
export declare enum BookingStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED"
}
export interface Booking {
    id: BookingId;
    userId: UserId;
    officeId: OfficeId;
    deskId: DeskId;
    neighbourhoodId: NeighbourhoodId;
    bookingDate: string;
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
export declare namespace BookingServiceApi {
    interface CreateBookingRequest {
        userId: UserId;
        officeId: OfficeId;
        deskId: DeskId;
        neighbourhoodId: NeighbourhoodId;
        bookingDate: string;
        collaboratorIds: UserId[];
        recommendationSnapshotId?: RecommendationId;
    }
    interface CreateBookingResponse {
        booking: Booking;
    }
    interface GetBookingRequest {
        bookingId: BookingId;
    }
    interface GetBookingResponse {
        booking: Booking;
        history: BookingStatusHistory[];
    }
    interface ListUserBookingsRequest {
        userId: UserId;
        officeId?: OfficeId;
    }
    interface ListUserBookingsResponse {
        bookings: Booking[];
    }
    interface CancelBookingRequest {
        bookingId: BookingId;
        reason?: string;
    }
    interface CancelBookingResponse {
        booking: Booking;
    }
}
export interface RecommendationRequest {
    userId: UserId;
    officeId: OfficeId;
    bookingDate: string;
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
export declare namespace RecommendationServiceApi {
    interface RecommendRequest {
        userId: UserId;
        officeId: OfficeId;
        bookingDate: string;
        collaborators: UserId[];
    }
    interface RecommendResponse {
        candidates: DeskCandidate[];
        topRecommendation: DeskCandidate;
        explanation: RecommendationExplanation;
        confidence: number;
    }
    interface ExplainRequest {
        deskId: DeskId;
        userId: UserId;
    }
    interface ExplainResponse {
        explanation: RecommendationExplanation;
    }
}
export declare namespace BffApi {
    interface RecommendationQuery {
        bookingDate: string;
        collaborators: UserId[];
    }
    interface RecommendationQueryResponse {
        candidates: DeskCandidate[];
        topRecommendation: DeskCandidate;
        neighbourhoodContext: Neighbourhood;
        deskContext: Desk;
        explanation: RecommendationExplanation;
    }
    interface BookingCreateRequest {
        deskId: DeskId;
        neighbourhoodId: NeighbourhoodId;
        bookingDate: string;
        collaborators: UserId[];
    }
    interface BookingCreateResponse {
        booking: Booking;
        confirmation: {
            bookingId: BookingId;
            deskNumber: string;
            neighbourhoodName: string;
            date: string;
        };
    }
    interface UserContextResponse {
        user: UserProfile;
        office: Office;
    }
}
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
