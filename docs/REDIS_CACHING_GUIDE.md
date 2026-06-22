# Redis Caching Implementation Guide

## Overview

This e-commerce microservices architecture implements **Redis caching** to improve performance and reduce database load. Redis is a high-performance, in-memory data store used for caching frequently accessed data across all microservices.

## Why Redis Caching?

### Problem Statement
- Database queries for frequently accessed data (products, categories, user profiles) cause unnecessary load
- API response times are slower than needed
- Under high traffic, database connections become bottlenecks
- Scaling becomes expensive when constantly querying the same data

### Solution Benefits
✅ **Faster Response Times** - Sub-millisecond cache lookups vs database queries  
✅ **Reduced Database Load** - Fewer expensive database queries  
✅ **Lower Infrastructure Costs** - Handle more traffic with same hardware  
✅ **Better Scalability** - Horizontal scaling without proportional database growth  
✅ **Improved User Experience** - Faster API responses and page loads  

## Architecture

### Cache Layer in Request Flow

```
User Request
    ↓
API Endpoint
    ↓
Check Redis Cache ← CACHE HIT (return immediately)
    ↓ (cache miss)
Query Database
    ↓
Store in Redis Cache
    ↓
Return Response
```

### Current Caching Strategy

```
┌─────────────────────────────────────┐
│      Microservices (All)            │
├─────────────────────────────────────┤
│           ↓                         │
├─────────────────────────────────────┤
│    Redis In-Memory Cache (7.0)      │
│  - Products List  → 30 min TTL      │
│  - Product Details → 1 hour TTL    │
│  - Categories → 24 hours TTL       │
│  - Brands → 24 hours TTL           │
│  - User Sessions → 24 hours TTL    │
├─────────────────────────────────────┤
│           ↓                         │
├─────────────────────────────────────┤
│ PostgreSQL + MongoDB (Persistent)   │
└─────────────────────────────────────┘
```

## What Gets Cached?

### Products Service (Highest Priority)
| Data | TTL | Reasoning |
|------|-----|-----------|
| All Products List | 30 min | Frequently accessed, changes less often |
| Individual Product | 1 hour | Detailed view is relatively static |
| Featured Products | 30 min | Promotion feature, cached for consistency |
| Product Categories | 24 hours | Rarely change |
| Product Brands | 24 hours | Rarely change |
| Search Results | 5 min | Popular searches, change frequently |

### Inventory Service (High Priority)
| Data | TTL | Reasoning |
|------|-----|-----------|
| Stock Levels | 5 min | Changes frequently, need fresh data |
| Stock Alerts | 15 min | Less frequent updates |
| Inventory Reports | 30 min | Summaries don't need real-time updates |

### Orders Service (Medium Priority)
| Data | TTL | Reasoning |
|------|-----|-----------|
| User Order History | 15 min | Prevents repeated DB hits for same user |
| Order Status | 5 min | Frequently checked, can be slightly stale |
| Order Statistics | 1 hour | Dashboard data, doesn't need real-time |

### User/Auth Service (Medium Priority)
| Data | TTL | Reasoning |
|------|-----|-----------|
| User Profile | 30 min | Changes infrequently |
| User Preferences | 1 hour | Static configuration |
| Session Data | 24 hours | Allows distributed sessions |

## Setup Instructions

### 1. Start Redis with Docker

```bash
# Start Redis in Docker Compose
docker-compose up redis

# Or start all services
docker-compose up
```

### 2. Verify Redis is Running

```bash
# Check if Redis is responding
redis-cli ping
# Output: PONG

# Connect to Redis
redis-cli

# List all keys
> KEYS *

# Get cache statistics
> INFO stats
```

### 3. Verify Cache Configuration

The `getRedisCacheConfig()` function in `libs/common/src/cache.config.ts` handles configuration:

```typescript
// Environment variables used:
REDIS_HOST=localhost       // Default: localhost
REDIS_PORT=6379            // Default: 6379
REDIS_PASSWORD=redis_password  // Optional password
REDIS_DB=0                 // Which Redis database to use
```

