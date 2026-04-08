import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsUUID, Min, IsObject, IsDateString } from 'class-validator';
import { Field, InputType, Float } from '@nestjs/graphql';
import { PaymentMethod, Currency } from './payment.entity';
import { Type } from 'class-transformer';
import { PaymentStatus } from '@app/dto';

@InputType()
export class CreatePaymentDto {
  @Field()
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Field(() => Currency)
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;

  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentGateway?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentData?: string;
}

@InputType()
export class ProcessPaymentDto {
  @Field()
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  gatewayTransactionId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  gatewayResponse?: string;
}

@InputType()
export class RefundPaymentDto {
  @Field()
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class CancelPaymentDto {
  @Field()
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class PaymentFiltersDto {
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field(() => [PaymentStatus], { nullable: true })
  @IsOptional()
  @IsEnum(PaymentStatus, { each: true })
  status?: PaymentStatus[];

  @Field(() => [PaymentMethod], { nullable: true })
  @IsOptional()
  @IsEnum(PaymentMethod, { each: true })
  paymentMethod?: PaymentMethod[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentGateway?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

@InputType()
export class PaginationInput {
  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  skip?: number = 0;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

function Max(max: number) {
  return (target: any, propertyKey: string) => {
    // Custom max validator implementation
  };
}