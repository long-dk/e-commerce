import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { Inventory, InventoryDocument, InventoryStatus, StockMovementType } from './inventory.entity';
import { StockMovement, StockMovementDocument } from './stock-movement.entity';
import {
  InventoryType,
  StockMovementRecord,
  CreateInventoryInput,
  UpdateInventoryInput,
  StockAdjustmentInput,
  ReserveStockInput,
  ReleaseStockInput,
  InventoryFilters,
  StockMovementFilters,
  InventorySummary,
  StockMovementSummary,
  PaginatedInventory,
  PaginatedStockMovements,
  StockCheckResult,
  BulkStockCheckResult,
} from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  async findOne(id: string): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }
    return this.mapToInventoryType(inventory);
  }

  async findByProductId(productId: string): Promise<InventoryType | null> {
    const inventory = await this.inventoryModel.findOne({ productId });
    return inventory ? this.mapToInventoryType(inventory) : null;
  }

  async findAll(
    filters?: InventoryFilters,
    limit = 20,
    offset = 0,
    sortBy = 'updatedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedInventory> {
    const query = this.buildInventoryQuery(filters);
    const sort = [[sortBy, sortOrder === 'DESC' ? -1 : 1]] as [string, 1 | -1][];

    const [inventory, totalCount] = await Promise.all([
      this.inventoryModel
        .find(query)
        .sort(sort as any)
        .skip(offset)
        .limit(limit)
        .exec(),
      this.inventoryModel.countDocuments(query).exec(),
    ]);

    const hasMore = offset + limit < totalCount;

    return {
      inventory: inventory.map(item => this.mapToInventoryType(item)),
      totalCount,
      hasMore,
    };
  }

  async create(input: CreateInventoryInput): Promise<InventoryType> {
    // Check if inventory already exists for this product
    const existing = await this.inventoryModel.findOne({ productId: input.productId });
    if (existing) {
      throw new BadRequestException(`Inventory already exists for product ${input.productId}`);
    }

    const inventory = new this.inventoryModel({
      ...input,
      lastStockUpdate: new Date(),
    });

    const saved = await inventory.save();

    // Create initial stock movement if quantity > 0
    if (input.quantity > 0) {
      await this.createStockMovement({
        productId: input.productId,
        inventoryId: saved._id.toString(),
        movementType: StockMovementType.INITIAL_STOCK,
        quantity: input.quantity,
        previousQuantity: 0,
        newQuantity: input.quantity,
        reason: 'Initial inventory setup',
        performedBy: 'system',
      });
    }

    return this.mapToInventoryType(saved);
  }

  async update(id: string, input: UpdateInventoryInput): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    // Update fields
    Object.assign(inventory, input);
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.mapToInventoryType(saved);
  }

  async adjustStock(input: StockAdjustmentInput): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(input.inventoryId);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${input.inventoryId} not found`);
    }

    if (!inventory.isActive || !inventory.trackInventory) {
      throw new BadRequestException('Cannot adjust stock for inactive or non-tracked inventory');
    }

    const previousQuantity = inventory.quantity;
    const newQuantity = previousQuantity + input.quantity;

    if (newQuantity < 0) {
      throw new BadRequestException('Stock adjustment would result in negative quantity');
    }

    // Update inventory
    inventory.quantity = newQuantity;
    inventory.lastStockUpdate = new Date();
    inventory.updatedAt = new Date();

    const saved = await inventory.save();

    // Create stock movement record
    await this.createStockMovement({
      productId: inventory.productId,
      inventoryId: inventory._id.toString(),
      movementType: input.movementType,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: input.reason,
      reference: input.reference,
      referenceType: input.referenceType,
      performedBy: input.performedBy,
      location: input.location,
      notes: input.notes,
      metadata: input.metadata,
    });

    // Check for alerts
    await this.checkAndPublishAlerts(saved);

    return this.mapToInventoryType(saved);
  }

  async reserveStock(input: ReserveStockInput): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(input.inventoryId);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${input.inventoryId} not found`);
    }

    if (!inventory.isActive || !inventory.trackInventory) {
      throw new BadRequestException('Cannot reserve stock for inactive or non-tracked inventory');
    }

    const availableQuantity = inventory.availableQuantity;
    if (availableQuantity < input.quantity) {
      throw new BadRequestException('Insufficient available stock for reservation');
    }

    inventory.reservedQuantity += input.quantity;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();

    // Create stock movement record
    await this.createStockMovement({
      productId: inventory.productId,
      inventoryId: inventory._id.toString(),
      movementType: StockMovementType.RESERVATION,
      quantity: input.quantity,
      previousQuantity: inventory.quantity,
      newQuantity: inventory.quantity,
      reason: 'Stock reservation',
      reference: input.reference,
      referenceType: input.referenceType,
      performedBy: 'system',
      notes: `Reserved ${input.quantity} units`,
    });

    return this.mapToInventoryType(saved);
  }

  async releaseStock(input: ReleaseStockInput): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(input.inventoryId);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${input.inventoryId} not found`);
    }

    if (inventory.reservedQuantity < input.quantity) {
      throw new BadRequestException('Cannot release more stock than is reserved');
    }

    inventory.reservedQuantity -= input.quantity;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();

    // Create stock movement record
    await this.createStockMovement({
      productId: inventory.productId,
      inventoryId: inventory._id.toString(),
      movementType: StockMovementType.RESERVATION_RELEASE,
      quantity: -input.quantity, // Negative because we're releasing
      previousQuantity: inventory.quantity,
      newQuantity: inventory.quantity,
      reason: 'Stock reservation release',
      reference: input.reference,
      performedBy: 'system',
      notes: `Released ${input.quantity} units from reservation`,
    });

    return this.mapToInventoryType(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.inventoryModel.findByIdAndDelete(id);
    return !!result;
  }

  async activate(id: string): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    inventory.isActive = true;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.mapToInventoryType(saved);
  }

  async deactivate(id: string): Promise<InventoryType> {
    const inventory = await this.inventoryModel.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    inventory.isActive = false;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.mapToInventoryType(saved);
  }

  async checkStock(productId: string, quantity: number): Promise<StockCheckResult> {
    const inventory = await this.inventoryModel.findOne({ productId });
    if (!inventory) {
      return {
        productId,
        inventoryId: '',
        requestedQuantity: quantity,
        availableQuantity: 0,
        canFulfill: false,
        status: InventoryStatus.OUT_OF_STOCK,
        message: 'Product not found in inventory',
      };
    }

    const availableQuantity = inventory.availableQuantity;
    const canFulfill = inventory.canFulfillOrder(quantity);

    return {
      productId,
      inventoryId: inventory._id.toString(),
      requestedQuantity: quantity,
      availableQuantity,
      canFulfill,
      status: inventory.status,
      message: canFulfill ? 'Stock available' : `Only ${availableQuantity} units available`,
    };
  }

  async checkBulkStock(productIds: string[], quantities: number[]): Promise<BulkStockCheckResult> {
    if (productIds.length !== quantities.length) {
      throw new BadRequestException('Product IDs and quantities arrays must have the same length');
    }

    const results: StockCheckResult[] = [];
    let availableCount = 0;
    let unavailableCount = 0;

    for (let i = 0; i < productIds.length; i++) {
      const result = await this.checkStock(productIds[i], quantities[i]);
      results.push(result);

      if (result.canFulfill) {
        availableCount++;
      } else {
        unavailableCount++;
      }
    }

    return {
      results,
      allAvailable: unavailableCount === 0,
      availableCount,
      unavailableCount,
    };
  }

  async getSummary(): Promise<InventorySummary> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStock: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', InventoryStatus.IN_STOCK] }, { $eq: ['$isActive', true] }] },
                1,
                0,
              ],
            },
          },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', InventoryStatus.LOW_STOCK] }, { $eq: ['$isActive', true] }] },
                1,
                0,
              ],
            },
          },
          outOfStock: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', InventoryStatus.OUT_OF_STOCK] }, { $eq: ['$isActive', true] }] },
                1,
                0,
              ],
            },
          },
          discontinued: {
            $sum: {
              $cond: [{ $eq: ['$isActive', false] }, 1, 0],
            },
          },
          totalValue: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
          needsReorder: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $lte: ['$quantity', '$reorderPoint'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overstocked: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $gt: ['$quantity', '$maxStock'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          understocked: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $lt: ['$quantity', '$minStock'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const result = await this.inventoryModel.aggregate(pipeline);
    const summary = result[0] || {
      totalProducts: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      discontinued: 0,
      totalValue: 0,
      needsReorder: 0,
      overstocked: 0,
      understocked: 0,
    };

    return summary;
  }

  async getStockMovements(
    filters?: StockMovementFilters,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedStockMovements> {
    const query = this.buildStockMovementQuery(filters);
    const sort = [[sortBy, sortOrder === 'DESC' ? -1 : 1]] as [string, 1 | -1][];

    const [movements, totalCount] = await Promise.all([
      this.stockMovementModel
        .find(query)
        .sort(sort as any)
        .skip(offset)
        .limit(limit)
        .exec(),
      this.stockMovementModel.countDocuments(query).exec(),
    ]);

    const hasMore = offset + limit < totalCount;

    return {
      movements: movements.map(movement => this.mapToStockMovementRecord(movement)),
      totalCount,
      hasMore,
    };
  }

  async getStockMovementSummary(
    productId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<StockMovementSummary> {
    const matchConditions: any = {};

    if (productId) {
      matchConditions.productId = productId;
    }

    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalMovements: { $sum: 1 },
          totalInbound: {
            $sum: {
              $cond: [
                { $in: ['$movementType', [StockMovementType.STOCK_IN, StockMovementType.RETURN, StockMovementType.ADJUSTMENT_IN]] },
                '$quantity',
                0,
              ],
            },
          },
          totalOutbound: {
            $sum: {
              $cond: [
                { $in: ['$movementType', [StockMovementType.STOCK_OUT, StockMovementType.SALE, StockMovementType.ADJUSTMENT_OUT, StockMovementType.DAMAGE]] },
                { $abs: '$quantity' },
                0,
              ],
            },
          },
        },
      },
    ];

    const result = await this.stockMovementModel.aggregate(pipeline);
    const summary = result[0] || {
      totalMovements: 0,
      totalInbound: 0,
      totalOutbound: 0,
    };

    return {
      ...summary,
      netMovement: summary.totalInbound - summary.totalOutbound,
    };
  }

  private async createStockMovement(data: Partial<StockMovement>): Promise<StockMovementDocument> {
    const movement = new this.stockMovementModel(data);
    return movement.save();
  }

  private calculateStatus(quantity: number, reorderPoint: number): InventoryStatus {
    if (quantity <= 0) return InventoryStatus.OUT_OF_STOCK;
    if (quantity <= reorderPoint) return InventoryStatus.LOW_STOCK;
    return InventoryStatus.IN_STOCK;
  }

  private async checkAndPublishAlerts(inventory: InventoryDocument): Promise<void> {
    const availableQuantity = inventory.availableQuantity;

    // Low stock alert
    if (availableQuantity <= inventory.reorderPoint && availableQuantity > 0) {
      await this.pubSub.publish('lowStockAlert', {
        lowStockAlert: this.mapToInventoryType(inventory),
      });
    }

    // Out of stock alert
    if (availableQuantity <= 0) {
      await this.pubSub.publish('outOfStockAlert', {
        outOfStockAlert: this.mapToInventoryType(inventory),
      });
    }

    // Reorder alert
    if (availableQuantity <= inventory.reorderPoint) {
      await this.pubSub.publish('reorderAlert', {
        reorderAlert: this.mapToInventoryType(inventory),
      });
    }
  }

  private buildInventoryQuery(filters?: InventoryFilters): any {
    const query: any = {};

    if (!filters) return query;

    if (filters.productId) query.productId = filters.productId;
    if (filters.sku) query.sku = { $regex: filters.sku, $options: 'i' };
    if (filters.status && filters.status.length > 0) query.status = { $in: filters.status };
    if (filters.categories && filters.categories.length > 0) query.categories = { $in: filters.categories };
    if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
    if (filters.location) query.location = filters.location;
    if (filters.warehouse) query.warehouse = filters.warehouse;
    if (typeof filters.isActive === 'boolean') query.isActive = filters.isActive;
    if (typeof filters.trackInventory === 'boolean') query.trackInventory = filters.trackInventory;

    // Computed field filters
    if (filters.needsReorder) {
      query.$expr = {
        $and: [
          { $eq: ['$isActive', true] },
          { $lte: ['$quantity', '$reorderPoint'] },
        ],
      };
    }

    if (filters.lowStock) {
      query.status = InventoryStatus.LOW_STOCK;
      query.isActive = true;
    }

    if (filters.outOfStock) {
      query.status = InventoryStatus.OUT_OF_STOCK;
      query.isActive = true;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.updatedAt = {};
      if (filters.dateFrom) query.updatedAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.updatedAt.$lte = new Date(filters.dateTo);
    }

    return query;
  }

  private buildStockMovementQuery(filters?: StockMovementFilters): any {
    const query: any = {};

    if (!filters) return query;

    if (filters.productId) query.productId = filters.productId;
    if (filters.inventoryId) query.inventoryId = filters.inventoryId;
    if (filters.movementType && filters.movementType.length > 0) query.movementType = { $in: filters.movementType };
    if (filters.reference) query.reference = filters.reference;
    if (filters.referenceType) query.referenceType = filters.referenceType;
    if (filters.performedBy) query.performedBy = filters.performedBy;

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    return query;
  }

  private mapToInventoryType(inventory: InventoryDocument): InventoryType {
    const availableQuantity = Math.max(0, inventory.quantity - inventory.reservedQuantity);
    const needsReorder = inventory.isActive && inventory.quantity <= inventory.reorderPoint;
    const isOverstocked = inventory.isActive && inventory.quantity > inventory.maxStock;
    const isUnderstocked = inventory.isActive && inventory.quantity < inventory.minStock;

    return {
      _id: inventory._id.toString(),
      productId: inventory.productId,
      sku: inventory.sku,
      productName: inventory.productName,
      productDetails: inventory.productDetails,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity,
      reorderPoint: inventory.reorderPoint,
      maxStock: inventory.maxStock,
      minStock: inventory.minStock,
      status: inventory.status,
      unitCost: inventory.unitCost,
      totalValue: inventory.quantity * inventory.unitCost,
      location: inventory.location,
      warehouse: inventory.warehouse,
      shelf: inventory.shelf,
      bin: inventory.bin,
      dimensions: inventory.dimensions,
      weight: inventory.weight,
      categories: inventory.categories,
      tags: inventory.tags,
      supplierInfo: inventory.supplierInfo,
      isActive: inventory.isActive,
      trackInventory: inventory.trackInventory,
      lastStockUpdate: inventory.lastStockUpdate,
      lastReorderDate: inventory.lastReorderDate,
      metadata: inventory.metadata,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
      needsReorder,
      isOverstocked,
      isUnderstocked,
    };
  }

  private mapToStockMovementRecord(movement: StockMovementDocument): StockMovementRecord {
    return {
      _id: movement._id.toString(),
      productId: movement.productId,
      inventoryId: movement.inventoryId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      previousQuantity: movement.previousQuantity,
      newQuantity: movement.newQuantity,
      reference: movement.reference,
      referenceType: movement.referenceType,
      reason: movement.reason,
      performedBy: movement.performedBy,
      location: movement.location,
      notes: movement.notes,
      metadata: movement.metadata,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt,
      quantityChange: movement.quantity,
      isInbound: movement.quantity > 0,
      isOutbound: movement.quantity < 0,
      movementDescription: this.getMovementDescription(movement),
    };
  }

  private getMovementDescription(movement: StockMovementDocument): string {
    const typeDescriptions = {
      [StockMovementType.STOCK_IN]: 'Stock received',
      [StockMovementType.STOCK_OUT]: 'Stock removed',
      [StockMovementType.SALE]: 'Sale',
      [StockMovementType.RETURN]: 'Return',
      [StockMovementType.ADJUSTMENT_IN]: 'Stock adjustment (increase)',
      [StockMovementType.ADJUSTMENT_OUT]: 'Stock adjustment (decrease)',
      [StockMovementType.DAMAGE]: 'Damaged stock',
      [StockMovementType.LOSS]: 'Lost stock',
      [StockMovementType.RESERVATION]: 'Stock reserved',
      [StockMovementType.RESERVATION_RELEASE]: 'Reservation released',
      [StockMovementType.INITIAL_STOCK]: 'Initial stock',
    };

    return typeDescriptions[movement.movementType] || 'Stock movement';
  }
}