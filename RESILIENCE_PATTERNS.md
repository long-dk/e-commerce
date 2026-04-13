# Circuit Breaker and Retry Backoff Implementation Guide

This guide explains how to use the circuit breaker and retry backoff patterns implemented in this e-commerce microservices architecture.

## Overview

The implementation provides three main components:

1. **Circuit Breaker Service** - Prevents cascading failures
2. **Retry Service** - Automatically retries failed operations with exponential backoff
3. **Resilient HTTP Client** - Combines both patterns for fault-tolerant HTTP communication

## Architecture

### Circuit Breaker Pattern

The circuit breaker prevents cascading failures by monitoring service health and failing fast when a service becomes unavailable.

**States:**
- **CLOSED** - Normal operation, requests are made normally
- **OPEN** - Service is failing, requests are rejected immediately
- **HALF_OPEN** - Testing if service has recovered, allowing limited requests

**Configuration:**
```typescript
{
  failureThreshold: 5,      // Failures before opening
  successThreshold: 2,      // Successes in HALF_OPEN before closing
  timeout: 60000            // Time before attempting recovery (ms)
}
```

### Retry with Exponential Backoff

Automatically retries failed requests with exponential delays to avoid overwhelming a recovering service.

**Backoff Strategies:**
- **EXPONENTIAL** - delay = initialDelay × (multiplier ^ attemptNumber)
- **LINEAR** - delay = initialDelay × attemptNumber
- **FIXED** - delay = initialDelay (constant)

**Configuration:**
```typescript
{
  maxAttempts: 3,
  initialDelay: 100,        // First retry delay (ms)
  maxDelay: 30000,          // Maximum delay cap (ms)
  backoffMultiplier: 2,     // Exponential multiplier
  jitterFactor: 0.1,        // Random jitter 0-1
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
}
```

## Usage Examples

### 1. Using Resilient HTTP Client (Recommended)

The easiest way to use both patterns together:

```typescript
import {
  ResilientHttpClientFactory,
  ResilientHttpClient,
} from '@app/common';

@Injectable()
export class OrderService {
  private httpClient: ResilientHttpClient;

  constructor(factory: ResilientHttpClientFactory) {
    // Get or create a resilient client for your service
    this.httpClient = factory.getOrCreate({
      serviceName: 'payments-service',
      circuitBreaker: {
        name: 'payments',
        failureThreshold: 5,
        timeout: 60000,
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
      },
    });
  }

  async createOrder(data: any) {
    try {
      // This request will automatically retry and use circuit breaker
      const response = await this.httpClient.post(
        'http://payments-service:3004/process',
        data
      );
      return response.data;
    } catch (error) {
      // Handle error - circuit breaker or retries have already been attempted
      this.logger.error('Failed to process payment', error);
      throw error;
    }
  }
}
```

### 2. Using Circuit Breaker Service Directly

For more granular control:

```typescript
import { CircuitBreakerFactory } from '@app/common';

@Injectable()
export class InventoryService {
  private breaker: CircuitBreakerService;

  constructor(factory: CircuitBreakerFactory) {
    this.breaker = factory.getOrCreate({
      name: 'inventory-service',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });
  }

  async checkInventory(productId: string) {
    return this.breaker.execute(async () => {
      // Your logic here
      const response = await this.httpService.get(
        `http://inventory:3005/products/${productId}`
      ).toPromise();
      return response.data;
    });
  }
}
```

### 3. Using Retry Service Directly

For standalone retry logic without circuit breaker:

```typescript
import { RetryFactory } from '@app/common';

@Injectable()
export class NotificationService {
  private retry: RetryService;

  constructor(private retryFactory: RetryFactory) {
    // Create HTTP retry service
    this.retry = this.retryFactory.createHttpRetry(3);
  }

  async sendEmail(to: string, message: string) {
    return this.retry.execute(async () => {
      const response = await fetch('http://email-service/send', {
        method: 'POST',
        body: JSON.stringify({ to, message }),
      });
      return response.json();
    }, 'send-email');
  }
}
```

### 4. Custom Retry Configuration

```typescript
import { RetryService, BackoffStrategy } from '@app/common';

const customRetry = new RetryService({
  maxAttempts: 5,
  initialDelay: 200,
  maxDelay: 10000,
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  backoffMultiplier: 2,
  jitterFactor: 0.15,
  
  // Custom retry logic
  shouldRetry: (error, attempt) => {
    // Don't retry on 404 Not Found
    if (error?.response?.status === 404) {
      return false;
    }
    return true;
  },
  
  // Custom callback
  onRetry: (attempt, delay, error) => {
    console.log(`Attempt ${attempt} in ${delay}ms, error: ${error.message}`);
  },
});
```

## Module Setup

### Step 1: Import Common Module

In your service's module:

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    CommonModule,
    // ... other imports
  ],
  providers: [PaymentService],
})
export class PaymentModule {}
```

### Step 2: Inject and Use

```typescript
import {
  ResilientHttpClientFactory,
  CircuitBreakerFactory,
  RetryFactory,
} from '@app/common';

@Injectable()
export class PaymentService {
  constructor(
    private httpClientFactory: ResilientHttpClientFactory,
    private circuitBreakerFactory: CircuitBreakerFactory,
    private retryFactory: RetryFactory,
  ) {}

  // Use the factories as shown in examples above
}
```

