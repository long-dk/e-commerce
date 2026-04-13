# API Gateway Implementation Guide

## Overview

The API Gateway serves as the single entry point for all client requests to the e-commerce microservices. It provides:

✅ **Apollo Federation GraphQL Gateway** - All 7 services registered  
✅ **REST Proxy Layer** - Legacy API compatibility  
✅ **Rate Limiting** - 100 requests per 15 minutes per IP  
✅ **Health Checks & Monitoring** - Service discovery and status  
✅ **CORS Support** - Configurable cross-origin requests  
✅ **Request Forwarding** - Transparent service routing  
✅ **Error Handling** - Centralized error responses  

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Client Applications                           │
│  (Web, Mobile, Third-party, Admin Dashboard)            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
        ┌────────────────────────────────┐
        │   API Gateway (Port 4000)      │
        ├────────────────────────────────┤
        │ • GraphQL Endpoint (/graphql)  │
        │ • REST Proxy (/api/v1/:svc)    │
        │ • Health Checks (/health)      │
        │ • Service Registry (/services) │
        ├────────────────────────────────┤
        │     Middleware & Guards        │
        │ • Rate Limiting                │
        │ • CORS                         │
        │ • Auth Context                 │
        │ • Request Logging              │
        └────────┬──────────────────────┘
                 │
      ┌──────────┼──────────┬──────────┬───────────┬─────────────┐
      ↓          ↓          ↓          ↓           ↓             ↓
    Auth       Products   Orders   Payments  Inventory   Shipping  Notifications
    4001       4002       4003     4004      4005        4006      4007
