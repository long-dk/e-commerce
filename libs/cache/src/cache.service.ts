import { Injectable, Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { LoggerService } from '../../common/src/logger.service';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
}

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache HIT for key: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(
        `Cache SET for key: ${key}${ttl ? ` with TTL: ${ttl}ms` : ''}`,
      );
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await Promise.all(key.map((k) => this.cacheManager.del(k)));
        this.logger.debug(`Cache DEL for keys: ${key.join(', ')}`);
      } else {
        await this.cacheManager.del(key);
        this.logger.debug(`Cache DEL for key: ${key}`);
      }
    } catch (error) {
      this.logger.error(
        `Cache del error for key ${key}:`,
        error,
      );
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.debug('Cache CLEARED');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get or set - fetch from cache, or compute and cache if not found
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }

      this.logger.debug(`Cache MISS for key: ${key}, computing value...`);
      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      // Fallback to factory computation if cache fails
      return factory();
    }
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix: string, ...args: any[]): string {
    const suffix = args
      .filter((arg) => arg !== null && arg !== undefined)
      .join(':');
    return suffix ? `${prefix}:${suffix}` : prefix;
  }

  /**
   * Generate keys for pattern-based deletion
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // Note: This is a basic implementation. Redis supports SCAN for pattern matching
      // For production, consider using redis client directly with SCAN command
      this.logger.debug(`Cache pattern delete requested for: ${pattern}`);
      // Placeholder for pattern-based deletion
      // In production, use getCacheManager() and execute custom Redis commands
    } catch (error) {
      this.logger.error(`Cache deletePattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      // Returns cache manager stats if available
      const stats = {
        timestamp: new Date(),
        note: 'Cache is running',
      };
      return stats;
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return null;
    }
  }
}