## Monitoring and Health Checks

### Get Metrics

```typescript
// In your controller or management service
import { Controller, Get } from '@nestjs/common';
import { ResilientHttpClientFactory } from '@app/common';

@Controller('health')
export class HealthController {
  constructor(private httpClientFactory: ResilientHttpClientFactory) {}

  @Get('metrics')
  getMetrics() {
    return this.httpClientFactory.getAll();
  }
}
```

Output example:
```json
{
  "payment-gateway-stripe": {
    "metrics": {
      "circuitBreaker": {
        "state": "HALF_OPEN",
        "failureCount": 0,
        "successCount": 1,
        "totalRequests": 10,
        "openedAt": "2025-04-13T10:30:00.000Z"
      },
      "retry": {
        "totalAttempts": 15,
        "successAttempts": 12,
        "failedAttempts": 3,
        "timeoutRetries": 5
      }
    }
  }
}
```

### Manual Circuit Breaker Control

```typescript
@Controller('admin')
export class AdminController {
  constructor(private httpClientFactory: ResilientHttpClientFactory) {}

  @Post('circuit-breaker/:service/reset')
  resetCircuitBreaker(@Param('service') serviceName: string) {
    const client = this.httpClientFactory.get(serviceName);
    if (client) {
      client.resetCircuitBreaker();
      return { message: 'Circuit breaker reset' };
    }
    return { error: 'Client not found' };
  }
}
```

## Error Handling

The resilient HTTP client automatically handles various error scenarios:

```typescript
try {
  const response = await this.httpClient.post(url, data);
} catch (error) {
  // Different error types:
  //   - SERVICE_UNAVAILABLE (503): Circuit breaker is open
  //   - REQUEST_TIMEOUT (408): All retries exhausted
  //   - BAD_GATEWAY (502): Network unreachable
  //   - Specific HTTP status: From the service
  
  if (error.status === 503) {
    // Handle circuit breaker open
  } else if (error.status === 408) {
    // Handle timeout
  }
}
```

## Best Practices

1. **Configure per service**: Different services may need different thresholds
   ```typescript
   // External APIs - more lenient
   factory.getOrCreate({
     serviceName: 'external-api',
     circuitBreaker: { timeout: 120000 },
     retry: { maxAttempts: 5 }
   });

   // Internal services - stricter
   factory.getOrCreate({
     serviceName: 'internal-db',
     circuitBreaker: { timeout: 30000 },
     retry: { maxAttempts: 2 }
   });
   ```

2. **Use appropriate backoff strategies**:
   - External APIs: Exponential with jitter
   - Database: Short delays, fixed strategy
   - Message queues: Linear or exponential

3. **Monitor circuit breaker states**: Set up alerts when circuit breakers open

4. **Test failure scenarios**: Verify retry and circuit breaker behavior with tests

5. **Set reasonable timeouts**: Don't wait indefinitely for responses

## Testing

```typescript
import { CircuitBreakerService } from '@app/common';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreakerService;

  beforeEach(() => {
    breaker = new CircuitBreakerService({
      name: 'test-service',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100,
    });
  });

  it('should open after failing threshold', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }
    }

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('should recover to HALF_OPEN after timeout', async () => {
    // ... open breaker ...
    await new Promise(r => setTimeout(r, 150));
    
    expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  });
});
```

## Real-World Example: Payment Processing

```typescript
@Injectable()
export class PaymentProcessor {
  private stripeClient: ResilientHttpClient;
  private paypalClient: ResilientHttpClient;

  constructor(factory: ResilientHttpClientFactory) {
    // Stripe: Higher tolerance for delays
    this.stripeClient = factory.getOrCreate({
      serviceName: 'stripe-payments',
      circuitBreaker: { failureThreshold: 10, timeout: 120000 },
      retry: { maxAttempts: 5 },
    });

    // PayPal: Stricter requirements
    this.paypalClient = factory.getOrCreate({
      serviceName: 'paypal-payments',
      circuitBreaker: { failureThreshold: 5, timeout: 60000 },
      retry: { maxAttempts: 3 },
    });
  }

  async processPayment(order: Order, gateway: string) {
    const client = gateway === 'stripe' ? this.stripeClient : this.paypalClient;

    try {
      const response = await client.post('/charge', {
        amount: order.total,
        currency: order.currency,
        orderId: order.id,
      });

      return response.data;
    } catch (error) {
      // Circuit breaker and retries already attempted
      // Log metrics for monitoring
      const metrics = client.getCircuitBreakerMetrics();
      if (metrics.state === 'OPEN') {
        // Alert team about service being down
      }
      throw error;
    }
  }
}
```

## Conclusion

The circuit breaker and retry backoff patterns significantly improve the resilience of your microservices architecture by:
- Preventing cascading failures
- Automatically recovering from transient errors
- Providing graceful degradation
- Enabling monitoring and visibility into service health

Use these patterns throughout your services to build a robust, fault-tolerant system.
