"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleMetricCollector = exports.NoopMetricCollector = exports.ConsoleLogger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class ConsoleLogger {
    constructor(serviceName, traceContext) {
        this.serviceName = serviceName;
        this.traceContext = traceContext;
    }
    debug(message, metadata) {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    info(message, metadata) {
        this.log(LogLevel.INFO, message, metadata);
    }
    warn(message, metadata) {
        this.log(LogLevel.WARN, message, metadata);
    }
    error(message, error, metadata) {
        const errorMetadata = {
            ...metadata,
            errorMessage: error?.message,
            errorStack: error?.stack,
        };
        this.log(LogLevel.ERROR, message, errorMetadata);
    }
    log(level, message, metadata) {
        const entry = {
            level,
            message,
            traceContext: this.traceContext,
            metadata,
            timestamp: new Date(),
        };
        console.log(JSON.stringify(entry));
    }
}
exports.ConsoleLogger = ConsoleLogger;
class NoopMetricCollector {
    recordLatency() { }
    recordCounter() { }
    recordGauge() { }
}
exports.NoopMetricCollector = NoopMetricCollector;
class ConsoleMetricCollector {
    constructor(serviceName) {
        this.serviceName = serviceName;
    }
    recordLatency(operation, durationMs, metadata) {
        console.log(JSON.stringify({
            type: 'metric',
            service: this.serviceName,
            metric: 'latency',
            operation,
            durationMs,
            metadata,
            timestamp: new Date().toISOString(),
        }));
    }
    recordCounter(metric, increment = 1, metadata) {
        console.log(JSON.stringify({
            type: 'metric',
            service: this.serviceName,
            metric,
            increment,
            metadata,
            timestamp: new Date().toISOString(),
        }));
    }
    recordGauge(metric, value, metadata) {
        console.log(JSON.stringify({
            type: 'metric',
            service: this.serviceName,
            metric,
            value,
            metadata,
            timestamp: new Date().toISOString(),
        }));
    }
}
exports.ConsoleMetricCollector = ConsoleMetricCollector;
