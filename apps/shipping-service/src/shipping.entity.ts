import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Field, ID, ObjectType, Float, registerEnumType } from '@nestjs/graphql';

export enum ShippingStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  FAILED = 'FAILED',
}

registerEnumType(ShippingStatus, {
  name: 'ShippingStatus',
  description: 'Current status of the shipment',
});

@ObjectType()
@Entity({ name: 'shipments' })
export class Shipment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  orderId: string;

  @Field(() => String)
  @Column({ default: ShippingStatus.PENDING })
  status: ShippingStatus;

  @Field({ nullable: true })
  @Column({ nullable: true })
  carrier?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  trackingNumber?: string;

  @Field({ nullable: true })
  @Column({ nullable: true, type: 'timestamp' })
  shippedAt?: Date;

  @Field({ nullable: true })
  @Column({ nullable: true, type: 'timestamp' })
  estimatedDelivery?: Date;

  @Field({ nullable: true })
  @Column({ nullable: true, type: 'timestamp' })
  deliveredAt?: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  customerName?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  customerPhone?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  shippingAddress?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', nullable: true })
  shippingCost?: number;

  // Store any additional metadata as JSON string
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @Field()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Field(() => Boolean)
  get isActive(): boolean {
    return [ShippingStatus.PENDING, ShippingStatus.READY, ShippingStatus.IN_TRANSIT].includes(this.status);
  }

  @Field(() => Boolean)
  get isComplete(): boolean {
    return [ShippingStatus.DELIVERED, ShippingStatus.CANCELLED, ShippingStatus.RETURNED, ShippingStatus.FAILED].includes(this.status);
  }
}
