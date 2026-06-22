import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from './inventory.entity';
import { InventoryStatus, StockMovementType } from './inventory.enum';
import { StockMovement, StockMovementDocument } from './stock-movement.entity';
import {
  InventoryType,
  StockMovementRecord,
  InventoryFilters,
  StockMovementFilters,
  InventorySummary,
  StockMovementSummary,
  StockCheckResult,
} from './inventory.types';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
  ) {}

  async findById(id: string): Promise<InventoryDocument | null> {
    return this.inventoryModel.findById(id);
  }

  async findOne(filters: Partial<Inventory>): Promise<InventoryDocument | null> {
    return this.inventoryModel.findOne(filters);
  }

  async create(data: Partial<Inventory>): Promise<InventoryDocument> {
    const inventory = new this.inventoryModel(data);
    return inventory.save();
  }

  async findByIdAndDelete(id: string): Promise<InventoryDocument | null> {
    return this.inventoryModel.findByIdAndDelete(id);
  }

  async findByProductId(productId: string): Promise<InventoryType | null> {
    const inventory = await this.findOne({ productId });
    return inventory ? this.mapToInventoryType(inventory) : null;
  }

  async getInventoryList(
    filters?: InventoryFilters,
    limit = 20,
    offset = 0,
    sortBy = 'updatedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[InventoryDocument[], number]> {
    const query = this.buildInventoryQuery(filters);
    const sort = [[sortBy, sortOrder === 'DESC' ? -1 : 1]] as [string, 1 | -1][];

    return Promise.all([
      this.inventoryModel
        .find(query)
        .sort(sort as any)
        .skip(offset)
        .limit(limit)
        .exec(),
      this.inventoryModel.countDocuments(query).exec(),
    ]);
  }

  async checkStock(productId: string, quantity: number): Promise<StockCheckResult> {
    const doc = await this.findOne({ productId });
    if (!doc) {
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
    const inventory = Object.assign(new Inventory(), doc.toObject());
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

  async getSummary(): Promise<InventorySummary[]> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$quantity', '$reorderPoint'] }, { $eq: ['$isActive', true] }] },
                1,
                0,
              ],
            },
          },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $lte: ['$quantity', '$reorderPoint'] }, { $eq: ['$isActive', true] }] },
                1,
                0,
              ],
            },
          },
          outOfStock: {
            $sum: {
              $cond: [
                { $and: [{ $lte: ['$quantity', 0] }, { $eq: ['$isActive', true] }] },
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

    return this.inventoryModel.aggregate(pipeline);
  }

  buildInventoryQuery(filters?: InventoryFilters): any {
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

  async getStockMovements(
    filters?: StockMovementFilters,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<[StockMovementDocument[], number]> {
    const query = this.buildStockMovementQuery(filters);
    const sort = [[sortBy, sortOrder === 'DESC' ? -1 : 1]] as [string, 1 | -1][];

    return Promise.all([
      this.stockMovementModel
        .find(query)
        .sort(sort as any)
        .skip(offset)
        .limit(limit)
        .exec(),
      this.stockMovementModel.countDocuments(query).exec(),
    ]);
  }

  async getStockMovementSummary(
    productId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<StockMovementSummary[]> {
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

    return this.stockMovementModel.aggregate(pipeline);
  }

  async createStockMovement(data: Partial<StockMovement>): Promise<StockMovementDocument> {
    const movement = new this.stockMovementModel(data);
    return movement.save();
  }

  mapToInventoryType(doc: InventoryDocument): InventoryType {
    const inventory = Object.assign(new Inventory(), doc.toObject());
    return {
      _id: inventory._id.toString(),
      productId: inventory.productId,
      sku: inventory.sku,
      productName: inventory.productName,
      productDetails: inventory.productDetails,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: inventory.availableQuantity,
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
      needsReorder: inventory.needsReorder,
      isOverstocked: inventory.isOverstocked,
      isUnderstocked: inventory.isUnderstocked,
    };
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

  mapToStockMovementRecord(doc: StockMovementDocument): StockMovementRecord {
    const movement = Object.assign(new StockMovement(), doc.toObject());
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
      quantityChange: movement.quantityChange,
      isInbound: movement.isInbound,
      isOutbound: movement.isOutbound,
      movementDescription: movement.movementDescription,
    };
  }
}