## Using Caching in Services

### Quick Start - 3 Steps

#### Step 1: Import CacheService

```typescript
import { CacheService, CACHE_TTL, CACHE_KEYS } from '@app/common';
```

#### Step 2: Inject in Constructor

```typescript
constructor(
  private readonly cacheService: CacheService,
  // ... other dependencies
) {}
```

#### Step 3: Use Caching Methods

```typescript
// Option A: Manual cache get/set
const cached = await this.cacheService.get('products:all');

// Option B: Get or set (auto cache on miss)
const products = await this.cacheService.getOrSet(
  'products:all',
  () => this.productModel.find().exec(),
  CACHE_TTL.LONG
);

// Option C: Invalidate cache
await this.cacheService.del(['products:all', 'products:featured']);
```

### Complete Example: Products Service

See implementation in [apps/products-service/src/product.service.ts](../apps/products-service/src/product.service.ts)

```typescript
// Caching in query operations
async findOne(id: string): Promise<ProductResponseDto> {
  // Check cache first
  const cached = await this.cacheService.get<ProductResponseDto>(
    CACHE_KEYS.PRODUCT_BY_ID(id)
  );
  if (cached) return cached;

  // Query database if not cached
  const product = await this.productModel.findById(id).exec();
  
  // Cache result for 1 hour
  await this.cacheService.set(
    CACHE_KEYS.PRODUCT_BY_ID(id),
    this.toProductResponseDto(product),
    CACHE_TTL.VERY_LONG
  );
  
  return this.toProductResponseDto(product);
}

// Cache invalidation on updates
async update(id: string, updateDto: UpdateProductDto): Promise<ProductResponseDto> {
  const updated = await this.productModel
    .findByIdAndUpdate(id, updateDto, { new: true })
    .exec();

  // Invalidate affected caches
  await this.cacheService.del([
    CACHE_KEYS.PRODUCTS_ALL,
    CACHE_KEYS.PRODUCTS_FEATURED,
    CACHE_KEYS.PRODUCT_BY_ID(id),
  ]);

  return this.toProductResponseDto(updated);
}
```

## Cache Keys Reference

Predefined cache keys help maintain consistency:

```typescript
CACHE_KEYS = {
  // Product cache keys
  PRODUCTS_ALL: 'products:all',
  PRODUCTS_FEATURED: 'products:featured',
  PRODUCT_BY_ID: (id) => `product:${id}`,
  PRODUCTS_BY_CATEGORY: (cat) => `products:category:${cat}`,
  PRODUCTS_SEARCH: (query) => `products:search:${query}`,

  // Inventory cache keys
  INVENTORY_BY_PRODUCT: (id) => `inventory:${id}`,
  INVENTORY_ALL: 'inventory:all',

  // Order cache keys
  ORDERS_BY_USER: (userId) => `orders:user:${userId}`,
  ORDER_BY_ID: (orderId) => `order:${orderId}`,

  // User cache keys
  USER_BY_ID: (userId) => `user:${userId}`,
  USERS_ALL: 'users:all',

  // Category cache keys
  CATEGORIES_ALL: 'categories:all',
  CATEGORY_BY_ID: (id) => `category:${id}`,
};
```

## TTL (Time To Live) Guidelines

```typescript
CACHE_TTL = {
  VERY_SHORT:   60000,      // 1 minute     - Fast-changing data
  SHORT:        300000,     // 5 minutes    - Frequently changing
  MEDIUM:       900000,     // 15 minutes   - Moderate frequency
  LONG:         1800000,    // 30 minutes   - Slowly changing
  VERY_LONG:    3600000,    // 1 hour       - Static data
  EXTRA_LONG:   86400000,   // 24 hours     - Reference data
};
```

