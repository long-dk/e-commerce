import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Field, ObjectType, ID, Float } from '@nestjs/graphql';
import { StockMovementType } from './inventory.entity';

export type StockMovementDocument = StockMovement & Document;

@Schema({ timestamps: true })
@ObjectType()
export class StockMovement {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  @Field()
  productId: string;

  @Prop({ required: true })
  @Field()
  inventoryId: string;

  @Prop({
    type: String,
    enum: StockMovementType,
    required: true
  })
  @Field(() => StockMovementType)
  movementType: StockMovementType;

  @Prop({ required: true })
  @Field(() => Float)
  quantity: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  previousQuantity: number;

  @Prop({ default: 0 })
  @Field(() => Float)
  newQuantity: number;

  @Prop({ type: String })
  @Field({ nullable: true })
  reference?: string; // Order ID, Transfer ID, etc.

  @Prop({ type: String })
  @Field({ nullable: true })
  referenceType?: string; // 'order', 'transfer', 'adjustment', etc.

  @Prop({ type: String })
  @Field({ nullable: true })
  reason?: string;

  @Prop({ type: String })
  @Field({ nullable: true })
  performedBy?: string; // User ID who performed the action

  @Prop({ type: String })
  @Field({ nullable: true })
  location?: string;

  @Prop({ type: String })
  @Field({ nullable: true })
  notes?: string;

  @Prop({ type: Object })
  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Float)
  get quantityChange(): number {
    return this.newQuantity - this.previousQuantity;
  }

  @Field(() => Boolean)
  get isInbound(): boolean {
    return [StockMovementType.STOCK_IN, StockMovementType.RETURN, StockMovementType.TRANSFER].includes(this.movementType) && this.quantity > 0;
  }

  @Field(() => Boolean)
  get isOutbound(): boolean {
    return [StockMovementType.STOCK_OUT, StockMovementType.SALE, StockMovementType.DAMAGE, StockMovementType.LOSS].includes(this.movementType) && this.quantity < 0;
  }

  @Field(() => String)
  get movementDescription(): string {
    const sign = this.quantity >= 0 ? '+' : '';
    return `${this.movementType}: ${sign}${this.quantity}`;
  }
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

// Indexes for performance
StockMovementSchema.index({ productId: 1, createdAt: -1 });
StockMovementSchema.index({ inventoryId: 1, createdAt: -1 });
StockMovementSchema.index({ movementType: 1 });
StockMovementSchema.index({ reference: 1 });
StockMovementSchema.index({ performedBy: 1 });
StockMovementSchema.index({ createdAt: -1 });