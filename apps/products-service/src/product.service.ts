import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto,
  SearchProductsDto,
} from '@app/dto';
import {
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductDeletedEvent,
  StockUpdatedEvent,
  OrderPlacedEvent,
  OrderCancelledEvent,
} from '@app/kafka';
import {
  LoggerService,
  CacheService,
  Cacheable,
  CacheInvalidate,
  CACHE_TTL,
  CACHE_KEYS,
} from '@app/common';
import { ProductGateway } from './product.gateway';
import { ProductDocument } from './product.schema';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class ProductService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    @Inject('KAFKA_CLIENT') private readonly clientKafka: ClientKafka,
    @Inject(forwardRef(() => ProductGateway))
    private readonly productGateway: ProductGateway,
    private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    await this.clientKafka.connect()
  }

  async onModuleDestroy() {
    await this.clientKafka.close();
  }

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const product = new this.productModel(createProductDto);
    const savedProduct = await product.save();

    // Publish Kafka event
    await this.publishProductCreatedEvent(savedProduct);

    // Emit real-time WebSocket event
    this.productGateway.emitProductCreated(this.toProductResponseDto(savedProduct));

    // Invalidate list caches
    await this.cacheService.del([
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED,
      'products:brands:all',
      'products:categories:all',
    ]);

    return this.toProductResponseDto(savedProduct);
  }

  async findAll(query: SearchProductsDto = {}): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      query: searchQuery,
      category,
      brand,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      inStock,
      isFeatured,
    } = query;

    const filter: any = {};

    // Only show active products by default unless explicitly set to false
    if (query.isActive !== false) {
      filter.isActive = true;
    }

    // Search filter
    if (searchQuery) {
      filter.$text = { $search: searchQuery };
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Brand filter
    if (brand) {
      filter.brand = brand;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    // Rating filter
    if (minRating !== undefined) {
      filter.rating = { $gte: minRating };
    }

    // Stock filter
    if (inStock === true) {
      filter.stock = { $gt: 0 };
    }

    // Featured filter
    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured;
    }

    // Sorting
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products: products.map((product) => this.toProductResponseDto(product)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    // Try cache first
    const cached = await this.cacheService.get<ProductResponseDto>(
      CACHE_KEYS.PRODUCT_BY_ID(id),
    );
    if (cached) {
      return cached;
    }

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const responseDto = this.toProductResponseDto(product);
    
    // Cache the result for 1 hour
    await this.cacheService.set(
      CACHE_KEYS.PRODUCT_BY_ID(id),
      responseDto,
      CACHE_TTL.VERY_LONG,
    );

    return responseDto;
  }

  async findByIds(ids: string[]): Promise<ProductResponseDto[]> {
    const products = await this.productModel
      .find({ _id: { $in: ids }, isActive: true })
      .exec();
    return products.map((product) => this.toProductResponseDto(product));
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException('Product not found');
    }

    // Publish Kafka event
    await this.publishProductUpdatedEvent(updatedProduct);

    // Emit real-time WebSocket event
    this.productGateway.emitProductUpdated(this.toProductResponseDto(updatedProduct));

    // Invalidate caches
    await this.cacheService.del([
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED,
      CACHE_KEYS.PRODUCT_BY_ID(id),
      'products:brands:all',
      'products:categories:all',
    ]);

    return this.toProductResponseDto(updatedProduct);
  }

  async remove(id: string): Promise<void> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.productModel.findByIdAndDelete(id).exec();

    // Publish Kafka event
    await this.publishProductDeletedEvent(product);

    // Emit real-time WebSocket event
    this.productGateway.emitProductDeleted(product._id.toString(), product.category);

    // Invalidate caches
    await this.cacheService.del([
      CACHE_KEYS.PRODUCTS_ALL,
      CACHE_KEYS.PRODUCTS_FEATURED,
      CACHE_KEYS.PRODUCT_BY_ID(id),
      'products:brands:all',
      'products:categories:all',
    ]);
  }

  async updateStock(id: string, quantity: number): Promise<ProductResponseDto> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const previousStock = product.stock;
    if (previousStock + quantity < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    product.stock += quantity;
    await product.save();

    // Publish Kafka event
    await this.publishStockUpdatedEvent(product, previousStock, quantity > 0 ? 'restock' : 'sale');

    // Emit real-time WebSocket event
    this.productGateway.emitStockUpdated(
      product._id.toString(),
      previousStock,
      product.stock,
      quantity > 0 ? 'restock' : 'sale'
    );

    // Check for low stock alert
    if (product.minStockLevel && product.stock <= product.minStockLevel) {
      this.productGateway.emitLowStockAlert(
        product._id.toString(),
        product.name,
        product.stock,
        product.minStockLevel
      );
    }

    // Invalidate product cache since stock changed
    await this.cacheService.del([
      CACHE_KEYS.PRODUCT_BY_ID(id),
      CACHE_KEYS.PRODUCTS_ALL,
    ]);

    return this.toProductResponseDto(product);
  }

  async getCategories(): Promise<string[]> {
    // Try cache first
    const cached = await this.cacheService.get<string[]>(
      'products:categories:all',
    );
    if (cached) {
      return cached;
    }

    const categories = await this.productModel
      .distinct('category', { isActive: true })
      .exec();

    // Cache for 24 hours - categories rarely change
    await this.cacheService.set(
      'products:categories:all',
      categories,
      CACHE_TTL.EXTRA_LONG,
    );

    return categories;
  }

  async getBrands(): Promise<string[]> {
    // Try cache first
    const cached = await this.cacheService.get<string[]>(
      'products:brands:all',
    );
    if (cached) {
      return cached;
    }

    const brands = await this.productModel
      .distinct('brand', { isActive: true })
      .exec();

    // Cache for 24 hours - brands rarely change
    await this.cacheService.set(
      'products:brands:all',
      brands,
      CACHE_TTL.EXTRA_LONG,
    );

    return brands;
  }

  async getFeaturedProducts(limit: number = 10): Promise<ProductResponseDto[]> {
    // Try cache first
    const cached = await this.cacheService.get<ProductResponseDto[]>(
      CACHE_KEYS.PRODUCTS_FEATURED,
    );
    if (cached) {
      return cached;
    }

    const products = await this.productModel
      .find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    const result = products.map((product) => this.toProductResponseDto(product));

    // Cache for 30 minutes
    await this.cacheService.set(
      CACHE_KEYS.PRODUCTS_FEATURED,
      result,
      CACHE_TTL.LONG,
    );

    return result;
  }

  async searchProducts(
    query: string,
    limit: number = 20,
  ): Promise<ProductResponseDto[]> {
    const products = await this.productModel
      .find(
        { $text: { $search: query }, isActive: true },
        { score: { $meta: 'textScore' } },
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .exec();

    return products.map((product) => this.toProductResponseDto(product));
  }

  async getProductsByCategory(
    category: string,
    limit: number = 20,
  ): Promise<ProductResponseDto[]> {
    const products = await this.productModel
      .find({ category, isActive: true })
      .sort({ rating: -1, soldCount: -1 })
      .limit(limit)
      .exec();

    return products.map((product) => this.toProductResponseDto(product));
  }

  async updateRating(
    id: string,
    newRating: number,
    newReviewCount: number,
  ): Promise<ProductResponseDto> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(
        id,
        { rating: newRating, reviewCount: newReviewCount },
        { new: true },
      )
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException('Product not found');
    }

    return this.toProductResponseDto(updatedProduct);
  }

  // Event publishing methods
  private async publishProductCreatedEvent(product: ProductDocument): Promise<void> {
    const event: ProductCreatedEvent = {
      productId: product._id.toString(),
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      createdAt: product.createdAt,
    };

    this.clientKafka.emit('product.created', {
      key: product._id.toString(),
      value: JSON.stringify(event),
      headers: { eventType: 'ProductCreated' },
    });
  }

  private async publishProductUpdatedEvent(product: ProductDocument): Promise<void> {
    const event: ProductUpdatedEvent = {
      productId: product._id.toString(),
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      updatedAt: product.updatedAt,
    };

    this.clientKafka.emit('product.updated', {
      key: product._id.toString(),
      value: JSON.stringify(event),
      headers: { eventType: 'ProductUpdated' },
    });
  }

  private async publishProductDeletedEvent(product: ProductDocument): Promise<void> {
    const event: ProductDeletedEvent = {
      productId: product._id.toString(),
      deletedAt: new Date(),
    };

    this.clientKafka.emit('product.deleted', {
      key: product._id.toString(),
      value: JSON.stringify(event),
      headers: { eventType: 'ProductDeleted' },
    });
  }

  private async publishStockUpdatedEvent(
    product: ProductDocument,
    previousStock: number,
    reason: 'sale' | 'restock' | 'adjustment' | 'order_cancelled',
  ): Promise<void> {
    const event: StockUpdatedEvent = {
      productId: product._id.toString(),
      previousStock,
      newStock: product.stock,
      reason,
      updatedAt: new Date(),
    };

    this.clientKafka.emit('stock.updated', {
      key: product._id.toString(),
      value: JSON.stringify(event),
      headers: { eventType: 'StockUpdated' },
    });
  }

  // Event handlers
  async handleOrderCreated(message: any): Promise<void> {
    try {
      const event: OrderPlacedEvent = JSON.parse(message.value.toString());

      this.logger.log('Order created event received:', event.orderId);
      // Update stock for each item in the order
      for (const item of event.items) {
        await this.updateStock(item.productId, -item.quantity);
      }
    } catch (error) {
      this.logger.error('Error handling order placed event:', error);
    }
  }

  async handleOrderCancelled(message: any): Promise<void> {
    try {
      const event: OrderCancelledEvent = JSON.parse(message.value.toString());

      // Get order details to restore stock (this would need to be enhanced)
      // For now, we'll assume we need to get the order items from the event or database
      // This is a simplified implementation - in production, you'd want to store order items
      this.logger.log('Order cancelled event received:', event.orderId);
      // TODO: Implement stock restoration logic
    } catch (error) {
      this.logger.error('Error handling order cancelled event:', error);
    }
  }

  private toProductResponseDto(product: ProductDocument): ProductResponseDto {
    return {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.category,
      subcategory: product.subcategory,
      brand: product.brand,
      stock: product.stock,
      minStockLevel: product.minStockLevel,
      images: product.images || [],
      thumbnail: product.thumbnail,
      tags: product.tags || [],
      rating: product.rating,
      reviewCount: product.reviewCount,
      specifications: product.specifications
        ? JSON.stringify(product.specifications)
        : undefined,
      dimensions: product.dimensions
        ? JSON.stringify(product.dimensions)
        : undefined,
      weight: product.weight,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      variants: product.variants || [],
      discountPercentage: product.discountPercentage,
      discountExpiresAt: product.discountExpiresAt,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      shippingCost: product.shippingCost,
      estimatedDelivery: product.estimatedDelivery,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  getHello(): string {
    return 'Hello World!';
  }
}