### TTL Selection by Data Type

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Product Lists | LONG (30 min) | Popular searches, changes intermittently |
| Product Detail | VERY_LONG (1h) | Individual items don't change frequently |
| Inventory | SHORT (5 min) | Stock levels change relatively often |
| Categories | EXTRA_LONG (24h) | Set once, rarely modified |
| User Session | EXTRA_LONG (24h) | Durable distributed sessions |
| Search Results | SHORT (5 min) | Popular results, user-specific |

## Advanced Usage

### Cache Invalidation Patterns

#### Pattern 1: Single Item Update

```typescript
// When updating one product, invalidate its cache
await this.cacheService.del(CACHE_KEYS.PRODUCT_BY_ID(productId));
```

#### Pattern 2: Cascading Invalidation

```typescript
// When modifying product, also invalidate lists
await this.cacheService.del([
  CACHE_KEYS.PRODUCT_BY_ID(id),
  CACHE_KEYS.PRODUCTS_ALL,
  CACHE_KEYS.PRODUCTS_BY_CATEGORY(category),
  'products:categories:all',
]);
```

#### Pattern 3: Bulk Operations

```typescript
// Invalidate multiple keys after bulk update
const keysToInvalidate = productIds.map(id => 
  CACHE_KEYS.PRODUCT_BY_ID(id)
);
keysToInvalidate.push(CACHE_KEYS.PRODUCTS_ALL);
await this.cacheService.del(keysToInvalidate);
```

### Cache Warming

Pre-load frequently accessed data on service startup:

```typescript
async onModuleInit() {
  // Warm up popular product cache
  const featuredProducts = await this.productModel
    .find({ isFeatured: true })
    .limit(10)
    .exec();
    
  await this.cacheService.set(
    CACHE_KEYS.PRODUCTS_FEATURED,
    featuredProducts.map(p => this.toDTO(p)),
    CACHE_TTL.LONG
  );
}
```

### conditional Caching

```typescript
// Cache expensive queries, but not simple ones
async getProducts(filter: any): Promise<Product[]> {
  const isExpensiveQuery = filter.search && filter.category;
  const cacheKey = CACHE_KEYS.PRODUCTS_SEARCH(`${filter.search}:${filter.category}`);

  if (isExpensiveQuery) {
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
  }

  const results = await this.productModel.find(filter).exec();

  if (isExpensiveQuery) {
    await this.cacheService.set(cacheKey, results, CACHE_TTL.MEDIUM);
  }

  return results;
}
```

## Monitoring & Debugging

### Check Cache Statistics

```bash
# Connect to Redis
redis-cli

# Get cache info
> INFO stats

# Monitor key pattern
> MONITOR

# Check specific key
> GET product:123

# Check key expiration
> TTL product:123

# Clear all cache (DANGER!)
> FLUSHDB
```

### Cache Hit Rate Monitoring

Monitor cache effectiveness:

```typescript
// In a monitoring service
const stats = await this.cacheService.getStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
console.log(`Keys in cache: ${stats.keyCount}`);
console.log(`Memory usage: ${stats.memoryUsage} bytes`);
```

### View All Cached Products

```bash
redis-cli

# Find all product keys
> KEYS product:*

# Get specific product
> GET product:507f1f77bcf86cd799439011

# Delete specific cache
> DEL product:507f1f77bcf86cd799439011
```

## Troubleshooting

### Issue: Cache Not Working

**Symptoms:** Always getting fresh data, no cache hits

```bash
# Check if Redis is running
docker ps | grep redis

# Check if CacheService is injected
# Add logging to verify cacheService exists

# Check Redis connectivity
redis-cli ping
```

**Solution:**
```typescript
// Verify CacheService is injected
constructor(
  private readonly cacheService: CacheService, // Must be here
) {}

// Add debug logging
async getProducts() {
  const cached = await this.cacheService.get('products:all');
  console.log('Cache lookup:', cached ? 'HIT' : 'MISS');
}
```

### Issue: Stale Data in Cache

**Symptoms:** Data shows old values even after update

**Root Cause:** Cache invalidation not triggered properly

