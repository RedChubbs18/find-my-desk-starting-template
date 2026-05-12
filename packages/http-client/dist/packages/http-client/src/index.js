"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = exports.HttpError = void 0;
class HttpError extends Error {
    constructor(status, message, response) {
        super(message);
        this.status = status;
        this.response = response;
    }
}
exports.HttpError = HttpError;
class HttpClient {
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelayMs = config.retryDelayMs || 1000;
    }
    async request(req) {
        return this.requestWithRetry(req, 0);
    }
    async requestWithRetry(req, attempt) {
        try {
            const url = `${this.baseUrl}${req.path}`;
            const headers = {
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
                const body = await response.json();
                return {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body,
                };
            }
            catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }
        catch (error) {
            if (attempt < this.retryAttempts) {
                await this.delay(this.retryDelayMs * (attempt + 1));
                return this.requestWithRetry(req, attempt + 1);
            }
            throw error;
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async get(path, correlationId) {
        const response = await this.request({
            method: 'GET',
            path,
            correlationId,
        });
        return response.body;
    }
    async post(path, body, correlationId) {
        const response = await this.request({
            method: 'POST',
            path,
            body,
            correlationId,
        });
        return response.body;
    }
    async put(path, body, correlationId) {
        const response = await this.request({
            method: 'PUT',
            path,
            body,
            correlationId,
        });
        return response.body;
    }
    async delete(path, correlationId) {
        const response = await this.request({
            method: 'DELETE',
            path,
            correlationId,
        });
        return response.body;
    }
}
exports.HttpClient = HttpClient;
