import { Field, ObjectType, InputType, ID, Float, Int } from '@nestjs/graphql';
import { ShippingStatus, Shipment } from './shipping.entity';

@ObjectType()
export class ShipmentType extends Shipment {}

@InputType()
export class CreateShipmentInput {
  @Field()
  orderId: string;

  @Field({ nullable: true })
  carrier?: string;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field({ nullable: true })
  customerName?: string;

  @Field({ nullable: true })
  customerPhone?: string;

  @Field({ nullable: true })
  shippingAddress?: string;

  @Field(() => Float, { nullable: true })
  shippingCost?: number;

  @Field(() => String, { nullable: true })
  estimatedDelivery?: Date;

  @Field(() => String, { nullable: true })
  metadata?: string;
}

@InputType()
export class UpdateShipmentInput {
  @Field(() => ID)
  id: string;

  @Field(() => ShippingStatus, { nullable: true })
  status?: ShippingStatus;

  @Field({ nullable: true })
  carrier?: string;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => String, { nullable: true })
  estimatedDelivery?: Date;

  @Field(() => String, { nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  metadata?: string;
}

@InputType()
export class ShipmentFilters {
  @Field({ nullable: true })
  orderId?: string;

  @Field(() => [ShippingStatus], { nullable: true })
  status?: ShippingStatus[];

  @Field({ nullable: true })
  customerName?: string;

  @Field({ nullable: true })
  trackingNumber?: string;
}

@ObjectType()
export class PaginatedShipments {
  @Field(() => [ShipmentType])
  shipments: ShipmentType[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => Boolean)
  hasMore: boolean;
}

@ObjectType()
export class ShipmentSummary {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  inTransit: number;

  @Field(() => Int)
  delivered: number;

  @Field(() => Int)
  cancelled: number;

  @Field(() => Int)
  returned: number;

  @Field(() => Int)
  failed: number;
}
