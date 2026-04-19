# Monitoring & Observability Guide

This guide covers the complete monitoring setup for the e-commerce microservices architecture. The system provides comprehensive observability through logs, metrics, traces, and custom dashboards.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Accessing Monitoring UIs](#accessing-monitoring-uis)
4. [Key Dashboards](#key-dashboards)
5. [Collecting Metrics](#collecting-metrics)
6. [Creating Custom Metrics](#creating-custom-metrics)
7. [Alerting](#alerting)
8. [Distributed Tracing](#distributed-tracing)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The monitoring stack comprises four main components:

### **Logs (ELK Stack)**
- **Elasticsearch**: Central log storage  
- **Logstash**: Log aggregation and parsing
- **Kibana**: Log search and visualization
- **Filebeat**: Log shipping agent

### **Metrics (Prometheus)**
- **Prometheus**: Time-series database for metrics
- **prom-client**: Node.js library for metric collection
- **Custom PrometheusMetricsService**: Application-level metrics

### **Visualization (Grafana)**
- **Grafana**: Unified dashboard and alerting platform
- Pre-built dashboards: System Health, Business KPIs, Database Performance

### **Distributed Tracing (Jaeger)**
- **Jaeger**: Distributed tracing backend
- **OpenTelemetry**: Vendor-neutral instrumenty library
- Auto-instrumentation for HTTP, DB, Kafka, Redis

### **Alerting (Prometheus AlertManager)**
- **AlertManager**: Alert routing and deduplication
- Slack/Email/PagerDuty integration ready
- Pre-configured alert rules for all services

---

## Quick Start

### 1. Start the Monitoring Services

```bash
# Fresh start with all monitoring services
docker-compose up -d

# Monitor logs
docker-compose logs -f prometheus grafana jaeger alertmanager
```

### 2. Verify All Services Are Running

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana
curl http://localhost:3000/api/health

# Check Jaeger
curl http://localhost:16686/api/v1/services

# Check AlertManager
curl http://localhost:9093/-/healthy
```

### 3. Generate Test Data

In one terminal, start microservices:

```bash
# Terminal 1: Start all services
docker-compose up auth-service products-service orders-service payments-service \
  inventory-service shipping-service notifications-service api-gateway
```

In another terminal, generate traffic:

```bash
# Terminal 2: Create test orders
curl -X POST http://localhost:4000/api/v1/orders/test-order \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","items":[{"sku":"PROD-001","qty":2}]}'
```

### 4. View Metrics

Open http://localhost:3000 (Grafana) and navigate to:
- **System Health** dashboard: See request rates, latency, error rates
- **Business KPIs** dashboard: View orders created, payment success, inventory levels

---

## Accessing Monitoring UIs

| Service | URL | User | Password |
|---------|-----|------|----------|
| **Prometheus** | http://localhost:9090 | - | - |
| **Grafana** | http://localhost:3000 | admin | admin |
| **Jaeger** | http://localhost:16686 | - | - |
| **Kibana** | http://localhost:5601 | elastic | elastic_password |
| **AlertManager** | http://localhost:9093 | - | - |

### Access Metrics Endpoints from Each Service

```bash
# API Gateway
curl http://localhost:4000/metrics

# Auth Service
curl http://localhost:4001/metrics

# Products Service
curl http://localhost:4002/metrics

# Orders Service
curl http://localhost:4003/metrics

# Payments Service
curl http://localhost:4004/metrics

# Inventory Service
curl http://localhost:4005/metrics

# Shipping Service
curl http://localhost:4006/metrics

# Notifications Service
curl http://localhost:4007/metrics
```

---

## Key Dashboards

### **System Health Dashboard**
**Location**: Grafana > Dashboards > System Health

Monitors:
- API request rate (requests/sec by service)
- API latency (P95 response times)
- Error rate (5xx errors as %)
- Service availability status

**Use for**: Detecting service degradation, load trends, outages

### **Business KPIs Dashboard**
**Location**: Grafana > Dashboards > Business KPIs

Monitors:
- Orders created per hour
- Payment success rate (0-1)
- Products with low inventory
- Notifications sent per hour
- Order processing time (per step)
- Payment failure rate

**Use for**: Business health, revenue impact, operational metrics

### **Database Performance Dashboard** 
*(Create with custom database query metrics if needed)*

Would include:
- Connection pool utilization
- Query execution times
- Lock contention
- Cache hit/miss rates

---

## Collecting Metrics

### Automatic Metrics (via MetricsInterceptor)

Every HTTP request automatically records:

```typescript
// HTTP Request Duration (milliseconds)
http_request_duration_ms{
  service="api-gateway",
  method="POST",
  endpoint="/api/v1/orders",
  status_code="201"
}

// HTTP Request Count
http_requests_total{
  service="api-gateway",
  method="POST",
  endpoint="/api/v1/orders",
  status_code="201"
}

// Request Size (bytes)
http_request_size_bytes{...}

// Response Size (bytes)
http_response_size_bytes{...}

// Active Connections
http_active_connections{service="orders-service"}
```

### Database Connection Metrics

```typescript
// Connection pool size
db_connection_pool_size{service="orders-service", database="postgresql"}

// Used connections
db_connection_pool_used{service="orders-service", database="postgresql"}
```

### Cache Metrics

```typescript
// Cache hits
cache_hits_total{service="products-service", cache_type="redis"}

// Cache misses
cache_misses_total{service="products-service", cache_type="redis"}
```

---

## Creating Custom Metrics

### Record Order Creation

In any OrderService:

```typescript
import { BusinessMetricsService } from '@app/common';

@Injectable()
export class OrderService {
  constructor(
    private businessMetrics: BusinessMetricsService,
  ) {}

  async createOrder(orderId: string, customerTier: string, amount: number) {
    // Record the order
    this.businessMetrics.recordOrderCreated(orderId, customerTier);
    
    // Do work...
    
    // Record processing step duration
    const start = Date.now();
    await this.paymentService.process(orderId, amount);
    this.businessMetrics.recordOrderProcessingStep(
      orderId,
      'payment',
      Date.now() - start,
      true,
    );
  }
}
```

### Record Payment Metrics

```typescript
async processPayment(orderId: string, amount: number, method: string) {
  const start = Date.now();
  
  try {
    const result = await stripe.charge({orderId, amount, method});
    
    this.businessMetrics.recordPayment(
      orderId,
      method,
      'success',
      amount,
      Date.now() - start,
    );
  } catch (error) {
    this.businessMetrics.recordPaymentFailure(
      orderId,
      method,
      error.code,
    );
    throw error;
  }
}
```

### Record Inventory Changes 

```typescript
async updateInventory(productId: string, quantity: number) {
  // Update...
  
  this.businessMetrics.recordInventoryLevel(
    productId,
    quantity,
    reorderPoint=10,
  );
  
  this.businessMetrics.recordInventoryAdjustment(
    productId,
    'sold',  // or 'restock', 'return', 'damage'
    quantity,
  );
}
```

### Record Notifications

```typescript
async sendNotification(userId: string, type: 'email' | 'sms' | 'push') {
  try {
    await this.emailService.send(...);
    this.businessMetrics.recordNotificationSent('email', 'sent', userId);
  } catch (error) {
    this.businessMetrics.recordNotificationSent('email', 'failed', userId);
  }
}
```

### Custom Kafka Metrics

```typescript
@MessagePattern('order.created')
async onOrderCreated(@Payload() data: any) {
  this.businessMetrics.recordKafkaMessage('order.created', 'consumed');
  // Process message...
}
```

---

## Alerting

### Alert Rules

Alert rules are defined in [alerts.yml](../alerts.yml). Key alerts:

#### Critical Alerts
- **ServiceDown**: Service unreachable for 2+ minutes
- **PaymentSuccessRateLow**: Success rate < 95%
- **DatabaseConnectionPoolFull**: Pool usage > 95%

#### Warning Alerts
- **HighErrorRate**: Error rate > 5% for 5 minutes
- **ServiceHighLatency**: P95 latency > 1 second
- **PaymentProcessingSlowDown**: Processing time > 5 seconds
- **InventoryLevelLow**: Stock below reorder point

#### Info Alerts
- **OrderCreationSpike**: Unusually high order volume
- **CacheMissRate**: Cache miss rate > 50%

### Enable Slack Notifications

1. Create a Slack webhook:
   - Go to Slack workspace > Settings > Apps & integrations > Incoming Webhooks
   - Create new webhook, copy URL

2. Update `.env`:
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   SLACK_ALERTS_CHANNEL=#alerts
   SLACK_CRITICAL_CHANNEL=#critical-alerts
   SLACK_PAYMENTS_CHANNEL=#payments
   SLACK_ORDERS_CHANNEL=#orders
   SLACK_INVENTORY_CHANNEL=#inventory
   SLACK_WARNINGS_CHANNEL=#warnings
   SLACK_INFO_CHANNEL=#debug
   ```

3. Restart AlertManager:
   ```bash
   docker-compose restart alertmanager
   ```

### Testing Alerts

Stop a service to trigger "ServiceDown" alert:

```bash
docker-compose pause orders-service

# After 2 minutes, alert fires
# Check AlertManager: http://localhost:9093
# Should see Slack notification in #critical-alerts
```

Resume service:

```bash
docker-compose unpause orders-service
```

---

## Distributed Tracing

Jaeger traces request flow across all services. Useful for:
- Understanding request latency
- Debugging service interactions
- Finding performance bottlenecks
- Error diagnosis

### View Traces

1. Open Jaeger UI: http://localhost:16686

2. Select service:
   - Service dropdown > "api-gateway"
   - Choose operation (e.g., "POST /graphql")

3. Adjust time range and click "Find Traces"

4. Click a trace to see:
   - Timeline of all services involved
   - Duration of each span
   - Error messages
   - Request/response metadata

### Example: Trace an Order Creation Flow

1. Create an order:
   ```bash
   curl -X POST http://localhost:4000/api/v1/orders \
     -H "Content-Type: application/json" \
     -d '{"userId":"user-123","items":[...]}'
   ```

2. In Jaeger, find trace for service chain:
   ```
   api-gateway -> orders-service -> payments-service -> auth-service
   ```

3. Each span shows:
   - HTTP method/endpoint
   - Database query timing
   - Kafka message latency
   - Redis cache operations

---

## Troubleshooting

### Prometheus Not Scraping Metrics

**Check:**
```bash
# Verify Prometheus can reach service
curl http://api-gateway:4000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq .

# Should show all services "state": "up"
```

**Fix:**
- Ensure all services are running: `docker-compose logs`
- Verify service names match prometheus.yml scrape_configs
- Check network: `docker network ls` and `docker inspect ecommerce-network`
- Restart Prometheus: `docker-compose restart prometheus`

### Grafana Dashboards Empty

**Check:**
1. Verify Prometheus datasource is configured
   - Settings > Data Sources > Prometheus
   - Test connection

2. Check Prometheus has data
   - Prometheus UI > Graph
   - Execute query: `http_requests_total`

3. Verify dashboard queries

**Fix:**
- Re-import dashboards: Settings > Dashboards > Import
- Recreate datasource > Systems > Data Sources > + New

### No Traces in Jaeger

**Check:**
```bash
# Verify OpenTelemetry initialization in service logs
docker-compose logs orders-service | grep "OpenTelemetry"

# Check Jaeger is receiving traces
docker-compose logs jaeger | grep "trace"
```

**Fix:**
- Ensure `TracingService.initializeTracing()` is called before app starts
- Verify JAEGER_ENDPOINT is correct (default: http://localhost:4317)
- Restart services: `docker-compose restart`

### Alerts Not Firing

**Check:**
1. Verify AlertManager is running
   ```bash
   curl http://localhost:9093/-/healthy
   ```

2. Check alert rules in Prometheus
   - Prometheus UI > Alerts > All
   - Should show rule status (active/inactive)

3. Verify Slack webhook is configured
   ```bash
   docker-compose logs alertmanager | grep -i slack
   ```

**Fix:**
- Restart: `docker-compose restart prometheus alertmanager`
- Check alertmanager configuration: `cat alertmanager.yml`
- Test Slack webhook manually:
  ```bash
  curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d '{"text":"Test alert"}'
  ```

### High Resource Usage

If monitoring stack consuming too much resources:

1. **Reduce Prometheus retention**:
   ```yaml
   # prometheus.yml
   command:
     - '--storage.tsdb.retention.time=7d'  # reduce from 30d
   ```

2. **Reduce scrape frequency**:
   ```yaml
   global:
     scrape_interval: 30s  # increase from 15s
   ```

3. **Reduce cardinality** (unique label combinations):
   ```typescript
   // ❌ Don't do this - will explode cardinality
   recordMetric('user_id', userId); // Don't include user IDs!
   
   // ✅ Do this - aggregate instead
   recordMetric('active_users_count', count);
   ```

4. **Limit Jaeger tracing**:
   ```typescript
   // Sample 10% of traces instead of all
   TraceIdRatioBasedSampler(0.1);
   ```

---

## Production Recommendations

### High Availability

- **Prometheus**: Use remote storage (S3, Thanos)
- **Grafana**: Run multiple instances with shared database
- **Jaeger**: Use Cassandra/Elasticsearch backend instead of in-memory
- **AlertManager**: Run with clustering for high availability

### Security

```bash
# Protect UI access with authentication
# Prometheus: Use reverse proxy with OAuth
# Grafana: Enable OAuth/LDAP
# Jaeger: Restrict to internal network

# Use HTTPS everywhere
# Use secrets for API keys and webhooks
```

### Cleanup & Maintenance

```bash
# Weekly: Remove old traces
curl -X DELETE http://jaeger:16686/api/traces?older_than=7d

# Monthly: Reindex Elasticsearch
# See Kibana > Stack > Indices

# Ensure adequate storage for Prometheus/Elasticsearch
```

---

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Best Practices](https://www.jaegertracing.io/docs/latest/)
- [OpenTelemetry for Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [AlertManager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs [service]`
2. Review Prometheus targets: http://localhost:9090/targets
3. Test service endpoints: `curl http://localhost:PORT/metrics`
4. Check Grafana datasources: Grafana > Configuration > Data Sources