```

## Endpoints

### GraphQL Federation (Apollo)

**Endpoint:** `POST /graphql`
**Playground:** `GET /graphql` (development only)

```bash
# Query example
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ products(input: {page: 1, limit: 10}) { products { id name price } } }"}'
```

**Features:**
- Apollo Federation with schema composition
- Schema polling (updates every 10 seconds)
- Subscriptions support for real-time updates
- Playground for interactive testing

### REST API Proxy

**Base Path:** `/api/v1`

Routes are forwarded to individual services:

```
GET    /api/v1/:service/*              (Read / List)
POST   /api/v1/:service/*              (Create)
PUT    /api/v1/:service/*              (Update)
DELETE /api/v1/:service/*              (Delete)
```

#### Examples

```bash
# Get all products
GET /api/v1/products/products

# Get product by ID
GET /api/v1/products/products/507f1f77bcf86cd799439011

# Create product (protected)
POST /api/v1/products/products
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "New Product",
  "price": 29.99,
  "category": "Electronics",
  "stock": 100
}

# Update product
PUT /api/v1/products/products/507f1f77bcf86cd799439011
Authorization: Bearer eyJhbGc...

{
  "price": 24.99,
  "stock": 95
}

# Get all orders (protected)
GET /api/v1/orders/orders
Authorization: Bearer eyJhbGc...

# Create order
POST /api/v1/orders/orders
Authorization: Bearer eyJhbGc...

{
  "items": [
    { "productId": "prod123", "quantity": 2 },
    { "productId": "prod456", "quantity": 1 }
  ],
  "shippingAddress": { ... }
}

# Process payment
POST /api/v1/payments/payments
Authorization: Bearer eyJhbGc...

{
  "orderId": "order123",
  "amount": 99.99,
  "method": "credit_card"
}
```

### Health Checks

#### Gateway Health
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-13T10:30:00Z",
  "environment": "development",
  "uptime": 3600.5
}
```

#### All Services Health
```
GET /health/services
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-13T10:30:00Z",
  "services": {
    "auth": {
      "available": true,
      "status": "healthy",
      "latency": 12
    },
    "products": {
      "available": true,
      "status": "healthy",
      "latency": 8
    },
    "orders": {
      "available": true,
      "status": "healthy",
      "latency": 15
    },
    "payments": {
      "available": true,
      "status": "healthy",
      "latency": 10
    },
    "inventory": {
      "available": true,
      "status": "healthy",
      "latency": 9
    },
    "shipping": {
      "available": true,
      "status": "healthy",
      "latency": 14
    },
    "notifications": {
      "available": true,
      "status": "healthy",
      "latency": 11
    }
  }
}
```

#### Specific Service Health
```
GET /health/services/:service

# Example
GET /health/services/products
```

Response:
```json
{
  "service": "products",
  "status": "healthy",
  "latency": 8,
  "timestamp": "2026-04-13T10:30:00Z"
}
```

### Service Discovery

```
GET /api/v1/services
```

Response:
```json
[
  {
    "name": "auth",
    "graphql": "http://localhost:4001/graphql",
    "rest": "http://localhost:4001",
    "available": true
  },
  {
    "name": "products",
    "graphql": "http://localhost:4002/graphql",
    "rest": "http://localhost:4002",
    "available": true
  },
  ...
]
```

## Registered Services

All 7 microservices are automatically registered:

| Service | Port | Database | Status |
|---------|------|----------|--------|
| **Auth** | 4001 | PostgreSQL (auth_db) | ✅ Active |
| **Products** | 4002 | MongoDB (products_db) | ✅ Active |
| **Orders** | 4003 | PostgreSQL (orders_db) | ✅ Active |
| **Payments** | 4004 | PostgreSQL (payments_db) | ✅ Active |
| **Inventory** | 4005 | MongoDB (inventory_db) | ✅ Active |
| **Shipping** | 4006 | PostgreSQL (shipping_db) | ✅ Active |
| **Notifications** | 4007 | PostgreSQL (notifications_db) | ✅ Active |

## Authentication & Authorization

### Login Flow

1. **Authenticate with Auth Service**
   ```bash
   POST /api/v1/auth/login
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "secure_password"
   }
   ```

2. **Receive Tokens**
   ```json
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "expiresIn": 3600,
     "user": {
       "id": "user123",
       "email": "user@example.com",
       "firstName": "John",
       "lastName": "Doe"
     }
   }
   ```

3. **Use Token in Requests**
   ```bash
   GET /api/v1/orders/orders
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### OAuth2 Social Login

```bash
# Google OAuth
GET /api/v1/auth/google

# GitHub OAuth
GET /api/v1/auth/github
```

### Token Refresh

```bash
POST /api/v1/auth/refresh-token

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Rate Limiting

**Limits:**
- 100 requests per 15 minutes per IP address
- Applied globally to all endpoints

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1686650400
```

**Example: Rate Limit Exceeded**
```
HTTP/1.1 429 Too Many Requests

{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

### Adjusting Rate Limits

Edit `api-gateway.module.ts`:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 900000,   // 15 minutes in milliseconds
    limit: 100,    // Max requests per window
  },
])
```

## CORS Configuration

**Allowed Origins** (configurable via environment variable):
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,https://example.com
```

**Updated dynami ally:**
1. Edit `.env` file
2. Restart gateway
3. Or use default origin: `http://localhost:3000`

**Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:**
- Content-Type
- Authorization

## Error Handling

### GraphQL Errors
```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

### REST Errors

**404 - Not Found**
```json
{
  "statusCode": 404,
  "message": "Service \"unknown-service\" not found"
}
```

**401 - Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**503 - Service Unavailable**
```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable"
}
```

## Request Forwarding Headers

The gateway automatically adds forwarding headers to upstream requests:

```
X-Forwarded-By: api-gateway
X-Forwarded-For: 192.168.1.1
```

These help services track request origin and audit trails.

## Environment Variables

```bash
# Gateway Configuration
API_GATEWAY_PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000

# Service URLs (optional - defaults to localhost)
AUTH_SERVICE_API=http://localhost:4001/graphql
AUTH_SERVICE_REST=http://localhost:4001
PRODUCTS_SERVICE_API=http://localhost:4002/graphql
PRODUCTS_SERVICE_REST=http://localhost:4002
ORDERS_SERVICE_API=http://localhost:4003/graphql
ORDERS_SERVICE_REST=http://localhost:4003
PAYMENTS_SERVICE_API=http://localhost:4004/graphql
PAYMENTS_SERVICE_REST=http://localhost:4004
INVENTORY_SERVICE_API=http://localhost:4005/graphql
INVENTORY_SERVICE_REST=http://localhost:4005
SHIPPING_SERVICE_API=http://localhost:4006/graphql
SHIPPING_SERVICE_REST=http://localhost:4006
NOTIFICATIONS_SERVICE_API=http://localhost:4007/graphql
NOTIFICATIONS_SERVICE_REST=http://localhost:4007
```

## Starting the Gateway

### Development

```bash
# Start all services
docker-compose up

# In another terminal, start the gateway
npm run start:gateway

# Or with watch mode
npm run start:dev -- --project api-gateway
```

### Production

```bash
# Build
npm run build

# Start
NODE_ENV=production node dist/apps/api-gateway/main.js
```

### Docker

```bash
docker-compose up api-gateway
```

## Monitoring & Debugging

### Health Check Loop
```bash
# Monitor all services health every 5 seconds
watch -n 5 'curl -s http://localhost:4000/health/services | jq'
```

### Real-time Request Logging
The gateway logs all incoming requests and forwarded calls:
```
[ApiGateway] 10:30:15 GET /api/v1/products/products
[ProxyService] 10:30:15.012 Forwarding GET http://localhost:4002/products
[ProxyService] 10:30:15.135 Response received: 200 OK (123ms)
```

### GraphQL Schema Inspection
```bash
curl -s http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

## Performance Tuning

### Rate Limiting Adjustment

For high-traffic scenarios:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 900000,    // 15 minutes
    limit: 1000,    // Increase to 1000 req/15min
  },
])
```

### Service Timeout Configuration

Edit `service-registry.ts`:
```typescript
timeout: 10000,  // 10 seconds
retries: 2,      // Retry failed requests
```

### Schema Polling Frequency

Edit `api-gateway.module.ts`:
```typescript
pollIntervalInMs: 10000,  // Poll every 10 seconds
```

Reduce to 5000 for faster schema updates, increase to 30000 for less overhead.

## Best Practices

✅ **DO:**
- Use GraphQL for complex queries (nested data, relationships)
- Use REST for simple CRUD operations
- Include auth token in Authorization header for protected routes
- Monitor health endpoint regularly
- Check rate limit headers in response
- Use appropriate HTTP methods (GET for reads, POST for creates)
- Document API contracts for clients

❌ **DON'T:**
- Expose internal service URLs directly to clients
- Make multiple REST calls when one GraphQL query suffices
- Ignore rate limit responses (implement backoff)
- Use hardcoded service ports in client code
- Call protected endpoints without authentication
- Make synchronous calls in series when they can be parallel
- Store sensitive data in query parameters (use request body)

## Troubleshooting

### Service Not Found Error
```json
{
  "statusCode": 404,
  "message": "Service \"myservice\" not found"
}
```

**Solution:** Verify service name in URL matches registered service:
```bash
# Check registered services
curl http://localhost:4000/api/v1/services

# Use correct name from response
GET /api/v1/products/...  (NOT /api/v1/product/...)
```

### Service Unavailable

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable"
}
```

**Solution:**
1. Check service health: `curl http://localhost:4000/health/services/products`
2. Verify service is running: `docker ps | grep products`
3. Check service logs: `docker logs products-service`

### Rate Limit Exceeded

```
HTTP/1.1 429 Too Many Requests
```

**Solution:**
1. Implement exponential backoff in client
2. Batch requests when possible
3. Request rate limit increase (contact admin)

### GraphQL Schema Errors

**Symptom:** "Cannot compose schema" errors

**Solution:**
1. Check if all services are running
2. Verify GraphQL endpoints are accessible
3. Check service logs for schema issues
4. Restart gateway: `npm run start:gateway`

## API Gateway vs Direct Service Calls

### Use API Gateway (Recommended)
- ✅ Client applications
- ✅ Third-party integrations
- ✅ Mobile app backends
- ✅ Public APIs

### Use Direct Service Calls (When appropriate)
- Internal service-to-service communication (use Kafka events)
- Admin tools with special requirements
- Legacy system integrations

---

**API Gateway is now fully operational!** 🚀

For support or questions, check service logs:
```bash
docker logs api-gateway
docker logs products-service
# ... etc
```