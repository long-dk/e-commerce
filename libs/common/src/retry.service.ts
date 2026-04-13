import { Injectable, Logger } from '@nestjs/common';

export enum BackoffStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIXED = 'fixed',
}

export interface RetryConfig {
  maxAttempts?: number;                    // Max number of attempts (default: 3)
  initialDelay?: number;                   // Initial delay in ms (default: 100)
  maxDelay?: number;                       // Max delay in ms (default: 30000)
  backoffStrategy?: BackoffStrategy;       // Backoff strategy (default: exponential)
  backoffMultiplier?: number;              // Multiplier for exponential backoff (default: 2)
  jitterFactor?: number;                   // Jitter 0-1 (default: 0.1)
  retryableStatusCodes?: number[];         // HTTP status codes to retry (default: [408, 429, 500, 502, 503, 504])
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

export interface RetryMetrics {
  totalAttempts: number;
  successAttempts: number;
  failedAttempts: number;
  timeoutRetries: number;
}

/**
 * Retry with Exponential Backoff Implementation
 * Automatically retries failed requests with increasing delays
 */
@Injectable()
export class RetryService {
  private readonly config: Required<RetryConfig>;
  private readonly logger = new Logger(RetryService.name);
  private metrics: RetryMetrics = {
    totalAttempts: 0,
    successAttempts: 0,
    failedAttempts: 0,
    timeoutRetries: 0,
  };

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 3,
      initialDelay: config.initialDelay ?? 100,
      maxDelay: config.maxDelay ?? 30000,
      backoffStrategy: config.backoffStrategy ?? BackoffStrategy.EXPONENTIAL,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitterFactor: config.jitterFactor ?? 0.1,
      retryableStatusCodes: config.retryableStatusCodes ?? [408, 429, 500, 502, 503, 504],
      shouldRetry: config.shouldRetry ?? this.defaultShouldRetry.bind(this),
      onRetry: config.onRetry ?? this.defaultOnRetry.bind(this),
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, fnName: string = 'operation'): Promise<T> {
    let lastError: unknown;
    let lastDelay = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        this.metrics.totalAttempts++;
        const result = await fn();
        this.metrics.successAttempts++;
        return result;
      } catch (error) {
        this.metrics.failedAttempts++;
        lastError = error;

        const shouldRetry = this.config.shouldRetry(error, attempt);
        if (!shouldRetry || attempt === this.config.maxAttempts) {
          break;
        }

        lastDelay = this.calculateDelay(attempt);
        this.metrics.timeoutRetries++;
        this.config.onRetry(attempt, lastDelay, error);

        // Wait before retrying
        await this.sleep(lastDelay);
      }
    }

    throw lastError;
  }

  /**
   * Get retry metrics
   */
  getMetrics(): RetryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successAttempts: 0,
      failedAttempts: 0,
      timeoutRetries: 0,
    };
  }

  private defaultShouldRetry(error: unknown, _attempt: number): boolean {
    // Check if it's a retryable error
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('ECONNREFUSED') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('EHOSTUNREACH') ||
          error.message.includes('ENETUNREACH')) {
        return true;
      }

      // Timeout errors
      if (error.message.includes('timeout')) {
        return true;
      }
    }

    // Check HTTP status codes
    if ((error as any)?.response?.status) {
      const status = (error as any).response.status;
      return this.config.retryableStatusCodes.includes(status);
    }

    return false;
  }

  private defaultOnRetry(attempt: number, delay: number, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Retry attempt ${attempt} after ${delay}ms. Error: ${message}`
    );
  }

  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.backoffStrategy) {
      case BackoffStrategy.LINEAR:
        delay = this.config.initialDelay * attempt;
        break;

      case BackoffStrategy.FIXED:
        delay = this.config.initialDelay;
        break;

      case BackoffStrategy.EXPONENTIAL:
      default:
        delay = this.config.initialDelay * Math.pow(
          this.config.backoffMultiplier,
          attempt - 1
        );
        break;
    }

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter
    const jitter = delay * this.config.jitterFactor * Math.random();
    return Math.round(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Pre-configured retry services
 */
@Injectable()
export class RetryFactory {
  private readonly logger = new Logger(RetryFactory.name);

  /**
   * Create a retry service for HTTP requests
   */
  createHttpRetry(maxAttempts: number = 3): RetryService {
    return new RetryService({
      maxAttempts,
      initialDelay: 100,
      maxDelay: 10000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    });
  }

  /**
   * Create a retry service for database operations
   */
  createDatabaseRetry(maxAttempts: number = 3): RetryService {
    return new RetryService({
      maxAttempts,
      initialDelay: 50,
      maxDelay: 5000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      backoffMultiplier: 1.5,
      jitterFactor: 0.2,
    });
  }

  /**
   * Create a retry service for external APIs
   */
  createExternalApiRetry(maxAttempts: number = 5): RetryService {
    return new RetryService({
      maxAttempts,
      initialDelay: 200,
      maxDelay: 30000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      backoffMultiplier: 2,
      jitterFactor: 0.15,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    });
  }

  /**
   * Create a custom retry service
   */
  createCustom(config: RetryConfig): RetryService {
    return new RetryService(config);
  }
}
