import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerService } from './logger.service';
import { CircuitBreakerFactory } from './circuit-breaker.service';
import { RetryFactory } from './retry.service';
import { ResilientHttpClientFactory } from './resilient-http-client.service';

/**
 * Common module that provides shared services for all microservices
 * Includes logging, resilience patterns (circuit breaker, retry with backoff), and caching
 */
@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    LoggerService,
    CircuitBreakerFactory,
    RetryFactory,
    ResilientHttpClientFactory,
  ],
  exports: [
    LoggerService,
    CircuitBreakerFactory,
    RetryFactory,
    ResilientHttpClientFactory,
    HttpModule,
  ],
})
export class CommonModule {}
