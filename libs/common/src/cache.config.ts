import { CacheModuleOptions } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import type { RedisClientOptions } from 'redis';

/**
 * Get Redis cache configuration
 * Supports both development and production environments
 */
export const getRedisCacheConfig = (): CacheModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

  const redisOptions: RedisClientOptions = {
    host: redisHost,
    port: redisPort,
    db: redisDb,
    ...(redisPassword && { password: redisPassword }),
  };

  const defaultTtl = isProduction ? 3600000 : 1800000; // 1 hour prod, 30 min dev

  return {
    store: redisStore,
    host: redisHost,
    port: redisPort,
    ...(redisPassword && { password: redisPassword }),
    db: redisDb,
    isGlobal: true,
    ttl: defaultTtl, // Default TTL in milliseconds
  } as any;
};

/**
 * Get in-memory cache configuration (for testing/development without Redis)
 */
export const getMemoryCacheConfig = (): CacheModuleOptions => {
  return {
    isGlobal: true,
    ttl: 1800000, // 30 minutes
  };
};

/**
 * Commonly used TTL values (in milliseconds)
 */
export const CACHE_TTL = {
  VERY_SHORT: 60000, // 1 minute
  SHORT: 300000, // 5 minutes
  MEDIUM: 900000, // 15 minutes
  LONG: 1800000, // 30 minutes
  VERY_LONG: 3600000, // 1 hour
  EXTRA_LONG: 86400000, // 24 hours
};

/**
 * Pre-defined cache keys for common data
 */
export const CACHE_KEYS = {
  // Product cache keys
  PRODUCTS_ALL: 'products:all',
  PRODUCTS_FEATURED: 'products:featured',
  PRODUCT_BY_ID: (id: string) => `product:${id}`,
  PRODUCTS_BY_CATEGORY: (category: string) => `products:category:${category}`,
  PRODUCTS_SEARCH: (query: string) => `products:search:${query}`,

  // Inventory cache keys
  INVENTORY_BY_PRODUCT: (productId: string) => `inventory:${productId}`,
  INVENTORY_ALL: 'inventory:all',

  // Order cache keys
  ORDERS_BY_USER: (userId: string) => `orders:user:${userId}`,
  ORDER_BY_ID: (orderId: string) => `order:${orderId}`,

  // User cache keys
  USER_BY_ID: (userId: string) => `user:${userId}`,
  USERS_ALL: 'users:all',

  // Category cache keys
  CATEGORIES_ALL: 'categories:all',
  CATEGORY_BY_ID: (categoryId: string) => `category:${categoryId}`,
};
