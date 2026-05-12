import { LogEntry, TraceContext, CorrelationId } from '@team-orbit/contracts';

export { LogEntry, TraceContext };

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  constructor(
    private serviceName: string,
    private traceContext: TraceContext
  ) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    this.log(LogLevel.ERROR, message, errorMetadata);
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      traceContext: this.traceContext,
      metadata,
      timestamp: new Date(),
    };
    console.log(JSON.stringify(entry));
  }
}

export interface MetricCollector {
  recordLatency(operation: string, durationMs: number, metadata?: Record<string, unknown>): void;
  recordCounter(metric: string, increment?: number, metadata?: Record<string, unknown>): void;
  recordGauge(metric: string, value: number, metadata?: Record<string, unknown>): void;
}

export class NoopMetricCollector implements MetricCollector {
  recordLatency(): void {}
  recordCounter(): void {}
  recordGauge(): void {}
}

export class ConsoleMetricCollector implements MetricCollector {
  constructor(private serviceName: string) {}

  recordLatency(operation: string, durationMs: number, metadata?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        type: 'metric',
        service: this.serviceName,
        metric: 'latency',
        operation,
        durationMs,
        metadata,
        timestamp: new Date().toISOString(),
      })
    );
  }

  recordCounter(metric: string, increment = 1, metadata?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        type: 'metric',
        service: this.serviceName,
        metric,
        increment,
        metadata,
        timestamp: new Date().toISOString(),
      })
    );
  }

  recordGauge(metric: string, value: number, metadata?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        type: 'metric',
        service: this.serviceName,
        metric,
        value,
        metadata,
        timestamp: new Date().toISOString(),
      })
    );
  }
}
