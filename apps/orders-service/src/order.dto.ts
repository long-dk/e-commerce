import { Field, InputType, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, IsObject, IsUUID } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class AddressInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  street: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  city: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  state: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  country: string;
}

@InputType()
export class OrderItemInput {
  @Field()
  @IsUUID()
  productId: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  @IsObject()
  productOptions?: Record<string, any>;
}

@InputType()
export class CreateOrderInput {
  @Field(() => [OrderItemInput])
  @IsNotEmpty()
  items: OrderItemInput[];

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  shippingAddress?: AddressInput;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  billingAddress?: AddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

@InputType()
export class UpdateOrderInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  shippingAddress?: AddressInput;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  billingAddress?: AddressInput;
}

@InputType()
export class OrderFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;
}

@InputType()
export class OrdersInput {
  @Field(() => Int, { defaultValue: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @Field({ nullable: true })
  @IsOptional()
  orderBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  orderDirection?: 'ASC' | 'DESC';

  @Field({ nullable: true })
  @IsOptional()
  filter?: OrderFilterInput;
}