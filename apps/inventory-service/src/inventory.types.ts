import { Field, ObjectType, InputType, ID, Float, Int } from '@nestjs/graphql';
import { InventoryStatus, StockMovementType } from './inventory.enum';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';


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

  @Field(() => StockMovementType)
  movementType: StockMovementType;

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
  @IsUUID()
  productId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  sku: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  productName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  productDetails?: string;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  reorderPoint: number;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  maxStock: number;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  minStock: number;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  unitCost: number;

  @Field({ nullable: true })
  @IsOptional()
  location?: string;

  @Field({ nullable: true })
  @IsOptional()
  warehouse?: string;

  @Field({ nullable: true })
  @IsOptional()
  shelf?: string;

  @Field({ nullable: true })
  @IsOptional()
  bin?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  dimensions?: string;

  @Field(() => Float, { defaultValue: 0 })
  @IsNumber()
  @Min(1)
  weight: number;

  @Field(() => [String], { defaultValue: [] })
  @IsNotEmpty()
  categories: string[];

  @Field(() => [String], { defaultValue: [] })
  @IsNotEmpty()
  tags: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  supplierInfo?: string;

  @Field({ defaultValue: true })
  @IsNotEmpty()
  isActive: boolean;

  @Field({ defaultValue: true })
  @IsNotEmpty()
  trackInventory: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  metadata?: string;
}

@InputType()
export class UpdateInventoryInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  productName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  productDetails?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  reorderPoint?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  maxStock?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  minStock?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  unitCost?: number;

  @Field({ nullable: true })
  @IsOptional()
  location?: string;

  @Field({ nullable: true })
  @IsOptional()
  warehouse?: string;

  @Field({ nullable: true })
  @IsOptional()
  shelf?: string;

  @Field({ nullable: true })
  @IsOptional()
  bin?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  dimensions?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  weight?: number;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  categories?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  tags?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  supplierInfo?: string;

  @Field({ nullable: true })
  @IsOptional()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  trackInventory?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  metadata?: string;
}

@InputType()
export class StockAdjustmentInput {
  @Field(() => ID)
  @IsUUID()
  inventoryId: string;

  @Field(() => Float)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Field(() => StockMovementType)
  @IsNotEmpty()
  movementType: StockMovementType;

  @Field({ nullable: true })
  @IsOptional()
  reason?: string;

  @Field({ nullable: true })
  @IsOptional()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  referenceType?: string;

  @Field({ nullable: true })
  @IsOptional()
  performedBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  location?: string;

  @Field({ nullable: true })
  @IsOptional()
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  metadata?: string;
}

@InputType()
export class ReserveStockInput {
  @Field(() => ID)
  @IsUUID()
  inventoryId: string;

  @Field(() => Float)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Field({ nullable: true })
  @IsOptional()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  referenceType?: string;
}

@InputType()
export class ReleaseStockInput {
  @Field(() => ID)
  @IsUUID()
  inventoryId: string;

  @Field(() => Float)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Field({ nullable: true })
  @IsOptional()
  reference?: string;
}

@InputType()
export class InventoryFilters {
  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @Field({ nullable: true })
  @IsOptional()
  sku?: string;

  @Field(() => [InventoryStatus], { nullable: true })
  @IsOptional()
  status?: InventoryStatus[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  categories?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  location?: string;

  @Field({ nullable: true })
  @IsOptional()
  warehouse?: string;

  @Field({ nullable: true })
  @IsOptional()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  trackInventory?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  needsReorder?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  lowStock?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  outOfStock?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  dateFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  dateTo?: string;
}

@InputType()
export class StockMovementFilters {
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field({ nullable: true })
  @IsOptional()
  inventoryId?: string;

  @Field(() => [StockMovementType], { nullable: true })
  @IsOptional()
  movementType?: StockMovementType[];

  @Field({ nullable: true })
  @IsOptional()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  referenceType?: string;

  @Field({ nullable: true })
  @IsOptional()
  performedBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  dateFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
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