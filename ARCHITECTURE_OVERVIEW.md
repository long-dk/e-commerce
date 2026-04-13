# Architecture Overview: Circuit Breaker & Retry Backoff

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Microservice Architecture                     │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │    Your Service     │
                    │   (Orders, Payments │
                    │   Inventory, etc.)  │
                    └──────────┬──────────┘
                               │
                               │ Needs to call
                               │ external services
                               ▼
                    ┌─────────────────────┐
                    │ ResilientHttpClient │
                    │   (HTTP Wrapper)    │
                    └──────┬────────┬─────┘
                           │        │
                    ┌──────▼─┐    ┌─▼──────────┐
                    │ Circuit │    │   Retry   │
                    │ Breaker │    │  Service  │
                    └────┬────┘    └────┬──────┘
                         │             │
          ┌──────────────┴─────────────┴──────────────┐
          │                                            │
    ▼─────────────────────────────────┐    ▼──────────────────┐
    │ Service Health Monitoring        │    │ Retry Strategy   │
    │ - State tracking                 │    │ - Exponential    │
    │ - Metrics (failures, requests)   │    │ - Linear         │
    │ - Recovery automation            │    │ - Fixed          │
    └──────────────────────────────────┘    └──────────────────┘
          │
          │ Protects against cascading failures
          ▼
    ┌────────────────────────────────────────────┐
    │ External Services (API calls)               │
    ├────────────────────────────────────────────┤
    │ • Stripe API (Payments)                    │
    │ • Inventory Service (Stock Check)          │
    │ • Shipping Service (Rates)                 │
    │ • Notification Service (Email)             │
    │ • Third-party APIs                         │
    └────────────────────────────────────────────┘
```

## Data Flow: Request Handling

```
User Request
    │
    ▼
┌──────────────────────┐
│ Service Method       │
│ (e.g., createOrder)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ ResilientHttpClient.post()       │
│ GET/POST/PUT/DELETE              │
└──────────┬───────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Circuit Breaker? │
    └────┬─────────────┘
         │
    Open? │  No - Closed/HalfOpen
    │     │         │
Yes │     │         ▼
    │     │   ┌─────────────────┐
    │     │   │ Check Retries?  │
    │     │   └────┬────────────┘
    │     │        │
    │     │   ┌────▼────────────────┐
    │     │   │ Execute HTTP Call   │
    │     │   └────┬────────────────┘
    │     │        │
    │     │    Success?
    │     │        │
    │     │   Yes  │ No
    │     │   ┌────▼───┐
    │     │   │Retries │
    │     │   │Left?   │
    │     │   └────┬───┘
    │     │        │
    │     │   Yes  │ No
    │     │        ▼
    │     │   [Fail]
    │     │
    ▼     ▼
[Fail] [Success]
```

## Circuit Breaker State Machine

```
    ┌─────────────┐
    │   CLOSED    │◄──────────┐
    │ Normal flow │           │
    └──────┬──────┘           │
           │                  │
    Failures ≥ ─────────┐     │
    Threshold           │     │
           │            │     │
           ▼            │     │
    ┌─────────────┐     │     │
    │    OPEN     │     │  Successes ≥
    │ Fast fail   │     │  Threshold
    │             │     │
    └──────┬──────┘     │
           │            │
    Timeout ─────┐      │
    Passes       │      │
           │     │      │
           ▼     │      │
    ┌──────────────────┐│
    │   HALF_OPEN      ││
    │ Test recovery    ││
    └────┬──────┬──────┘│
         │      │       │
    Fails│      │Success│
         │      └─────────┘
         │
         ▼
    [Reopen]
```

## Retry Backoff Strategies

### Exponential Backoff
```
Attempt 1: ██ 100ms
Attempt 2: ████ 200ms (100 × 2)
Attempt 3: ████████ 400ms (100 × 2²)
Attempt 4: ███████████████ 800ms (100 × 2³) [capped at maxDelay]

With jitter (±10%):
Attempt 1: 90-110ms
Attempt 2: 180-220ms
Attempt 3: 360-440ms
```

### Linear Backoff
```
Attempt 1: ████ 100ms
Attempt 2: ████████ 200ms (100 × 2)
Attempt 3: ████████████ 300ms (100 × 3)
Attempt 4: ████████████████ 400ms (100 × 4)
```

### Fixed Backoff
```
Attempt 1: ███ 100ms
Attempt 2: ███ 100ms
Attempt 3: ███ 100ms
Attempt 4: ███ 100ms
```

## Service Criticality Matrix

```
                Critical              Important          Non-Critical
