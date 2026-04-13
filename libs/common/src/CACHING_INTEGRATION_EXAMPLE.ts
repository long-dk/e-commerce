/**
 * Example: How to Integrate Caching in Services
 *
 * This example shows how to use CacheService and decorators
 * to add caching to the Products Service.
 *
 * Copy this pattern to other services that need caching.
 */

// In your service file (product.service.ts):
import { Injectable } from '@nestjs/common';
import { CacheService, Cacheable, CacheInvalidate, CACHE_TTL, CACHE_KEYS } from '@app/common';

@Injectable()
export class ProductServiceWithCaching {
  constructor(
    private readonly cacheService: CacheService,
    // ... other dependencies
  ) {}

  /**
   * Example 1: Simple caching with @Cacheable decorator
   * Cache all products for 30 minutes
   */
  @Cacheable({
    ttl: CACHE_TTL.LONG, // 30 minutes
    key: CACHE_KEYS.PRODUCTS_ALL,
  })
  async findAll(query: SearchProductsDto = {}): Promise<any> {
    // Your existing method implementation
    // This will automatically be cached
  }

  /**
   * Example 2: Caching with dynamic key based on parameters
   * Cache individual product by ID for 1 hour
   */
  @Cacheable({
    ttl: CACHE_TTL.VERY_LONG, // 1 hour
    key: (args) => CACHE_KEYS.PRODUCT_BY_ID(args[0]), // args[0] is the product ID
  })
  async findOne(id: string): Promise<any> {
    // Your existing method implementation
  }

  /**
   * Example 3: Cache invalidation on data modification
   * When creating a product, invalidate the products list cache
   */
  @CacheInvalidate({
    keys: [
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED, // Invalidate featured products too
    ],
  })
  async create(createProductDto: CreateProductDto): Promise<any> {
    // Your existing method implementation
    // Cache will be cleared after the method completes
  }

  /**
   * Example 4: Cache invalidation for updates
   * When updating a product, invalidate both individual and list caches
   */
  @CacheInvalidate({
    keys: [
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED,
      (args) => CACHE_KEYS.PRODUCT_BY_ID(args[0]), // Invalidate the specific product
    ],
  })
  async update(id: string, updateProductDto: UpdateProductDto): Promise<any> {
    // Your existing method implementation
  }

  /**
   * Example 5: Manual cache operations
   * When you need more control, use CacheService directly
   */
  async getProductsWithManualCache(category: string): Promise<any> {
    const cacheKey = CACHE_KEYS.PRODUCTS_BY_CATEGORY(category);

    // Option A: Try to get from cache, compute if not found
    const products = await this.cacheService.getOrSet(
      cacheKey,
      () => this.productModel.find({ category }).exec(),
      CACHE_TTL.MEDIUM, // 15 minutes
    );

    return products;
  }

  /**
   * Example 6: Advanced - Cache with custom invalidation logic
   * Use when you need to invalidate multiple related caches
   */
  async searchProducts(query: string): Promise<any> {
    const cacheKey = CACHE_KEYS.PRODUCTS_SEARCH(query);

    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute search
    const results = await this.productModel
      .find({ $text: { $search: query } })
      .limit(20)
      .exec();

    // Cache results
    await this.cacheService.set(cacheKey, results, CACHE_TTL.SHORT); // 5 minutes

    return results;
  }

  /**
   * Example 7: Clear specific-related caches after bulk operations
   */
  async bulkUpdateProducts(productIds: string[], updates: any): Promise<void> {
    // Perform bulk update
    // ... your implementation

    // Clear all affected caches
    const keysToInvalidate = [
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED,
      ...productIds.map((id) => CACHE_KEYS.PRODUCT_BY_ID(id)),
    ];

    await this.cacheService.del(keysToInvalidate);
  }
}

/**
 * INTEGRATION STEPS FOR YOUR SERVICE:
 *
 * 1. Import CacheService and decorators:
 *    import { CacheService, Cacheable, CacheInvalidate, CACHE_TTL, CACHE_KEYS } from '@app/common';
 *
 * 2. Inject CacheService in constructor:
 *    constructor(
 *      @InjectModel('Product') private productModel: Model<any>,
 *      private readonly cacheService: CacheService,
 *      // ... other dependencies
 *    ) {}
 *
 * 3. Add decorators to methods:
 *    - @Cacheable() for read operations
 *    - @CacheInvalidate() for write operations
 *
 * 4. Or use cacheService directly for complex scenarios:
 *    - this.cacheService.get(key)
 *    - this.cacheService.set(key, value, ttl)
 *    - this.cacheService.getOrSet(key, factory, ttl)
 *    - this.cacheService.del(key)
 *
 * 5. Remember: CommonModule is Global, so caching is available everywhere!
 *
 * 6. Define your own CACHE_KEYS in cache.config.ts if needed
 *
 * CACHE TTL RECOMMENDATIONS BY SERVICE:
 * =====================================
 * - Products (read-heavy): 30-60 minutes (LONG, VERY_LONG)
 * - Categories (rarely change): 1-24 hours (VERY_LONG, EXTRA_LONG)
 * - Inventory (changes frequently): 5-15 minutes (SHORT, MEDIUM)
 * - User Sessions: 24 hours (EXTRA_LONG)
 * - Search Results: 5-15 minutes (SHORT, MEDIUM)
 * - Order Lists (user-specific): 15 minutes (MEDIUM)
 */
