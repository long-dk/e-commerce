import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
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
import { JwtAuthGuard } from '../../../libs/shared/src/auth/jwt-auth.guard';

@Resolver(() => InventoryType)
export class InventoryResolver {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @Query(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async inventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    return this.inventoryService.findInventoryById(id);
  }

  @Query(() => PaginatedInventory)
  @UseGuards(JwtAuthGuard)
  async inventoryList(
    @Args('filters', { nullable: true }) filters?: InventoryFilters,
    @Args('limit', { defaultValue: 20 }) limit?: number,
    @Args('offset', { defaultValue: 0 }) offset?: number,
    @Args('sortBy', { defaultValue: 'updatedAt' }) sortBy?: string,
    @Args('sortOrder', { defaultValue: 'DESC' }) sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedInventory> {
    return this.inventoryService.getInventoryList(filters, limit, offset, sortBy, sortOrder);
  }

  @Query(() => InventorySummary)
  @UseGuards(JwtAuthGuard)
  async inventorySummary(): Promise<InventorySummary> {
    return this.inventoryService.getSummary();
  }

  @Query(() => StockCheckResult)
  @UseGuards(JwtAuthGuard)
  async checkStock(
    @Args('productId') productId: string,
    @Args('quantity', { type: () => Number }) quantity: number,
  ): Promise<StockCheckResult> {
    return this.inventoryService.checkStock(productId, quantity);
  }

  @Query(() => BulkStockCheckResult)
  @UseGuards(JwtAuthGuard)
  async checkBulkStock(
    @Args('items', { type: () => [String] }) productIds: string[],
    @Args('quantities', { type: () => [Number] }) quantities: number[],
  ): Promise<BulkStockCheckResult> {
    return this.inventoryService.checkBulkStock(productIds, quantities);
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async createInventory(
    @Args('input') input: CreateInventoryInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.create(input);

    this.inventoryService.emitInventoryCreatedEvent(inventory);

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async updateInventory(
    @Args('input') input: UpdateInventoryInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.update(input.id, input);
    
    this.inventoryService.emitInventoryUpdatedEvent(inventory);
    
    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async adjustStock(
    @Args('input') input: StockAdjustmentInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.adjustStock(input);

    this.inventoryService.emitInventoryUpdatedEvent(inventory);

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async reserveStock(
    @Args('input') input: ReserveStockInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.reserveStock(input);

    this.inventoryService.emitInventoryUpdatedEvent(inventory);
    
    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async releaseStock(
    @Args('input') input: ReleaseStockInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.releaseStock(input);

    this.inventoryService.emitInventoryUpdatedEvent(inventory);

    return inventory;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteInventory(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const result = await this.inventoryService.delete(id);

    if (result) {
      this.inventoryService.emitInventoryDeletedEvent(id);
    }

    return result;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async activateInventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    const inventory = await this.inventoryService.activate(id);

    this.inventoryService.emitInventoryUpdatedEvent(inventory);

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async deactivateInventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    const inventory = await this.inventoryService.deactivate(id);

    this.inventoryService.emitInventoryUpdatedEvent(inventory);

    return inventory;
  }

  // Stock Movement Queries
  @Query(() => PaginatedStockMovements)
  @UseGuards(JwtAuthGuard)
  async stockMovements(
    @Args('filters', { nullable: true }) filters?: StockMovementFilters,
    @Args('limit', { defaultValue: 20 }) limit?: number,
    @Args('offset', { defaultValue: 0 }) offset?: number,
    @Args('sortBy', { defaultValue: 'createdAt' }) sortBy?: string,
    @Args('sortOrder', { defaultValue: 'DESC' }) sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedStockMovements> {
    return this.inventoryService.getStockMovements(filters, limit, offset, sortBy, sortOrder);
  }

  @Query(() => StockMovementSummary)
  @UseGuards(JwtAuthGuard)
  async stockMovementSummary(
    @Args('productId', { nullable: true }) productId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
  ): Promise<StockMovementSummary> {
    return this.inventoryService.getStockMovementSummary(productId, dateFrom, dateTo);
  }
}