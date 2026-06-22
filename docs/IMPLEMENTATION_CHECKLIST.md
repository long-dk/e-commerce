# Implementation Checklist: Adding Resilience to Your Service

This checklist guides you through integrating circuit breaker and retry backoff into your existing microservice.

## Phase 1: Setup (15 minutes)

- [ ] Review `RESILIENCE_PATTERNS.md` - understand the concepts
- [ ] Review `RESILIENCE_QUICK_REFERENCE.md` - see quick start
- [ ] Identify external service calls in your codebase
- [ ] Categorize services by criticality (critical/important/non-critical)

## Phase 2: Module Configuration (10 minutes)

In your service's module file (e.g., `order.module.ts`):

```typescript
import { CommonModule } from '@app/common';

@Module({
  imports: [
    CommonModule,  // Add this line
    // ... other imports
  ],
  // ... rest of config
})
export class YourModule {}
```

- [ ] Add `CommonModule` to imports
- [ ] If using HttpModule elsewhere, remove it (CommonModule provides it)
- [ ] Verify module compiles without errors

## Phase 3: Service Integration (20-30 minutes per service)

### Step 1: Update Service Constructor
```typescript
import { ResilientHttpClientFactory } from '@app/common';

@Injectable()
export class YourService {
  private externalClient: ResilientHttpClient;

  constructor(
    private httpClientFactory: ResilientHttpClientFactory,
    // ... other dependencies
  ) {
    this.initializeClients();
  }

  private initializeClients(): void {
    this.externalClient = this.httpClientFactory.getOrCreate({
      serviceName: 'external-service-name',
      circuitBreaker: {
        failureThreshold: 5,  // Adjust based on service criticality
        timeout: 60000,
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
      },
    });
  }
}
```

- [ ] Import `ResilientHttpClientFactory`
- [ ] Add to constructor
- [ ] Create initialization method
- [ ] Configure appropriate thresholds for your service

### Step 2: Replace HTTP Calls

**Before:**
```typescript
async getProductData(productId: string) {
  const response = await this.httpService.get(
    `http://products-service/products/${productId}`
  ).toPromise();
  return response.data;
}
```

**After:**
```typescript
async getProductData(productId: string) {
  try {
    const response = await this.externalClient.get(
      `http://products-service/products/${productId}`
    );
    return response.data;
  } catch (error) {
    this.logger.error(`Failed to get product ${productId}`, error);
    throw error;
  }
}
```

For each HTTP call in your service:
- [ ] Replace `this.httpService` with `this.externalClient`
- [ ] Remove `.toPromise()` (not needed with resilient client)
- [ ] Add appropriate error handling
- [ ] Update error messages to be meaningful

### Step 3: Implement Strategy-Specific Logic

**For Critical Services (e.g., Payments):**
```typescript
async processPayment(order: Order) {
  try {
    // This will fail fast if service is down
    const result = await this.paymentClient.post(
      `${this.config.paymentUrl}/charge`,
      { amount: order.total, orderId: order.id }
    );
    return result.data;
  } catch (error) {
    // Always propagate payment errors
    this.logger.error('Payment processing failed', error);
    throw error;
  }
}
```

- [ ] Propagate errors to caller
- [ ] Log detailed failure information
- [ ] Consider alerting operations team

**For Non-Critical Services (e.g., Notifications):**
```typescript
async sendNotification(userId: string, message: string) {
  try {
    await this.notificationClient.post(
      `${this.config.notificationUrl}/send`,
      { userId, message }
    );
  } catch (error) {
    // Don't fail main request
    this.logger.warn('Notification delivery failed, will retry later', error);
    // Optionally queue for retry:
    // await this.queue.add('send-notification', { userId, message });
  }
}
```

- [ ] Catch errors without propagating
- [ ] Log warnings instead of errors
- [ ] Consider queueing for later retry
- [ ] Continue normal flow

## Phase 4: Testing (20-30 minutes)

### Unit Tests

```typescript
describe('MyService with Resilience', () => {
  let service: MyService;
  let httpClientFactory: ResilientHttpClientFactory;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CommonModule],
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
    httpClientFactory = module.get<ResilientHttpClientFactory>(
      ResilientHttpClientFactory
    );
  });

  it('should handle service failure gracefully', async () => {
    // Your test here
  });
});
```

- [ ] Write test for successful call
- [ ] Write test for retriable failure
- [ ] Write test for circuit breaker open
- [ ] Write test for non-critical service failure
- [ ] Run tests: `npm run test`

### Integration Tests

- [ ] Test with actual service running
- [ ] Test with service down
- [ ] Monitor circuit breaker state
- [ ] Verify retry behavior

## Phase 5: Monitoring & Health (15 minutes)

### Add Health Check Endpoint

```typescript
import { Controller, Get } from '@nestjs/common';
import { ResilientHttpClientFactory } from '@app/common';

@Controller('health')
export class HealthController {
  constructor(private httpClientFactory: ResilientHttpClientFactory) {}

  @Get('metrics')
  getMetrics() {
    return this.httpClientFactory.getAll();
  }

