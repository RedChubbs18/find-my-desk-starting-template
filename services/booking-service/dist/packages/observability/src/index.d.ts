import { LogEntry, TraceContext } from '@team-orbit/contracts';
export { LogEntry, TraceContext };
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export interface Logger {
    debug(message: string, metadata?: Record<string, unknown>): void;
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
}
export declare class ConsoleLogger implements Logger {
    private serviceName;
    private traceContext;
    constructor(serviceName: string, traceContext: TraceContext);
    debug(message: string, metadata?: Record<string, unknown>): void;
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
    private log;
}
export interface MetricCollector {
    recordLatency(operation: string, durationMs: number, metadata?: Record<string, unknown>): void;
    recordCounter(metric: string, increment?: number, metadata?: Record<string, unknown>): void;
    recordGauge(metric: string, value: number, metadata?: Record<string, unknown>): void;
}
export declare class NoopMetricCollector implements MetricCollector {
    recordLatency(): void;
    recordCounter(): void;
    recordGauge(): void;
}
export declare class ConsoleMetricCollector implements MetricCollector {
    private serviceName;
    constructor(serviceName: string);
    recordLatency(operation: string, durationMs: number, metadata?: Record<string, unknown>): void;
    recordCounter(metric: string, increment?: number, metadata?: Record<string, unknown>): void;
    recordGauge(metric: string, value: number, metadata?: Record<string, unknown>): void;
}
