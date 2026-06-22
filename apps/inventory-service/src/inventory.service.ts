import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { Inventory, InventoryDocument } from './inventory.entity';
import { StockMovementType } from './inventory.enum';
import {
  InventoryType,
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
import { InventoryRepository } from './inventory.repository';
import { InventoryGateway } from './inventory.gateway';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryGateway: InventoryGateway,
  ) {}

  async findInventoryById(id: string): Promise<InventoryType> {
    try {
      const inventory = await this.inventoryRepository.findById(id);
      if (!inventory) {
        throw new NotFoundException(`Inventory with ID ${id} not found`);
      }

      return this.inventoryRepository.mapToInventoryType(inventory);
    } catch (error) {
      throw new Error(`Inventory with ID ${id} error: ${error}`);
    }
  }

  async findByProductId(productId: string): Promise<InventoryType | null> {
    return await this.inventoryRepository.findByProductId(productId);
  }

  async getInventoryList(
    filters?: InventoryFilters,
    limit = 20,
    offset = 0,
    sortBy = 'updatedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedInventory> {
    const [inventory, totalCount] = await this.inventoryRepository.getInventoryList(filters, limit, offset, sortBy, sortOrder);
    const hasMore = offset + limit < totalCount;

    return {
      inventory: inventory.map(item => this.inventoryRepository.mapToInventoryType(item)),
      totalCount,
      hasMore,
    };
  }

  async create(input: CreateInventoryInput): Promise<InventoryType> {
    // Check if inventory already exists for this product
    const existing = await this.inventoryRepository.findOne({ productId: input.productId });
    if (existing) {
      throw new BadRequestException(`Inventory already exists for product ${input.productId}`);
    }

    const saved =  await this.inventoryRepository.create({
      ...input,
      lastStockUpdate: new Date(),
    });

    // Create initial stock movement if quantity > 0
    if (input.quantity > 0) {
      await this.inventoryRepository.createStockMovement({
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

    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async update(id: string, input: UpdateInventoryInput): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    // Update fields
    Object.assign(inventory, input);
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async adjustStock(input: StockAdjustmentInput): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(input.inventoryId);
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
    await this.inventoryRepository.createStockMovement({
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

    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async reserveStock(input: ReserveStockInput): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(input.inventoryId);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${input.inventoryId} not found`);
    }

    if (!inventory.isActive || !inventory.trackInventory) {
      throw new BadRequestException('Cannot reserve stock for inactive or non-tracked inventory');
    }

    const doc = Object.assign(new Inventory(), inventory.toObject())
    if (doc.availableQuantity < input.quantity) {
      throw new BadRequestException('Insufficient available stock for reservation');
    }

    inventory.reservedQuantity += input.quantity;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();

    // Create stock movement record
    await this.inventoryRepository.createStockMovement({
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

    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async releaseStock(input: ReleaseStockInput): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(input.inventoryId);
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
    await this.inventoryRepository.createStockMovement({
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

    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.inventoryRepository.findByIdAndDelete(id);
    return !!result;
  }

  async activate(id: string): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    inventory.isActive = true;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async deactivate(id: string): Promise<InventoryType> {
    const inventory = await this.inventoryRepository.findById(id);
    if (!inventory) {
      throw new NotFoundException(`Inventory with ID ${id} not found`);
    }

    inventory.isActive = false;
    inventory.updatedAt = new Date();

    const saved = await inventory.save();
    return this.inventoryRepository.mapToInventoryType(saved);
  }

  async checkStock(productId: string, quantity: number): Promise<StockCheckResult> {
    return await this.inventoryRepository.checkStock(productId, quantity);
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
    const res = await this.inventoryRepository.getSummary();
    const summary = res[0] || {
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
    const [movements, totalCount] = await this.inventoryRepository.getStockMovements(filters, limit, offset, sortBy, sortOrder);
    const hasMore = offset + limit < totalCount;

    return {
      movements: movements.map(item => this.inventoryRepository.mapToStockMovementRecord(item)),
      totalCount,
      hasMore,
    };
  }

  async getStockMovementSummary(productId?: string, dateFrom?: string, dateTo?: string): Promise<StockMovementSummary> {
    const res = await this.inventoryRepository.getStockMovementSummary(productId, dateFrom, dateTo);
    const summary = res[0] || {
      totalMovements: 0,
      totalInbound: 0,
      totalOutbound: 0,
    };

    return {
      ...summary,
      netMovement: summary.totalInbound - summary.totalOutbound,
    };
  }

  emitInventoryCreatedEvent(inventory: InventoryType) {
    this.inventoryGateway.broadcastInventoryUpdate('inventoryCreated', inventory);
  }

  emitInventoryUpdatedEvent(inventory: InventoryType) {
    this.inventoryGateway.broadcastInventoryUpdate('inventoryUpdated', inventory);
  }

  emitInventoryDeletedEvent(inventoryId: string) {
    this.inventoryGateway.broadcastInventoryDeletion('inventoryDeleted', inventoryId);
  }

  private async checkAndPublishAlerts(inventory: InventoryDocument): Promise<void> {
    const availableQuantity = inventory.availableQuantity;

    // Low stock alert
    if (availableQuantity <= inventory.reorderPoint && availableQuantity > 0) {
      this.inventoryGateway.broadcastAlert('lowStockAlert', this.inventoryRepository.mapToInventoryType(inventory));
    }

    // Out of stock alert
    if (availableQuantity <= 0) {
      this.inventoryGateway.broadcastAlert('outOfStockAlert', this.inventoryRepository.mapToInventoryType(inventory));
    }

    // Reorder alert
    if (availableQuantity <= inventory.reorderPoint) {
      this.inventoryGateway.broadcastAlert('reorderAlert', this.inventoryRepository.mapToInventoryType(inventory));
    }
  }
}