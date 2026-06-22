# Database Per Service Pattern Implementation Guide

## Overview

This e-commerce microservices architecture implements the **Database Per Service** pattern, a core principle of microservices design where each microservice has its own dedicated database.

## Architecture

### Current State (Before Implementation)
All services shared a single `ecommerce_db` database:
```
All Services → PostgreSQL  (ecommerce_db)
            → MongoDB     (ecommerce_db)
```

**Problems with shared database:**
- ❌ Strong coupling between services
- ❌ Difficult to scale services independently
- ❌ Schema changes affect multiple services
- ❌ Difficult to enforce data boundaries
- ❌ Hard to optimize for specific access patterns

### New Architecture (After Implementation)
Each service has its own isolated database:
```
Auth Service          → PostgreSQL (auth_db)
Orders Service        → PostgreSQL (orders_db)
Payments Service      → PostgreSQL (payments_db)
Shipping Service      → PostgreSQL (shipping_db)
Notifications Service → PostgreSQL (notifications_db)
Products Service      → MongoDB    (products_db)
Inventory Service     → MongoDB    (inventory_db)
```

**Benefits of database per service:**
- ✅ Data isolation and autonomy
- ✅ Independent scaling and optimization
- ✅ Schema evolution without coordinating across services
- ✅ Choice of database technology per service
- ✅ Reduced coupling and dependencies
- ✅ Clearer service boundaries

## Service Database Mapping

| Service | Database | Type | Purpose |
|---------|----------|------|---------|
| **Auth Service** | `auth_db` | PostgreSQL | Users, authentication tokens, OAuth credentials |
| **Orders Service** | `orders_db` | PostgreSQL | Orders, order items, order status history |
| **Payments Service** | `payments_db` | PostgreSQL | Payments, payment methods, transactions, refunds |
| **Shipping Service** | `shipping_db` | PostgreSQL | Shipments, tracking information, delivery history |
| **Notifications Service** | `notifications_db` | PostgreSQL | Notifications, email history, delivery status |
| **Products Service** | `products_db` | MongoDB | Products, categories, pricing, descriptions |
| **Inventory Service** | `inventory_db` | MongoDB | Stock levels, stock movements, alerts, reservations |

## Technology Choices

### PostgreSQL Services
- **Auth** - Relational data, transactions, ACID guarantees needed
- **Orders** - Transactional, complex relationships between orders/items
- **Payments** - Financial data, strict ACID compliance required
- **Shipping** - Trackable state, status history
- **Notifications** - Audit trail, delivery verification

**Why PostgreSQL?**
- ACID compliance for financial transactions
- Complex joins and relationships
- Strong consistency guarantees
- Excellent for transactional data

### MongoDB Services
- **Products** - Product catalog with flexible schema
- **Inventory** - Document-oriented stock data, real-time updates

**Why MongoDB?**
- Flexible document schema (products have varying attributes)
- Excellent for inventory tracking with nested documents
- Good write performance for stock updates
- Easier horizontal scaling for read-heavy operations

## Configuration Variables

### PostgreSQL Configuration
```bash
# Shared Infrastructure
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=ecommerce_user
DATABASE_PASSWORD=ecommerce_password

# Service-Specific Databases
AUTH_SERVICE_DATABASE_NAME=auth_db
ORDERS_SERVICE_DATABASE_NAME=orders_db
PAYMENTS_SERVICE_DATABASE_NAME=payments_db
SHIPPING_SERVICE_DATABASE_NAME=shipping_db
NOTIFICATIONS_SERVICE_DATABASE_NAME=notifications_db
```

### MongoDB Configuration
```bash
# Shared Infrastructure
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USER=ecommerce_user
MONGODB_PASSWORD=ecommerce_password

# Service-Specific Databases
PRODUCTS_SERVICE_DATABASE_NAME=products_db
INVENTORY_SERVICE_DATABASE_NAME=inventory_db
```

## Data Synchronization Strategy

Since services can no longer query other services' databases directly, data synchronization happens through:

### 1. Event-Driven Communication (Kafka)
- Services publish domain events when data changes
- Other services consume events and update their own views/caches
- **Example**: When order is created, Order Service publishes `order.created` event
  - Inventory Service consumes and reserves stock
  - Notifications Service consumes and sends confirmation email

### 2. API-to-API Calls with Resilience Patterns
- Use the implemented Circuit Breaker + Retry patterns
- Services call APIs to fetch data they need
- Responses are cached when appropriate
- **Example**: Orders Service needs product info → calls Products Service API

### 3. Read Models / Event Sourcing (Optional)
- Services maintain read-optimized copies of cross-service data
- Updated through event subscriptions
- Provides fast local access to frequently needed data

## Implementation Details

### Database Configuration Functions

Located in `libs/database/src/database.config.ts`:

```typescript
// Auth Service configuration
export const getAuthServicePostgresConfig = () => /* ... */

// Orders Service configuration
export const getOrdersServicePostgresConfig = () => /* ... */

// Products Service configuration
export const getProductsServiceMongoConfig = () => /* ... */

// And so on for each service...
```

### Module Configuration Example

**Auth Service:**
```typescript
import { getAuthServicePostgresConfig } from '@app/database';

@Module({
  imports: [
    TypeOrmModule.forRoot(getAuthServicePostgresConfig()),
    // ... rest of module
  ],
})
export class AuthModule {}
```

**Products Service:**
```typescript
import { getProductsServiceMongoConfig } from '@app/database';

@Module({
  imports: [
    MongooseModule.forRoot(getProductsServiceMongoConfig().uri),
    // ... rest of module
  ],
})
export class ProductModule {}
```

## Setup and Initialization

### Quick Start

1. **Ensure Docker services are running:**
   ```bash
   docker-compose up postgres mongodb
   ```

