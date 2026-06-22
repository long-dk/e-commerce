# Circuit Breaker & Retry Backoff - Quick Reference

## Quick Start (30 seconds)

### 1. Import CommonModule
```typescript
import { CommonModule } from '@app/common';

@Module({
  imports: [CommonModule, ...],
})
export class YourModule {}
```

### 2. Inject and Use
```typescript
import { ResilientHttpClientFactory } from '@app/common';

@Injectable()
export class YourService {
  private client: ResilientHttpClient;

  constructor(factory: ResilientHttpClientFactory) {
    this.client = factory.getOrCreate({
      serviceName: 'external-service',
    });
  }

  async callExternalService() {
    // Automatically retries with exponential backoff
    // and circuit breaker protection
    return this.client.get('http://external-api/data');
  }
}
```

## Patterns Overview

| Pattern | Purpose | When to Use |
|---------|---------|------------|
| **Circuit Breaker** | Prevent cascading failures | Always with external services |
| **Retry with Backoff** | Handle transient errors | Network calls, timeout scenarios |
| **Combined** | Full resilience | Production microservices |

## Configuration Presets

### Default (Recommended)
```typescript
factory.getOrCreate({
  serviceName: 'my-service'
  // Uses sensible defaults for most cases
})
```

### HTTP Calls (External APIs)
```typescript
factory.getOrCreate({
  serviceName: 'external-api',
  retry: { maxAttempts: 3, initialDelay: 100, maxDelay: 10000 }
})
```

### Database Operations
```typescript
factory.getOrCreate({
  serviceName: 'database',
  retry: { maxAttempts: 2, initialDelay: 50, maxDelay: 1000 }
})
```

### Internal Microservices
```typescript
factory.getOrCreate({
  serviceName: 'payment-service',
  circuitBreaker: { failureThreshold: 3, timeout: 30000 },
  retry: { maxAttempts: 2, maxDelay: 5000 }
})
```

## Common Scenarios

### Scenario 1: Call External Payment API
```typescript
async processPayment(orderId: string, amount: number) {
  try {
    const response = await this.paymentClient.post(
      'https://api.stripe.com/charges',
      { amount, orderId }
    );
    return response.data;
  } catch (error) {
    // Already retried 3x, circuit breaker checked
    // Error is real - handle it
    this.logger.error('Payment failed after retries', {
      orderId,
      amount,
      error: error.message
    });
    throw error;
  }
}
```

### Scenario 2: Check Inventory
```typescript
async checkInventory(productId: string): Promise<number> {
  try {
    const response = await this.inventoryClient.get(
      `http://inventory-service/products/${productId}/stock`
    );
    return response.data.quantity;
  } catch (error) {
    // Service is down (circuit open) or consistently failing
    // Decide: fail order or use cached data
    const cached = this.cache.get(productId);
    if (cached) {
      this.logger.warn('Using cached inventory data');
      return cached;
    }
    throw error;
  }
}
```

### Scenario 3: Send Notifications (Non-critical)
```typescript
async sendNotification(userId: string, message: string) {
  try {
    await this.notificationClient.post(
      'http://notification-service/send',
      { userId, message }
    );
  } catch (error) {
    // Non-critical - log but don't fail main request
    this.logger.warn('Notification delivery failed, will retry later', {
      userId,
      error: error.message
    });
    // Could queue for later retry
  }
}
```

## Monitoring

### Get Health Status
```typescript
@Controller('health')
export class HealthController {
  constructor(private factory: ResilientHttpClientFactory) {}

  @Get('services')
  getStatus() {
    return this.factory.getAll();
  }
}
```

### Example Output
```json
{
  "payment-service": {
    "circuitBreaker": {
      "state": "CLOSED",
      "failureCount": 1,
      "totalRequests": 100
    },
    "retry": {
      "totalAttempts": 150,
      "successAttempts": 145,
      "failedAttempts": 5
    }
  }
}
```

## Error Handling

```typescript
try {
  await this.client.post(url, data);
} catch (error) {
  // Different error types:
  
  if (error.status === 503) {
    // Circuit breaker is open - service down
    return { error: 'Service temporarily unavailable' };
  }
  
  if (error.status === 408) {
    // Timeout after all retries
    return { error: 'Request timeout' };
  }
  
  if (error.status === 502) {
    // Network error
    return { error: 'Network error' };
  }
  
  // Other HTTP errors (4xx, 5xx)
  throw error;
}
```

## Best Practices Checklist

- [ ] Use `ResilientHttpClientFactory` for all external calls
- [ ] Configure different services with different thresholds
- [ ] Set appropriate timeouts per service
- [ ] Implement exponential backoff with jitter
- [ ] Monitor circuit breaker states
- [ ] Handle non-critical failures gracefully
- [ ] Test failure scenarios
- [ ] Log all retry attempts
- [ ] Set up alerts for open circuit breakers
- [ ] Document failure modes and recovery procedures

## Backoff Strategy Formulas

### Exponential
```
delay = initialDelay × (multiplier ^ attempt)
Example: 100 × (2 ^ 1) = 200ms, 100 × (2 ^ 2) = 400ms
```

### Linear
```
delay = initialDelay × attempt
Example: 100 × 1 = 100ms, 100 × 2 = 200ms
```

### Fixed
```
delay = initialDelay (constant)
Example: 100ms, 100ms, 100ms
```

### With Jitter
```
final_delay = delay + (delay × jitterFactor × random[0,1])
Example: 200ms + (200 × 0.1 × 0.5) = 210ms
```

## Environment Variables

```bash
# Typical configuration via environment
PAYMENT_SERVICE_URL=http://payment:3004
INVENTORY_SERVICE_URL=http://inventory:3005
SHIPPING_SERVICE_URL=http://shipping:3006
NOTIFICATION_SERVICE_URL=http://notification:3007

# Circuit breaker thresholds
CB_PAYMENT_THRESHOLD=3      # Strict for payments
CB_INVENTORY_THRESHOLD=5    # Moderate for inventory
CB_SHIPPING_THRESHOLD=8     # Lenient for shipping
CB_TIMEOUT=60000            # Default 60 seconds
```

## Testing Tips

```typescript
// Mock failures
const mockFn = jest.fn()
  .mockRejectedValueOnce(new Error('timeout'))
  .mockRejectedValueOnce(new Error('timeout'))
  .mockResolvedValueOnce({ success: true });

// Circuit breaker tests
expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

// Retry metrics
expect(metrics.totalAttempts).toBe(3);
expect(metrics.successAttempts).toBe(1);
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Circuit breaker always open | Service is genuinely down | Fix underlying service, then reset |
| Too many retries | Threshold too high | Lower `maxAttempts` |
| Retries too slow | Backoff too aggressive | Reduce `initialDelay` or use LINEAR strategy |
| Retries too fast | Backoff too lenient | Increase `initialDelay` or `maxDelay` |

## Resources

- 📚 Full Guide: `RESILIENCE_PATTERNS.md`
- 💻 Integration Example: `INTEGRATION_EXAMPLE.md`
- 🧪 Tests: `libs/common/src/resilience-patterns.spec.ts`
- 🔧 Implementation: `libs/common/src/`

## Support

For questions or issues:
1. Check the full guide: `RESILIENCE_PATTERNS.md`
2. See integration examples: `INTEGRATION_EXAMPLE.md`
3. Review test cases for pattern examples
4. Check the service source code in `libs/common/src/`
