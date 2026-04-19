import { Injectable } from '@nestjs/common';
import { LoggerBase } from './logger.service';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;        // Number of failures before opening (default: 5)
  successThreshold?: number;        // Number of successes in HALF_OPEN to close (default: 2)
  timeout?: number;                 // Time in ms before attempting recovery (default: 60000)
  onStateChange?: (newState: CircuitBreakerState) => void;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  openedAt?: Date;
  lastErrorMessage?: string;
}

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures in microservices by stopping requests to failing services
 */
@Injectable()
export class CircuitBreakerService extends LoggerBase {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private openedAt?: Date;
  private lastErrorMessage?: string;

  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (this.isTimeoutPassed()) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      } else {
        const error = new Error(
          `Circuit breaker is OPEN for ${this.config.name}. ` +
          `Last error: ${this.lastErrorMessage}`
        );
        (error as any).code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Get current circuit breaker state and metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      openedAt: this.openedAt,
      lastErrorMessage: this.lastErrorMessage,
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.openedAt = undefined;
    this.lastErrorMessage = undefined;
    this.logger.log(`Circuit breaker ${this.config.name} has been reset`);
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.transitionTo(CircuitBreakerState.OPEN);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastErrorMessage = 
      error instanceof Error ? error.message : String(error);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionTo(CircuitBreakerState.OPEN);
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.transitionTo(CircuitBreakerState.OPEN);
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitBreakerState.OPEN) {
      this.openedAt = new Date();
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.openedAt = undefined;
      this.failureCount = 0;
    }

    this.logger.warn(
      `Circuit breaker ${this.config.name} transitioned: ` +
      `${oldState} -> ${newState}`
    );

    this.config.onStateChange(newState);
  }

  private isTimeoutPassed(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt.getTime() >= this.config.timeout;
  }
}

/**
 * Factory for managing circuit breakers
 */
@Injectable()
export class CircuitBreakerFactory extends LoggerBase {
  private breakers = new Map<string, CircuitBreakerService>();

  /**
   * Get or create a circuit breaker for a service
   */
  getOrCreate(config: CircuitBreakerConfig): CircuitBreakerService {
    if (this.breakers.has(config.name)) {
      return this.breakers.get(config.name)!;
    }

    const breaker = new CircuitBreakerService(config);
    this.breakers.set(config.name, breaker);
    this.logger.log(`Created circuit breaker for ${config.name}`);

    return breaker;
  }

  /**
   * Get existing circuit breaker
   */
  get(name: string): CircuitBreakerService | undefined {
    return this.breakers.get(name);
  }

  /**
   * List all circuit breakers and their states
   */
  getAll(): Map<string, CircuitBreakerMetrics> {
    const result = new Map<string, CircuitBreakerMetrics>();
    for (const [name, breaker] of this.breakers) {
      result.set(name, breaker.getMetrics());
    }
    return result;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.logger.log('All circuit breakers have been reset');
  }
}
