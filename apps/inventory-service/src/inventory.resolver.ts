import { Resolver, Query, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { InventoryService } from './inventory.service';
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
import { JwtAuthGuard } from '../../../libs/shared/src/auth/jwt-auth.guard';

@Resolver(() => InventoryType)
export class InventoryResolver {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async inventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    return this.inventoryService.findOne(id);
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
    return this.inventoryService.findAll(filters, limit, offset, sortBy, sortOrder);
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

    // Publish real-time update
    await this.pubSub.publish('inventoryCreated', {
      inventoryCreated: inventory,
    });

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async updateInventory(
    @Args('input') input: UpdateInventoryInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.update(input.id, input);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async adjustStock(
    @Args('input') input: StockAdjustmentInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.adjustStock(input);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async reserveStock(
    @Args('input') input: ReserveStockInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.reserveStock(input);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async releaseStock(
    @Args('input') input: ReleaseStockInput,
  ): Promise<InventoryType> {
    const inventory = await this.inventoryService.releaseStock(input);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

    return inventory;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteInventory(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const result = await this.inventoryService.delete(id);

    if (result) {
      // Publish real-time update
      await this.pubSub.publish('inventoryDeleted', {
        inventoryDeleted: id,
      });
    }

    return result;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async activateInventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    const inventory = await this.inventoryService.activate(id);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

    return inventory;
  }

  @Mutation(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  async deactivateInventory(@Args('id', { type: () => ID }) id: string): Promise<InventoryType> {
    const inventory = await this.inventoryService.deactivate(id);

    // Publish real-time update
    await this.pubSub.publish('inventoryUpdated', {
      inventoryUpdated: inventory,
    });

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

  // Real-time Subscriptions
  @Subscription(() => InventoryType, {
    filter: (payload, variables) => {
      if (variables.productId) {
        return payload.inventoryCreated.productId === variables.productId ||
               payload.inventoryUpdated.productId === variables.productId;
      }
      return true;
    },
  })
  @UseGuards(JwtAuthGuard)
  inventoryCreated(
    @Args('productId', { nullable: true }) productId?: string,
  ) {
    return this.pubSub.asyncIterator('inventoryCreated');
  }

  @Subscription(() => InventoryType, {
    filter: (payload, variables) => {
      if (variables.productId) {
        return payload.inventoryUpdated.productId === variables.productId;
      }
      return true;
    },
  })
  @UseGuards(JwtAuthGuard)
  inventoryUpdated(
    @Args('productId', { nullable: true }) productId?: string,
  ) {
    return this.pubSub.asyncIterator('inventoryUpdated');
  }

  @Subscription(() => ID, {
    filter: (payload, variables) => {
      if (variables.productId) {
        // Note: This would require fetching the inventory to check productId
        // For simplicity, we'll emit all deletions and let client filter
        return true;
      }
      return true;
    },
  })
  @UseGuards(JwtAuthGuard)
  inventoryDeleted(
    @Args('productId', { nullable: true }) productId?: string,
  ) {
    return this.pubSub.asyncIterator('inventoryDeleted');
  }

  @Subscription(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  lowStockAlert() {
    return this.pubSub.asyncIterator('lowStockAlert');
  }

  @Subscription(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  outOfStockAlert() {
    return this.pubSub.asyncIterator('outOfStockAlert');
  }

  @Subscription(() => InventoryType)
  @UseGuards(JwtAuthGuard)
  reorderAlert() {
    return this.pubSub.asyncIterator('reorderAlert');
  }
}