**Solution:**
```typescript
// Ensure all write operations invalidate cache
async updateProduct(id: string, dto: UpdateDto) {
  const result = await this.productModel.findByIdAndUpdate(id, dto);
  
  // CRITICAL: Invalidate cache
  await this.cacheService.del([
    CACHE_KEYS.PRODUCT_BY_ID(id),
    CACHE_KEYS.PRODUCTS_ALL,
  ]);
  
  return result;
}
```

### Issue: Redis Connection Refused

```
Error: Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Start Redis in Docker
docker-compose up redis -d

# Or verify environment variables
echo $REDIS_HOST
echo $REDIS_PORT
```

### Issue: Out of Memory

```
Error: OOM command not allowed when used memory > maxmemory
```

**Solution:**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Increase Redis memory allocation in docker-compose.yml
command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru

# Or clear old cache entries
redis-cli FLUSHDB
```

## Performance Metrics

### Expected Performance Improvements

| Operation | Without Cache | With Cache | Improvement |
|-----------|---------------|-----------|------------|
| Get Product | 50-100 ms | 1-5 ms | 10-100x faster |
| List Products | 200-500 ms | 5-20 ms | 10-100x faster |
| Search | 300-800 ms | 10-30 ms | 10-100x faster |
| Category List | 100-200 ms | 1-3 ms | 50-200x faster |

### Example Load Test Results

**Without Cache:**
- 100 requests/sec → 50% at 500ms+ latency
- Database CPU: 80-90%
- Server throughput: ~200 req/sec max

**With Cache:**
- 100 requests/sec → 95% under 50ms latency
- Database CPU: 10-20%
- Server throughput: ~2000 req/sec max

## Best Practices

✅ **DO's**
- Use descriptive cache keys (`products:featured` not `pf`)
- Set appropriate TTLs based on data frequency
- Invalidate caches on all write operations
- Monitor cache hit rates
- Test cache invalidation logic
- Document cache keys in your service
- Use CACHE_KEYS constants for consistency

❌ **DON'Ts**
- Don't cache sensitive data (passwords, tokens)
- Don't use infinite TTLs for mutable data
- Don't forget to invalidate on updates
- Don't cache per-user data with global keys
- Don't rely on cache for data integrity
- Don't ignore out-of-memory errors

## Production Considerations

### Memory Management
```typescript
// Production: Limited memory, use LRU eviction
command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### Persistence
```yaml
redis:
  command: redis-server --appendonly yes  # Enable AOF persistence
  volumes:
    - redis-data:/data
```

### Replication & Backup
```bash
# For HA: Use Redis Sentinel or Redis Cluster
# For backups: Schedule regular BGSAVE commands
```

### Security
```bash
# Always use password in production
REDIS_PASSWORD=strong-password-here

# Use network isolation
# Don't expose Redis to the internet
```

## Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [Cache-Manager](https://www.npmjs.com/package/cache-manager)
- [Redis Best Practices](https://redis.io/docs/management/optimization/eviction/)

## Quick Reference

### Start Services
```bash
docker-compose up postgres mongodb redis kafka
```

### Common Redis Commands
```bash
redis-cli KEYS *              # List all keys
redis-cli TTL key             # Get expiration time
redis-cli GET key             # Get value
redis-cli SET key value EX 60 # Set with 60s TTL
redis-cli DEL key             # Delete key
redis-cli FLUSHDB             # Clear all data
redis-cli SHUTDOWN            # Stop Redis
```

### Service-Specific Cache Setup
```typescript
// Products Service
import { CACHE_KEYS, CACHE_TTL } from '@app/common';

async findOne(id: string) {
  return await this.cacheService.getOrSet(
    CACHE_KEYS.PRODUCT_BY_ID(id),
    () => this.productModel.findById(id).exec(),
    CACHE_TTL.VERY_LONG
  );
}
```

---

Redis caching is now fully integrated! Start using it in your services for better performance and scalability.
