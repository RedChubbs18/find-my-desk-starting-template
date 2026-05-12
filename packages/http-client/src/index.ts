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

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly response?: unknown
  ) {
    super(message);
  }
}

export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelayMs: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelayMs = config.retryDelayMs || 1000;
  }

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    return this.requestWithRetry(req, 0);
  }

  private async requestWithRetry<T = unknown>(
    req: HttpRequest,
    attempt: number
  ): Promise<HttpResponse<T>> {
    try {
      const url = `${this.baseUrl}${req.path}`;
      const headers: HttpHeaders = {
        'Content-Type': 'application/json',
        'x-correlation-id': req.correlationId,
        ...req.headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method: req.method,
          headers,
          body: req.body ? JSON.stringify(req.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new HttpError(response.status, `HTTP ${response.status}`, errorBody);
        }

        const body = await response.json() as T;
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await this.delay(this.retryDelayMs * (attempt + 1));
        return this.requestWithRetry(req, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async get<T = unknown>(path: string, correlationId: CorrelationId): Promise<T> {
    const response = await this.request<T>({
      method: 'GET',
      path,
      correlationId,
    });
    return response.body;
  }

  async post<T = unknown>(
    path: string,
    body: unknown,
    correlationId: CorrelationId
  ): Promise<T> {
    const response = await this.request<T>({
      method: 'POST',
      path,
      body,
      correlationId,
    });
    return response.body;
  }

  async put<T = unknown>(
    path: string,
    body: unknown,
    correlationId: CorrelationId
  ): Promise<T> {
    const response = await this.request<T>({
      method: 'PUT',
      path,
      body,
      correlationId,
    });
    return response.body;
  }

  async delete<T = unknown>(path: string, correlationId: CorrelationId): Promise<T> {
    const response = await this.request<T>({
      method: 'DELETE',
      path,
      correlationId,
    });
    return response.body;
  }
}
