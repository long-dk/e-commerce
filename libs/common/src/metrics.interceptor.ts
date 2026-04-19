import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { LoggerService } from './logger.service';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

/**
 * HTTP Request Metrics Interceptor
 * Automatically tracks request duration, size, and response metrics
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private serviceName: string;

  constructor(
    private prometheusMetrics: PrometheusMetricsService,
    private readonly logger: LoggerService,
  ) {
    this.serviceName = process.env.SERVICE_NAME || 'unknown';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const info = gqlContext.getInfo();
      const parentType = info.parentType.name;
      const fieldName = info.fieldName;
      const endpoint = `${parentType}.${fieldName}`;

      const startTime = Date.now();

      return next.handle().pipe(
        tap((data) => {
          const duration = Date.now() - startTime;

          this.prometheusMetrics.recordHttpRequest(
            this.serviceName,
            'GRAPHQL',
            endpoint,
            200,
            duration,
          );

          this.logger.debug(`GRAPHQL ${endpoint} 200 ${duration}ms`);
        }),
        catchError((error) => {
          const duration = Date.now() - startTime;

          this.prometheusMetrics.recordHttpRequest(
            this.serviceName,
            'GRAPHQL',
            endpoint,
            500,
            duration,
          );

          this.logger.warn(
            `GRAPHQL ${endpoint} 500 ${duration}ms - Error: ${error.message}`,
          );

          throw error;
        }),
      );
    }
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const method = request.method;
    const url = request.url;
    const endpoint = this.normalizeEndpoint(url);

    // Get request size
    const requestSize = request.get('content-length')
      ? parseInt(request.get('content-length'), 10)
      : undefined;

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const responseSize = response.get('content-length')
          ? parseInt(response.get('content-length'), 10)
          : undefined;

        // Record metrics
        this.prometheusMetrics.recordHttpRequest(
          this.serviceName,
          method,
          endpoint,
          statusCode,
          duration,
          requestSize,
          responseSize,
        );

        this.logger.debug(
          `${method} ${endpoint} ${statusCode} ${duration}ms`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode || 500;

        this.prometheusMetrics.recordHttpRequest(
          this.serviceName,
          method,
          endpoint,
          statusCode,
          duration,
          requestSize,
          undefined,
        );

        this.logger.warn(
          `${method} ${endpoint} ${statusCode} ${duration}ms - Error: ${error.message}`,
        );

        throw error;
      }),
    );
  }

  /**
   * Normalize endpoint URL by removing dynamic parts
   * /api/orders/123 -> /api/orders/:id
   * /api/products/abc -> /api/products/:id
   */
  private normalizeEndpoint(url: string): string {
    let endpoint = url.split('?')[0]; // Remove query params

    // Normalize common patterns
    endpoint = endpoint.replace(/\/\d+([/?]|$)/g, '/:id$1'); // /:id
    endpoint = endpoint.replace(
      /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}([/?]|$)/g,
      '/:uuid$1',
    ); // /:uuid

    return endpoint || '/';
  }
}
