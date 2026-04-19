import { Inject, Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export class TracingService {
  private static readonly logger = new Logger('TracingService');
  private static sdk: NodeSDK | null = null;

  /**
   * Initialize OpenTelemetry tracing with Jaeger exporter
   * Should be called at the very start of the application
   */
  static async initializeTracing(
    serviceName: string,
    jaegerEndpoint: string = 'http://localhost:4317',
  ): Promise<void> {
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '0.0.1',
    });

    // Create OTLP gRPC exporter for Jaeger
    const traceExporter = new OTLPTraceExporter({
      url: jaegerEndpoint,
    });

    // Create and start Node SDK with auto-instrumentation
    this.sdk = new NodeSDK({
      resource: resource,
      traceExporter: traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    try {
      await this.sdk.start();
      this.logger.log(
        `✅ OpenTelemetry tracing initialized for service: ${serviceName}`,
      );
      this.logger.log(`📤 Sending traces to Jaeger at ${jaegerEndpoint}`);
    } catch (error) {
      this.logger.error(`❌ Failed to initialize tracing: ${error}`);
      throw error;
    }
  }

  /**
   * Gracefully shutdown tracing
   */
  static async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log('✅ OpenTelemetry tracing shutdown gracefully');
      } catch (error) {
        this.logger.error(`❌ Error shutting down tracing: ${error}`);
      }
    }
  }

  /**
   * Get the global tracer instance
   */
  static getTracer(name: string = 'default'): ReturnType<typeof trace.getTracer> {
    return trace.getTracer(name);
  }

  /**
   * Get the current active span
   */
  static getActiveSpan() {
    return trace.getActiveSpan();
  }

  /**
   * Get the current context
   */
  static getActiveContext() {
    return context.active();
  }

  /**
   * Create a new span for a specific operation
   * Usage:
   * const span = TracingService.createSpan('operation-name', { 'attribute.key': 'value' });
   * try {
   *   // do work
   *   span.end();
   * } catch (error) {
   *   span.recordException(error);
   *   span.setStatus({ code: SpanStatusCode.ERROR });
   *   span.end();
   * }
   */
  static createSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ) {
    const tracer = this.getTracer();
    const span = tracer.startSpan(name);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }

    return span;
  }

  /**
   * Execute a function within a span context
   * Usage:
   * const result = await TracingService.withSpan('operation-name', async () => {
   *   return await someAsyncWork();
   * }, { 'db.system': 'mongodb' });
   */
  static async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const span = this.createSpan(name, attributes);

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute a synchronous function within a span context
   */
  static withSpanSync<T>(
    name: string,
    fn: () => T,
    attributes?: Record<string, string | number | boolean>,
  ): T {
    const span = this.createSpan(name, attributes);

    try {
      const result = context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}

// Export SpanStatusCode for convenience
export { SpanStatusCode };
