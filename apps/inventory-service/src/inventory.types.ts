import { Field, ObjectType, InputType, ID, Float, Int, registerEnumType } from '@nestjs/graphql';
import { Inventory, InventoryStatus, StockMovementType as StockMovementTypeEnum } from './inventory.entity';
import { StockMovement } from './stock-movement.entity';

registerEnumType(InventoryStatus, {
  name: 'InventoryStatus',
  description: 'Inventory status enumeration',
});

registerEnumType(StockMovementTypeEnum, {
  name: 'StockMovementTypeEnum',
  description: 'Stock movement type enumeration',
});


@ObjectType()
export class InventoryType {
  @Field(() => ID)
  _id: string;

  @Field()
  productId: string;

  @Field()
  sku: string;

  @Field()
  productName: string;

  @Field(() => String, { nullable: true })
  productDetails?: string;

  @Field(() => Float)
  quantity: number;

  @Field(() => Float)
  reservedQuantity: number;

  @Field(() => Float)
  availableQuantity: number;

  @Field(() => Float)
  reorderPoint: number;

  @Field(() => Float)
  maxStock: number;

  @Field(() => Float)
  minStock: number;

  @Field(() => InventoryStatus)
  status: InventoryStatus;

  @Field(() => Float)
  unitCost: number;

  @Field(() => Float)
  totalValue: number;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  warehouse?: string;

  @Field({ nullable: true })
  shelf?: string;

  @Field({ nullable: true })
  bin?: string;

  @Field(() => String, { nullable: true })
  dimensions?: string;

  @Field(() => Float)
  weight: number;

  @Field(() => [String])
  categories: string[];

  @Field(() => [String])
  tags: string[];

  @Field(() => String, { nullable: true })
  supplierInfo?: string;

  @Field()
  isActive: boolean;

  @Field()
  trackInventory: boolean;

  @Field({ nullable: true })
  lastStockUpdate?: Date;

  @Field({ nullable: true })
  lastReorderDate?: Date;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Boolean)
  needsReorder: boolean;

  @Field(() => Boolean)
  isOverstocked: boolean;

  @Field(() => Boolean)
  isUnderstocked: boolean;
}

@ObjectType()
export class StockMovementRecord {
  @Field(() => ID)
  _id: string;

  @Field()
  productId: string;

  @Field()
  inventoryId: string;

  @Field(() => StockMovementTypeEnum)
  movementType: StockMovementTypeEnum;

  @Field(() => Float)
  quantity: number;

  @Field(() => Float)
  previousQuantity: number;

  @Field(() => Float)
  newQuantity: number;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  referenceType?: string;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  performedBy?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Float)
  quantityChange: number;

  @Field(() => Boolean)
  isInbound: boolean;

  @Field(() => Boolean)
  isOutbound: boolean;

  @Field()
  movementDescription: string;
}

@InputType()
export class CreateInventoryInput {
  @Field()
  productId: string;

  @Field()
  sku: string;

  @Field()
  productName: string;

  @Field(() => String, { nullable: true })
  productDetails?: string;

  @Field(() => Float, { defaultValue: 0 })
  quantity: number;

  @Field(() => Float, { defaultValue: 0 })
  reorderPoint: number;

  @Field(() => Float, { defaultValue: 0 })
  maxStock: number;

  @Field(() => Float, { defaultValue: 0 })
  minStock: number;

  @Field(() => Float, { defaultValue: 0 })
  unitCost: number;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  warehouse?: string;

  @Field({ nullable: true })
  shelf?: string;

  @Field({ nullable: true })
  bin?: string;

  @Field(() => String, { nullable: true })
  dimensions?: string;

  @Field(() => Float, { defaultValue: 0 })
  weight: number;

  @Field(() => [String], { defaultValue: [] })
  categories: string[];

  @Field(() => [String], { defaultValue: [] })
  tags: string[];

  @Field(() => String, { nullable: true })
  supplierInfo?: string;

  @Field({ defaultValue: true })
  isActive: boolean;

  @Field({ defaultValue: true })
  trackInventory: boolean;

  @Field(() => String, { nullable: true })
  metadata?: string;
}

