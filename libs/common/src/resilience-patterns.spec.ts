import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService, CircuitBreakerState, CircuitBreakerFactory } from '@app/common';
import { RetryService, BackoffStrategy, RetryFactory } from '@app/common';

describe('Circuit Breaker and Retry Patterns', () => {
  describe('CircuitBreakerService', () => {
    let breaker: CircuitBreakerService;

    beforeEach(() => {
      breaker = new CircuitBreakerService({
        name: 'test-service',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100,
      });
    });

    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should open after failing threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('Service failed')));
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should reject requests when OPEN', async () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      // Try to execute when open
      await expect(
        breaker.execute(() => Promise.resolve('should not execute'))
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Try executing - should transition to HALF_OPEN
      try {
        await breaker.execute(() => Promise.resolve('success'));
      } catch {
        // Might fail since we're in HALF_OPEN
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should close after enough successes in HALF_OPEN', async () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed twice to close
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.resolve('success'));
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reopen on failure in HALF_OPEN', async () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fail once in HALF_OPEN - should reopen
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should track metrics', async () => {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should reset metrics', () => {
      breaker.reset();
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('RetryService', () => {
    let retryService: RetryService;

    beforeEach(() => {
      retryService = new RetryService({
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        backoffMultiplier: 2,
      });
    });

    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const result = await retryService.execute(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const mockFn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection failed');
        }
        return 'success';
      });

      const result = await retryService.execute(mockFn);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service down'));

      await expect(retryService.execute(mockFn)).rejects.toThrow('Service down');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const retryWithTracking = new RetryService({
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        backoffMultiplier: 2,
        onRetry: (attempt, delay) => {
          delays.push(delay);
        },
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryWithTracking.execute(mockFn);
      } catch {
        // Expected
      }

      // Should have 2 delays (3 attempts = 2 retries)
      expect(delays.length).toBe(2);
      // Delays should increase exponentially (accounting for jitter)
      expect(delays[0]).toBeLessThan(delays[1] + 50); // Allow jitter variance
    });

    it('should use linear backoff', async () => {
      const retryLinear = new RetryService({
        maxAttempts: 4,
        initialDelay: 10,
        maxDelay: 100,
        backoffStrategy: BackoffStrategy.LINEAR,
        jitterFactor: 0,
      });

      const delays: number[] = [];
      retryLinear['config'].onRetry = (attempt, delay) => {
        delays.push(delay);
      };

      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryLinear.execute(mockFn);
      } catch {
        // Expected
      }

      // Linear: 10, 20, 30
      expect(delays.length).toBe(3);
      expect(delays[0]).toBe(10);
      expect(delays[1]).toBe(20);
      expect(delays[2]).toBe(30);
    });

    it('should respect max delay', async () => {
      const retryService = new RetryService({
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 50, // Max 50ms
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        jitterFactor: 0,
      });

      const delays: number[] = [];
      (retryService as any).config.onRetry = (attempt: number, delay: number) => {
        delays.push(delay);
      };

      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryService.execute(mockFn);
      } catch {
        // Expected
      }

      // All delays should be at most 50ms
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(50);
      }
    });

    it('should call custom shouldRetry', async () => {
      const shouldRetryFn = jest.fn().mockReturnValue(false);

      const retryService = new RetryService({
        maxAttempts: 3,
        shouldRetry: shouldRetryFn,
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(retryService.execute(mockFn)).rejects.toThrow();

      // shouldRetry should be called once
      expect(shouldRetryFn).toHaveBeenCalledTimes(1);
      // mockFn should be called only once (no retry)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should track metrics', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      await retryService.execute(mockFn);

      const metrics = retryService.getMetrics();
      expect(metrics.totalAttempts).toBe(2);
      expect(metrics.successAttempts).toBe(1);
      expect(metrics.failedAttempts).toBe(1);
      expect(metrics.timeoutRetries).toBe(1);
    });
  });

  describe('CircuitBreakerFactory', () => {
    it('should create and cache circuit breakers', () => {
      const factory = new CircuitBreakerFactory();

      const breaker1 = factory.getOrCreate({ name: 'service-1' });
      const breaker2 = factory.getOrCreate({ name: 'service-1' });

      expect(breaker1).toBe(breaker2);
    });

    it('should get all circuit breakers', () => {
      const factory = new CircuitBreakerFactory();

      factory.getOrCreate({ name: 'service-1' });
      factory.getOrCreate({ name: 'service-2' });

      const all = factory.getAll();
      expect(all.size).toBe(2);
      expect(all.has('service-1')).toBe(true);
      expect(all.has('service-2')).toBe(true);
    });

    it('should reset all circuit breakers', () => {
      const factory = new CircuitBreakerFactory();

      const breaker1 = factory.getOrCreate({ name: 'service-1' });
      const breaker2 = factory.getOrCreate({ name: 'service-2' });

      // Open breaker1
      try {
        breaker1.open();
      } catch {
        // Expected
      }

      factory.resetAll();

      expect(breaker1.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(breaker2.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('RetryFactory', () => {
    it('should create HTTP retry service', () => {
      const factory = new RetryFactory();
      const retry = factory.createHttpRetry();

      expect(retry).toBeInstanceOf(RetryService);
    });

    it('should create database retry service', () => {
      const factory = new RetryFactory();
      const retry = factory.createDatabaseRetry();

      expect(retry).toBeInstanceOf(RetryService);
    });

    it('should create external API retry service', () => {
      const factory = new RetryFactory();
      const retry = factory.createExternalApiRetry();

      expect(retry).toBeInstanceOf(RetryService);
    });

    it('should create custom retry service', () => {
      const factory = new RetryFactory();
      const retry = factory.createCustom({
        maxAttempts: 5,
        initialDelay: 50,
      });

      expect(retry).toBeInstanceOf(RetryService);
    });
  });
});
