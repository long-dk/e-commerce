import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CircuitBreakerService, CircuitBreakerFactory, CircuitBreakerConfig } from './circuit-breaker.service';
import { RetryService, RetryFactory, RetryConfig } from './retry.service';

export interface ResilientHttpClientConfig {
  serviceName: string;
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
}

/**
 * Resilient HTTP Client combining Circuit Breaker and Retry with Backoff
 * Provides fault-tolerant HTTP communication between microservices
 */
@Injectable()
export class ResilientHttpClient {
  private circuitBreaker: CircuitBreakerService;
  private retryService: RetryService;
  private readonly logger: Logger;

  constructor(
    private httpService: HttpService,
    config: ResilientHttpClientConfig,
    circuitBreakerFactory?: CircuitBreakerFactory,
    retryFactory?: RetryFactory,
  ) {
    this.logger = new Logger(`ResilientHttpClient[${config.serviceName}]`);

    // Initialize circuit breaker
    const cbFactory = circuitBreakerFactory || new CircuitBreakerFactory();
    const cbConfig: CircuitBreakerConfig = {
      name: `http-${config.serviceName}`,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      ...config.circuitBreaker,
      onStateChange: (newState) => {
        this.logger.warn(
          `Circuit breaker state changed to ${newState} for ${config.serviceName}`
        );
        config.circuitBreaker?.onStateChange?.(newState);
      },
    };
    this.circuitBreaker = cbFactory.getOrCreate(cbConfig);

    // Initialize retry service
    const rfactory = retryFactory || new RetryFactory();
    this.retryService = rfactory.createHttpRetry(
      config.retry?.maxAttempts ?? 3
    );
  }

  /**
   * GET request with resilience
   */
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithResilience<T>(() =>
      firstValueFrom(this.httpService.get<T>(url, config))
    );
  }

  /**
   * POST request with resilience
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithResilience<T>(() =>
      firstValueFrom(this.httpService.post<T>(url, data, config))
    );
  }

  /**
   * PUT request with resilience
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithResilience<T>(() =>
      firstValueFrom(this.httpService.put<T>(url, data, config))
    );
  }

  /**
   * PATCH request with resilience
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithResilience<T>(() =>
      firstValueFrom(this.httpService.patch<T>(url, data, config))
    );
  }

  /**
   * DELETE request with resilience
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithResilience<T>(() =>
      firstValueFrom(this.httpService.delete<T>(url, config))
    );
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Get retry metrics
   */
  getRetryMetrics() {
    return this.retryService.getMetrics();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Reset retry metrics
   */
  resetRetryMetrics(): void {
    this.retryService.resetMetrics();
  }

  private async executeWithResilience<T>(
    fn: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.circuitBreaker.execute(() =>
        this.retryService.execute(fn, 'HTTP request')
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    const axiosError = error as any;

    // Handle circuit breaker open
    if (axiosError?.code === 'CIRCUIT_BREAKER_OPEN') {
      this.logger.error(`Circuit breaker is open: ${axiosError.message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Service temporarily unavailable. Circuit breaker is open.',
          error: 'Service Unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    // Handle timeout
    if (
      axiosError?.code === 'ECONNABORTED' ||
      axiosError?.message?.includes('timeout')
    ) {
      this.logger.error(`Request timeout: ${axiosError.message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message: 'Request timeout after retries',
          error: 'Request Timeout',
        },
        HttpStatus.REQUEST_TIMEOUT
      );
    }

    // Handle network errors
    if (
      axiosError?.code === 'ECONNREFUSED' ||
      axiosError?.code === 'ENOTFOUND'
    ) {
      this.logger.error(`Network error: ${axiosError.message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'Network error. Service unreachable.',
          error: 'Bad Gateway',
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    // Handle HTTP errors from server
    if (axiosError?.response?.status) {
      const status = axiosError.response.status;
      throw new HttpException(
        {
          statusCode: status,
          message: axiosError.response.data?.message || axiosError.message,
          error: axiosError.response.statusText,
        },
        status
      );
    }

    // Generic error
    this.logger.error(`HTTP request failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Factory for managing resilient HTTP clients
 */
@Injectable()
export class ResilientHttpClientFactory {
  private clients = new Map<string, ResilientHttpClient>();
  private readonly logger = new Logger(ResilientHttpClientFactory.name);

  constructor(
    private httpService: HttpService,
    private circuitBreakerFactory: CircuitBreakerFactory,
    private retryFactory: RetryFactory,
  ) {}

  /**
   * Get or create a resilient HTTP client
   */
  getOrCreate(config: ResilientHttpClientConfig): ResilientHttpClient {
    if (this.clients.has(config.serviceName)) {
      return this.clients.get(config.serviceName)!;
    }

    const client = new ResilientHttpClient(
      this.httpService,
      config,
      this.circuitBreakerFactory,
      this.retryFactory,
    );

    this.clients.set(config.serviceName, client);
    this.logger.log(`Created resilient HTTP client for ${config.serviceName}`);

    return client;
  }

  /**
   * Get existing client
   */
  get(serviceName: string): ResilientHttpClient | undefined {
    return this.clients.get(serviceName);
  }

  /**
   * Get all clients and their health status
   */
  getAll(): Map<string, { metrics: any }> {
    const result = new Map<string, { metrics: any }>();
    for (const [name, client] of this.clients) {
      result.set(name, {
        metrics: {
          circuitBreaker: client.getCircuitBreakerMetrics(),
          retry: client.getRetryMetrics(),
        },
      });
    }
    return result;
  }
}
