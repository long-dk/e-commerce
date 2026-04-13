import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerService } from './logger.service';
import { CircuitBreakerFactory } from './circuit-breaker.service';
import { RetryFactory } from './retry.service';
import { ResilientHttpClientFactory } from './resilient-http-client.service';
import { CacheService } from './cache.service';
import { getRedisCacheConfig } from './cache.config';

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
    CacheModule.register(getRedisCacheConfig()),
  ],
  providers: [
    LoggerService,
    CircuitBreakerFactory,
    RetryFactory,
    ResilientHttpClientFactory,
    CacheService,
  ],
  exports: [
    LoggerService,
    CircuitBreakerFactory,
    RetryFactory,
    ResilientHttpClientFactory,
    CacheService,
    HttpModule,
    CacheModule,
  ],
})
export class CommonModule {}
