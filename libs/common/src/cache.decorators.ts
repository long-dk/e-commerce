import { applyDecorators } from '@nestjs/common';

export interface CacheableOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string | ((...args: any[]) => string); // Cache key or key generator function
}

/**
 * Decorator to cache method results
 * 
 * Usage: Inject CacheService in your service class
 * 
 * @example
 * constructor(private cacheService: CacheService) {}
 * 
 * @Cacheable({ ttl: 3600000, key: 'products:all' })
 * async getAllProducts() { ... }
 *
 * @example With dynamic key based on parameters
 * @Cacheable({
 *   ttl: 1800000,
 *   key: (args) => `product:${args[0]}`
 * })
 * async getProductById(id: string) { ... }
 */
export function Cacheable(options?: CacheableOptions): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get CacheService from the service instance
      const cacheService = (this as any).cacheService;
      if (!cacheService) {
        console.warn(
          `CacheService not found in ${target.constructor.name}.${String(propertyKey)}. ` +
          `Make sure to inject CacheService: constructor(private cacheService: CacheService) {}`,
        );
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      let cacheKey: string;
      if (typeof options?.key === 'function') {
        cacheKey = options.key(...args);
      } else if (typeof options?.key === 'string') {
        cacheKey = options.key;
      } else {
        cacheKey = `${target.constructor.name}:${String(propertyKey)}`;
      }

      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      // Execute original method and cache result
      const result = await originalMethod.apply(this, args);
      await cacheService.set(cacheKey, result, options?.ttl);
      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate cache for a specific key or pattern
 * 
 * Usage: Inject CacheService in your service class
 *
 * @example
 * constructor(private cacheService: CacheService) {}
 * 
 * @CacheInvalidate({ key: 'products:all' })
 * async createProduct(dto: CreateProductDto) { ... }
 *
 * @example With multiple keys
 * @CacheInvalidate({ keys: ['products:all', 'products:featured'] })
 * async updateProduct(id: string, dto: UpdateProductDto) { ... }
 */
export function CacheInvalidate(options?: {
  key?: string;
  keys?: string[];
}): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      if (!cacheService) {
        console.warn(
          `CacheService not found in ${target.constructor.name}.${String(propertyKey)}. ` +
          `Make sure to inject CacheService: constructor(private cacheService: CacheService) {}`,
        );
        return originalMethod.apply(this, args);
      }

      // Execute original method first
      const result = await originalMethod.apply(this, args);

      // Invalidate cache after method execution
      const keysToInvalidate = [];
      if (options?.key) {
        keysToInvalidate.push(options.key);
      }
      if (options?.keys) {
        keysToInvalidate.push(...options.keys);
      }

      if (keysToInvalidate.length > 0) {
        await cacheService.del(keysToInvalidate);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to both cache result and invalidate related cache
 * 
 * Usage: Inject CacheService in your service class
 *
 * @example
 * constructor(private cacheService: CacheService) {}
 * 
 * @CacheableWithInvalidation({
 *   cache: { ttl: 3600000, key: 'product:123' },
 *   invalidate: { keys: ['products:all', 'products:featured'] }
 * })
 * async updateProduct(id: string, dto: UpdateProductDto) { ... }
 */
export function CacheableWithInvalidation(options?: {
  cache?: CacheableOptions;
  invalidate?: { key?: string; keys?: string[] };
}): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      if (!cacheService) {
        console.warn(
          `CacheService not found in ${target.constructor.name}.${String(propertyKey)}. ` +
          `Make sure to inject CacheService: constructor(private cacheService: CacheService) {}`,
        );
        return originalMethod.apply(this, args);
      }

      // If cache options provided, check cache first
      if (options?.cache) {
        let cacheKey: string;
        if (typeof options.cache.key === 'function') {
          cacheKey = options.cache.key(...args);
        } else if (typeof options.cache.key === 'string') {
          cacheKey = options.cache.key;
        } else {
          cacheKey = `${target.constructor.name}:${String(propertyKey)}`;
        }

        const cached = await cacheService.get(cacheKey);
        if (cached !== undefined) {
          return cached;
        }
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache the result if cache options provided
      if (options?.cache) {
        let cacheKey: string;
        if (typeof options.cache.key === 'function') {
          cacheKey = options.cache.key(...args);
        } else if (typeof options.cache.key === 'string') {
          cacheKey = options.cache.key;
        } else {
          cacheKey = `${target.constructor.name}:${String(propertyKey)}`;
        }
        await cacheService.set(cacheKey, result, options.cache.ttl);
      }

      // Invalidate specified keys
      if (options?.invalidate) {
        const keysToInvalidate = [];
        if (options.invalidate.key) {
          keysToInvalidate.push(options.invalidate.key);
        }
        if (options.invalidate.keys) {
          keysToInvalidate.push(...options.invalidate.keys);
        }

        if (keysToInvalidate.length > 0) {
          await cacheService.del(keysToInvalidate);
        }
      }

      return result;
    };

    return descriptor;
  };
}
