import { Field, ObjectType, ID, Float, Int, registerEnumType } from '@nestjs/graphql';
import { OrderStatus } from './order.entity';
import { GraphQLJSONObject } from 'graphql-type-json';
import { PaymentStatus } from '@app/dto';

registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Order status enumeration',
});

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
  description: 'Payment status enumeration',
});

@ObjectType()
export class Address {
  @Field()
  street: string;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  zipCode: string;

  @Field()
  country: string;
}

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field()
  productName: string;

  @Field({ nullable: true })
  productSku?: string;

  @Field({ nullable: true })
  productDescription?: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float, { nullable: true })
  discount?: number;

  @Field(() => Float)
  total: number;

  @Field({ nullable: true })
  productImage?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  productOptions?: Record<string, any>;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float, { defaultValue: 0 })
  taxAmount: number;

  @Field(() => Float, { defaultValue: 0 })
  shippingAmount: number;

  @Field(() => Float, { defaultValue: 0 })
  discountAmount: number;

  @Field(() => Float)
  subtotal: number;

  @Field(() => Int)
  totalItems: number;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => PaymentStatus)
  paymentStatus: PaymentStatus;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Address, { nullable: true })
  shippingAddress?: Address;

  @Field(() => Address, { nullable: true })
  billingAddress?: Address;

  @Field({ nullable: true })
  paymentMethod?: string;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  shippedAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field({ nullable: true })
  carrier?: string;

  @Field(() => [OrderItem])
  items: OrderItem[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Computed fields
  @Field(() => Boolean)
  canCancel: boolean;

  @Field(() => Boolean)
  canShip: boolean;

  @Field(() => Boolean)
  canDeliver: boolean;
}