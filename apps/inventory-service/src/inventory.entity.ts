import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, Float, Int } from '@nestjs/graphql';

export type InventoryDocument = Inventory & Document;

export enum InventoryStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED',
  BACKORDERED = 'BACKORDERED'
}

export enum StockMovementType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  RESERVATION = 'RESERVATION',
  RESERVATION_RELEASE = 'RESERVATION_RELEASE',
  INITIAL_STOCK = 'INITIAL_STOCK',
  TRANSFER = 'TRANSFER',
}

@Schema({ timestamps: true })
@ObjectType()
export class Inventory {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true, unique: true })
  @Field()
  productId: string;

  @Prop({ required: true })
  @Field()
  sku: string;

  @Prop({ required: true })
  @Field()
  productName: string;

  @Prop({ type: Object })
  @Field(() => String, { nullable: true })
  productDetails?: string;

  @Prop({ default: 0 })
  @Field(() => Float)
  quantity: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  reservedQuantity: number;

  @Prop({ default: 10 })
  @Field(() => Float)
  reorderPoint: number;

  @Prop({ default: 1000 })
  @Field(() => Float)
  maxStock: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  minStock: number;

  @Prop({ required: true, default: 0 })
  @Field(() => Float)
  unitCost: number;

  @Prop({ type: String })
  @Field({ nullable: true })
  location?: string;

  @Prop({ type: String })
  @Field({ nullable: true })
  warehouse?: string;

  @Prop({ type: String })
  @Field({ nullable: true })
  shelf?: string;

  @Prop({ type: String })
  @Field({ nullable: true })
  bin?: string;

  @Prop({ type: Object })
  @Field(() => String, { nullable: true })
  dimensions?: string;

  @Prop({ default: 0 })
  @Field(() => Float)
  weight: number;

  @Prop({ type: [String] })
  @Field(() => [String])
  categories: string[];

  @Prop({ type: [String] })
  @Field(() => [String])
  tags: string[];

  @Prop({ type: Object })
  @Field(() => String, { nullable: true })
  supplierInfo?: string;

  @Prop({ default: true })
  @Field()
  isActive: boolean;

  @Prop({ default: false })
  @Field()
  trackInventory: boolean;

  @Prop({ type: Date })
  @Field({ nullable: true })
  lastStockUpdate?: Date;

  @Prop({ type: Date })
  @Field({ nullable: true })
  lastReorderDate?: Date;

  @Prop({ type: Object })
  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Float)
  get availableQuantity(): number {
    return Math.max(0, this.quantity - this.reservedQuantity);
  }

  @Field(() => InventoryStatus)
  get status(): InventoryStatus {
    if (!this.isActive) return InventoryStatus.DISCONTINUED;
    if (this.quantity <= 0) return InventoryStatus.OUT_OF_STOCK;
    if (this.quantity <= this.reorderPoint) return InventoryStatus.LOW_STOCK;
    return InventoryStatus.IN_STOCK;
  }

  @Field(() => Float)
  get totalValue(): number {
    return this.quantity * this.unitCost;
  }

  @Field(() => Boolean)
  get needsReorder(): boolean {
    return this.quantity <= this.reorderPoint && this.isActive;
  }

  @Field(() => Boolean)
  get isOverstocked(): boolean {
    return this.maxStock > 0 && this.quantity > this.maxStock;
  }

  @Field(() => Boolean)
  get isUnderstocked(): boolean {
    return this.quantity < this.minStock;
  }

  // Business logic methods
  canFulfillOrder(quantity: number): boolean {
    return this.availableQuantity >= quantity && this.isActive;
  }

  reserveStock(quantity: number): boolean {
    if (this.availableQuantity >= quantity) {
      this.reservedQuantity += quantity;
      return true;
    }
    return false;
  }

  releaseStock(quantity: number): void {
    this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  }

  updateStock(quantity: number, movementType: StockMovementType, reference?: string): void {
    const oldQuantity = this.quantity;
    this.quantity = Math.max(0, this.quantity + quantity);
    this.reservedQuantity = Math.min(this.reservedQuantity, this.quantity);
    this.lastStockUpdate = new Date();

    // Update status based on new quantity
    // The getter will handle this automatically
  }

  setReorderPoint(point: number): void {
    this.reorderPoint = Math.max(0, point);
  }

  setStockLimits(min: number, max: number): void {
    this.minStock = Math.max(0, min);
    this.maxStock = Math.max(min, max);
  }
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// Indexes for performance
InventorySchema.index({ productId: 1 }, { unique: true });
InventorySchema.index({ sku: 1 }, { unique: true });
InventorySchema.index({ status: 1 });
InventorySchema.index({ categories: 1 });
InventorySchema.index({ location: 1 });
InventorySchema.index({ quantity: 1 });
InventorySchema.index({ availableQuantity: 1 });
InventorySchema.index({ lastStockUpdate: -1 });
InventorySchema.index({ isActive: 1, trackInventory: 1 });