┌──────────────────────────────────────────────────────────────────┐
│ Examples    Payments, Orders      Inventory, Products  Notifications
│             Authentication        Shipping Rates       Analytics
│
│ Behavior    FAIL FAST            RETRY SMART         FAIL SILENT
│
│ Circuit     failureThreshold=3   failureThreshold=5   failureThreshold=8
│ Breaker     timeout=30s          timeout=60s          timeout=120s
│
│ Retry       maxAttempts=3        maxAttempts=3        maxAttempts=2
│             initialDelay=100ms   initialDelay=100ms   initialDelay=200ms
│             maxDelay=5s          maxDelay=10s         maxDelay=10s
│
│ Error       Throw to caller      Throw to caller      Log & continue
│ Handling    Alert ops            Log                  Queue for retry
│
└──────────────────────────────────────────────────────────────────┘
```

## Integration Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Module                              │
├─────────────────────────────────────────────────────────────────┤
│ imports: [CommonModule]  ◄── Provides all resilience services  │
│                                                                  │
│ @Service()                                                       │
│ class MyService {                                               │
│   constructor(factory: ResilientHttpClientFactory) {           │
│     this.client = factory.getOrCreate({                         │
│       serviceName: 'payment-service',                           │
│       circuitBreaker: { ... },                                  │
│       retry: { ... }                                            │
│     });                                                          │
│   }                                                             │
│                                                                  │
│   async callExternalService() {                                 │
│     return this.client.post(url, data);  ◄── Safe by default   │
│   }                                                              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Monitoring Dashboard Metrics

```
┌────────────────────────────────────────────────────────┐
│          Service Health Monitoring Dashboard           │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Payment Service                                        │
│  ├─ Circuit Breaker: CLOSED ✓                          │
│  ├─ Failures: 2/5 (40%)                                │
│  ├─ Total Requests: 1,250                              │
│  ├─ Success Rate: 98.4%                                │
│  └─ Last Error: Connection timeout 2min ago            │
│                                                         │
│  Inventory Service                                      │
│  ├─ Circuit Breaker: HALF_OPEN ⚠                       │
│  ├─ Failures: 5/5 (100%) - recovering...               │
│  ├─ Total Requests: 856                                │
│  ├─ Success Rate: 94.2%                                │
│  └─ Recovery in: 45 seconds                            │
│                                                         │
│  Notification Service                                   │
│  ├─ Circuit Breaker: OPEN ✗                            │
│  ├─ Failures: 8/8 (100%)                               │
│  ├─ Total Requests: 432                                │
│  ├─ Success Rate: 89.6%                                │
│  └─ Next recovery attempt: 1min 30sec                  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Configuration Decision Tree

```
                    New External Service Call
                            │
                            ▼
                   Is service critical?
                    (payments, auth)
                    /        \
                  YES         NO
                  │             │
          Strict   │             │   Lenient
      Threshold    │             │   Threshold
          (3)      │             │      (8)
                   │             │
         ┌─────────▼─┐         ┌─▼────────┐
         │ CRITICAL  │         │NON-CRIT. │
         │ FAIL FAST │         │FAIL SOFT │
         └─────┬─────┘         └─┬────────┘
               │                 │
        Propagate      Do not propagate
        errors to       errors to caller
        caller          (log & continue)
               │                 │
         Queue for          Can queue for
         immediate          async retry
         processing         later
```

## Error Handling Flowchart

```
                    HTTP Request
                        │
                        ▼
                  ┌──────────────┐
                  │ Circuit Open?│
                  └────┬─────┬───┘
                    YES│     │NO
                       │     ▼
                 FAIL   │  Max Retries?
               (503)    │  ┌────┬───┐
                       YES│    │NO
                       │ FAIL  ▼
                       │ (408) CALL
                       │      SERVICE
                       │        │
                       │    Success?
                       │    ┌──┬──┐
                       │   YES NO
                       │    │  │
                       │    │  ├─► REPORT
                       │    │  │   FAILURE
                       │    │  │
                       │    │  └─► RETRY
                       │    │      (exponential
                       │    │       backoff)
                       │    │
                       └────┴──► Return to caller
                                 or queue
```

## Performance Characteristics

```
┌──────────────────────────────────────────────────────────┐
│                 Operation Overhead                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Healthy Service:                                          │
│   Circuit Breaker check: ~0.1ms                           │
│   Retry validation: ~0.05ms                               │
│   Total overhead: ~0.15ms                                 │
│   Impact: Negligible (<1%)                                │
│                                                           │
│ With 1 Retry (exponential backoff):                       │
│   Worst case: ~200ms (100ms initial + ~100ms exponential) │
│   Average: ~150ms                                         │
│                                                           │
│ With 3 Retries (exponential backoff):                     │
│   Worst case: ~1.4s (100ms + 200ms + 400ms)              │
│   Average: ~1s                                            │
│                                                           │
│ Memory per Circuit Breaker: ~1KB                          │
│ Memory overhead: Minimal (<1%)                            │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Component Interaction Sequence

```
Service A                ResilientClient         Service B
   │                          │                     │
   │ get(url)                 │                     │
   ├─────────────────────────►│                     │
   │                          │                     │
   │                   Check CB                     │
   │                    state                       │
   │                          │                     │
   │                   Try #1 ├────────────────────►│
   │                          │                     │
   │                          │                  (timeout)
   │                          │◄────────────────────┤
   │                          │                     │
   │                   Delay  │ (exponential)       │
   │                          │                     │
   │                   Try #2 ├────────────────────►│
   │                          │                     │
   │                          │                 (error 500)
   │                          │◄────────────────────┤
   │                          │                     │
   │                   Delay  │ (longer)            │
   │                          │                     │
   │                   Try #3 ├────────────────────►│
   │                          │                     │
   │                          │◄────────────────────┤
   │                   Success│                  (200 OK)
   │◄─────────────────────────┤                     │
   │                          │                     │
```

---

This architecture ensures that microservices are resilient to failures while maintaining performance and providing visibility into service health.