@InputType()
export class UpdateInventoryInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  productName?: string;

  @Field(() => String, { nullable: true })
  productDetails?: string;

  @Field(() => Float, { nullable: true })
  reorderPoint?: number;

  @Field(() => Float, { nullable: true })
  maxStock?: number;

  @Field(() => Float, { nullable: true })
  minStock?: number;

  @Field(() => Float, { nullable: true })
  unitCost?: number;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  warehouse?: string;

  @Field({ nullable: true })
  shelf?: string;

  @Field({ nullable: true })
  bin?: string;

  @Field(() => String, { nullable: true })
  dimensions?: string;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field(() => [String], { nullable: true })
  categories?: string[];

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => String, { nullable: true })
  supplierInfo?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  trackInventory?: boolean;

  @Field(() => String, { nullable: true })
  metadata?: string;
}

@InputType()
export class StockAdjustmentInput {
  @Field(() => ID)
  inventoryId: string;

  @Field(() => Float)
  quantity: number;

  @Field(() => StockMovementTypeEnum)
  movementType: StockMovementTypeEnum;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  referenceType?: string;

  @Field({ nullable: true })
  performedBy?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  metadata?: string;
}

@InputType()
export class ReserveStockInput {
  @Field(() => ID)
  inventoryId: string;

  @Field(() => Float)
  quantity: number;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  referenceType?: string;
}

@InputType()
export class ReleaseStockInput {
  @Field(() => ID)
  inventoryId: string;

  @Field(() => Float)
  quantity: number;

  @Field({ nullable: true })
  reference?: string;
}

@InputType()
export class InventoryFilters {
  @Field({ nullable: true })
  productId?: string;

  @Field({ nullable: true })
  sku?: string;

  @Field(() => [InventoryStatus], { nullable: true })
  status?: InventoryStatus[];

  @Field(() => [String], { nullable: true })
  categories?: string[];

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  warehouse?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  trackInventory?: boolean;

  @Field({ nullable: true })
  needsReorder?: boolean;

  @Field({ nullable: true })
  lowStock?: boolean;

  @Field({ nullable: true })
  outOfStock?: boolean;

  @Field({ nullable: true })
  dateFrom?: string;

  @Field({ nullable: true })
  dateTo?: string;
}

@InputType()
export class StockMovementFilters {
  @Field({ nullable: true })
  productId?: string;

  @Field({ nullable: true })
  inventoryId?: string;

  @Field(() => [StockMovementTypeEnum], { nullable: true })
  movementType?: StockMovementTypeEnum[];

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  referenceType?: string;

  @Field({ nullable: true })
  performedBy?: string;

  @Field({ nullable: true })
  dateFrom?: string;

  @Field({ nullable: true })
  dateTo?: string;
}

@ObjectType()
export class InventorySummary {
  @Field(() => Int)
  totalProducts: number;

  @Field(() => Int)
  inStock: number;

  @Field(() => Int)
  lowStock: number;

  @Field(() => Int)
  outOfStock: number;

  @Field(() => Int)
  discontinued: number;

  @Field(() => Float)
  totalValue: number;

  @Field(() => Int)
  needsReorder: number;

  @Field(() => Int)
  overstocked: number;

  @Field(() => Int)
  understocked: number;
}

@ObjectType()
export class StockMovementSummary {
  @Field(() => Int)
  totalMovements: number;

  @Field(() => Float)
  totalInbound: number;

  @Field(() => Float)
  totalOutbound: number;

  @Field(() => Float)
  netMovement: number;
}

@ObjectType()
export class PaginatedInventory {
  @Field(() => [InventoryType])
  inventory: InventoryType[];

  @Field()
  totalCount: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class PaginatedStockMovements {
  @Field(() => [StockMovementRecord])
  movements: StockMovementRecord[];

  @Field()
  totalCount: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class StockCheckResult {
  @Field()
  productId: string;

  @Field(() => ID)
  inventoryId: string;

  @Field(() => Float)
  requestedQuantity: number;

  @Field(() => Float)
  availableQuantity: number;

  @Field()
  canFulfill: boolean;

  @Field(() => InventoryStatus)
  status: InventoryStatus;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class BulkStockCheckResult {
  @Field(() => [StockCheckResult])
  results: StockCheckResult[];

  @Field()
  allAvailable: boolean;

  @Field(() => Int)
  availableCount: number;

  @Field(() => Int)
  unavailableCount: number;
}