  @Get('services')
  getServiceStatus() {
    const all = this.httpClientFactory.getAll();
    const status: any = {};
    
    for (const [name, data] of all) {
      const circuit = data.metrics.circuitBreaker;
      status[name] = {
        circuitBreakerState: circuit.state,
        failures: circuit.failureCount,
        totalRequests: circuit.totalRequests,
      };
    }
    
    return status;
  }
}
```

- [ ] Create health check controller
- [ ] Add metrics endpoint
- [ ] Test endpoint: `curl http://localhost:3000/health/metrics`

### Setup Monitoring/Alerts

- [ ] Add circuit breaker state to monitoring dashboard
- [ ] Set alert for OPEN state
- [ ] Monitor retry success rate
- [ ] Check for trends (increasing failures)

## Phase 6: Configuration Tuning (Ongoing)

Based on your service's behavior, adjust configuration:

```typescript
// For high-traffic, very reliable service
{
  failureThreshold: 10,
  successThreshold: 5,
  timeout: 120000,
  maxAttempts: 2,
}

// For unreliable external service
{
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,
  maxAttempts: 5,
}

// For internal service
{
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  maxAttempts: 3,
}
```

- [ ] Monitor actual failure rates
- [ ] Adjust thresholds if too strict
- [ ] Adjust thresholds if too lenient
- [ ] Document any custom configurations

## Phase 7: Documentation (10 minutes)

In your service README or documentation:

- [ ] Add section: "Resilience Patterns"
- [ ] Document which external services have protection
- [ ] Document fallback behavior for non-critical services
- [ ] Document how to reset circuit breaker manually
- [ ] Link to `RESILIENCE_PATTERNS.md`

Example documentation:
```markdown
## Resilience Patterns

This service uses circuit breaker and retry backoff for calls to:
- Payment Service (critical) - fails fast if unavailable
- Inventory Service (important) - retries 3 times
- Notification Service (non-critical) - fails silently

Health status: GET /health/metrics
```

- [ ] Add documentation
- [ ] Update team wiki/docs

## Checklist Summary

### Setup
- [ ] Review documentation
- [ ] Identify external services
- [ ] Categorize by criticality

### Configuration
- [ ] Add CommonModule to imports
- [ ] Configure services

### Integration
- [ ] Update service constructors
- [ ] Replace HTTP calls
- [ ] Implement error handling

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Verify retry behavior

### Production
- [ ] Deploy with monitoring
- [ ] Set up alerts
- [ ] Document behavior
- [ ] Tune thresholds

## Service Categorization Guide

### Critical Services ⛔
Examples: Payments, Authentication, Order Processing
```typescript
{
  failureThreshold: 3,      // Open after 3 failures
  successThreshold: 2,      // Close after 2 successes
  timeout: 30000,           // Try recovery quickly
  maxAttempts: 3,           // Standard 3 retries
}
```

### Important Services ⚠️
Examples: Inventory, Products, Shipping Rates
```typescript
{
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000,
  maxAttempts: 3,
}
```

### Non-Critical Services ℹ️
Examples: Notifications, Analytics, Reports
```typescript
{
  failureThreshold: 8,
  successThreshold: 3,
  timeout: 120000,
  maxAttempts: 2,            // Fewer retries for non-critical
}
```

## Estimated Timeline

| Phase | Time | Notes |
|-------|------|-------|
| Setup | 15 min | Read docs, identify services |
| Configuration | 10 min | Update modules |
| Integration | 20-30 min | Per service, replace HTTP calls |
| Testing | 20-30 min | Write and run tests |
| Monitoring | 15 min | Add health endpoint |
| Tuning | Ongoing | Monitor and adjust |
| Documentation | 10 min | Update team docs |
| **Total** | **2-3 hours per service** | Varies by complexity |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Circuit breaker always open | Service is down - fix it, then reset breaker |
| Too many retries | Lower `maxAttempts` or lower failure threshold |
| Retries taking too long | Reduce `maxDelay` or use LINEAR strategy |
| Retries happening too quickly | Increase `initialDelay` |
| Compilation errors | Ensure CommonModule is imported |
| Tests failing | Review error handling in service |

## Quick Links

- Full Guide: `RESILIENCE_PATTERNS.md`
- Quick Reference: `RESILIENCE_QUICK_REFERENCE.md`
- Integration Example: `INTEGRATION_EXAMPLE.md`
- Tests: `libs/common/src/resilience-patterns.spec.ts`

## Next Steps After Implementation

1. Deploy to development environment
2. Monitor for a few days
3. Adjust thresholds based on observed behavior
4. Deploy to staging
5. Run chaos engineering tests (kill services, see behavior)
6. Deploy to production
7. Continue monitoring and tuning
8. Share success with team
9. Roll out to other services

---

**Need Help?**
1. Check `RESILIENCE_PATTERNS.md` for detailed documentation
2. Review `INTEGRATION_EXAMPLE.md` for examples
3. Check test cases in `resilience-patterns.spec.ts`
4. Review implemented example: `apps/payments-service/src/external-payment.service.ts`