2. **Create all service databases:**
   ```bash
   bash scripts/setup-databases.sh
   ```

3. **Start the services:**
   ```bash
   npm run start  # Or individual services with npm run start:auth, etc.
   ```

4. **Services automatically create tables:** (in development mode)
   - TypeORM: Auto-synchronizes PostgreSQL schemas
   - Mongoose: Auto-creates MongoDB collections

### For Production

1. **Manually create databases** or use infrastructure-as-code
2. **Run migrations** before deploying services
3. **Use service-specific database users** with minimal permissions
4. **Enable backup and replication** per database
5. **Monitor database performance** per service

## Best Practices

### 1. Data Boundaries
- **Never** query another service's database directly
- Always use APIs or event bus
- Treat other services' data as read-only

### 2. Cross-Service Transactions
- Use **Saga pattern** for distributed transactions
- Implement compensating transactions for rollback
- Accept eventual consistency

### 3. Shared Reference Data
- Create a shared reference service or replicate data
- Use cache invalidation events
- Period sync from source of truth

### 4. Schema Evolution
- Version your APIs
- Use feature flags for gradual rollouts
- Document breaking changes

### 5. Backup and Recovery
- Backup each database independently
- Test recovery procedures
- Document recovery time objectives (RTO)

### 6. Monitoring
- Monitor each database separately
- Alert on per-service performance degradation
- Track database growth and capacity

## Troubleshooting

### Database Connection Issues

**Error: "Cannot connect to PostgreSQL"**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check credentials in .env
echo $DATABASE_USER
echo $DATABASE_PASSWORD

# Test connection manually
psql -h localhost -U ecommerce_user -d auth_db
```

**Error: "Cannot connect to MongoDB"**
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Test connection manually
mongosh --host localhost -u ecommerce_user -p ecommerce_password
```

### Database Creation Issues

**"Database already exists" error?**
```bash
# Use --reset flag to drop and recreate
bash scripts/setup-databases.sh --reset
```

**"Permission denied" on script?**
```bash
# Make scripts executable
chmod +x scripts/setup-databases.sh
chmod +x scripts/cleanup-databases.sh
chmod +x scripts/init-mongodb-users.sh
```

### Service Can't Find Its Database

**Check the service module:** Ensure it's using the correct config function:
```typescript
// ❌ Wrong - using generic config
TypeOrmModule.forRoot(getPostgresConfig())

// ✅ Correct - using service-specific config
TypeOrmModule.forRoot(getOrdersServicePostgresConfig())
```

## Scaling Considerations

### Horizontal Scaling
- Each service's database can be scaled independently
- PostgreSQL: Read replicas, sharding
- MongoDB: Replica sets, sharding

### Vertical Scaling
- Simply increase database server resources
- Helps when a specific service is CPU or memory bound

### Database Optimization Per Service
- Index strategies tailored to each service's queries
- Partition tables by service's access patterns
- Cache hot data in application layer

## Migration from Shared Database

If migrating from an existing shared database setup:

1. **Create new per-service databases** (parallel runs)
2. **Copy data** to new databases
3. **Deploy services** pointing to new databases
4. **Run validation** to ensure data consistency
5. **Archive old shared database** as backup
6. **Clean up** old database after retention period

## Security Considerations

### Database Access

**Development:**
- Single admin user for all databases
- Good for quick iteration

**Production:**
- Unique user per service
- Limited to their own database
- Read-only replicas for analytics
- Network isolation with security groups

### Credentials Management

**Do NOT** hardcode passwords:
```bash
# ❌ Bad
DATABASE_PASSWORD=ecommerce_password

# ✅ Good
# Use external secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)
# Or use Docker secrets in production
```

### Data Encryption

- PostgreSQL: SSL connections, at-rest encryption
- MongoDB: TLS connections, at-rest encryption
- Network: Use private networks, don't expose databases

## Monitoring and Alerts

### Key Metrics per Service Database

1. **Connection count** - Unusual connection spikes
2. **Query performance** - Slow query logs
3. **Disk usage** - Monitor growth trajectory
4. **Replication lag** - For replicated databases
5. **Transaction rollbacks** - Indicates application issues

### Alerting Rules

```
# Example alerting configuration
auth_db_connections > 50 → Page on-call
auth_db_slow_queries > 10/min → Log and investigate
auth_db_disk_usage > 80% → Increase capacity
```

## Additional Resources

- [Microservices Pattern: Database per service](https://microservices.io/patterns/data/database-per-service.html)
- [Saga Pattern for Distributed Transactions](https://microservices.io/patterns/data/saga.html)
- [Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)

## Quick Reference

### Setup Commands

```bash
# Create databases
bash scripts/setup-databases.sh

# Clean up databases (WARNING: data loss)
bash scripts/cleanup-databases.sh

# Initialize MongoDB users (optional, for security)
bash scripts/init-mongodb-users.sh
```

### Connection Strings

```yaml
Auth Service:
  Type: PostgreSQL
  URL: postgresql://ecommerce_user:password@localhost:5432/auth_db
  
Products Service:
  Type: MongoDB
  URL: mongodb://ecommerce_user:password@localhost:27017/products_db
```

### Service Configuration Files

```
Auth:         apps/auth-service/src/auth.module.ts
Orders:       apps/orders-service/src/order.module.ts
Payments:     apps/payments-service/src/payment.module.ts
Shipping:     apps/shipping-service/src/shipping.module.ts
Notifications: apps/notifications-service/src/notification.module.ts
Products:     apps/products-service/src/product.module.ts
Inventory:    apps/inventory-service/src/inventory.module.ts
```

---

This architecture ensures scalability, independence, and clear service boundaries while maintaining data consistency through event-driven and API-based communication patterns.
