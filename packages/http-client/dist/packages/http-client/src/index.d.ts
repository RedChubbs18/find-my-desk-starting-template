import { CorrelationId } from '@team-orbit/contracts';
export interface HttpClientConfig {
    baseUrl: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
}
export interface HttpHeaders {
    [key: string]: string;
}
export interface HttpRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    headers?: HttpHeaders;
    body?: unknown;
    correlationId: CorrelationId;
}
export interface HttpResponse<T = unknown> {
    status: number;
    headers: Record<string, string>;
    body: T;
}
export declare class HttpError extends Error {
    readonly status: number;
    readonly response?: unknown | undefined;
    constructor(status: number, message: string, response?: unknown | undefined);
}
export declare class HttpClient {
    private baseUrl;
    private timeout;
    private retryAttempts;
    private retryDelayMs;
    constructor(config: HttpClientConfig);
    request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>>;
    private requestWithRetry;
    private delay;
    get<T = unknown>(path: string, correlationId: CorrelationId): Promise<T>;
    post<T = unknown>(path: string, body: unknown, correlationId: CorrelationId): Promise<T>;
    put<T = unknown>(path: string, body: unknown, correlationId: CorrelationId): Promise<T>;
    delete<T = unknown>(path: string, correlationId: CorrelationId): Promise<T>;
}
