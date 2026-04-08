import { Field, ObjectType, ID, InputType, Float, PartialType } from '@nestjs/graphql';
import { Payment, PaymentMethod, Currency } from './payment.entity';
import { PaymentStatus } from '@app/dto';

@ObjectType()
export class PaymentType {
  @Field(() => ID)
  id: string;

  @Field()
  orderId: string;

  @Field()
  userId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Currency)
  currency: Currency;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  gatewayTransactionId?: string;

  @Field({ nullable: true })
  paymentGateway?: string;

  @Field(() => Float)
  refundedAmount: number;

  @Field({ nullable: true })
  failureReason?: string;

  @Field({ nullable: true })
  refundReason?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field({ nullable: true })
  refundedAt?: Date;

  // Computed fields
  @Field(() => Float)
  get remainingAmount(): number {
    return this.amount - this.refundedAmount;
  }

  @Field(() => Boolean)
  get canProcess(): boolean {
    return this.status === PaymentStatus.PENDING;
  }

  @Field(() => Boolean)
  get canRefund(): boolean {
    return [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED].includes(this.status);
  }

  @Field(() => Boolean)
  get canCancel(): boolean {
    return [PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(this.status);
  }
}

@InputType()
export class CreatePaymentInput {
  @Field()
  orderId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Currency, { defaultValue: Currency.USD })
  currency: Currency;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field({ nullable: true })
  paymentGateway?: string;

  @Field({ nullable: true })
  paymentData?: string; // Encrypted payment method details
}

@InputType()
export class ProcessPaymentInput {
  @Field()
  paymentId: string;

  @Field({ nullable: true })
  gatewayTransactionId?: string;

  @Field({ nullable: true })
  gatewayResponse?: string;
}

@InputType()
export class RefundPaymentInput {
  @Field()
  paymentId: string;

  @Field(() => Float, { nullable: true })
  amount?: number; // If not provided, full refund

  @Field({ nullable: true })
  reason?: string;
}

@InputType()
export class PaymentFilters {
  @Field({ nullable: true })
  orderId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field(() => [PaymentStatus], { nullable: true })
  status?: PaymentStatus[];

  @Field(() => [PaymentMethod], { nullable: true })
  paymentMethod?: PaymentMethod[];

  @Field({ nullable: true })
  paymentGateway?: string;

  @Field({ nullable: true })
  dateFrom?: string;

  @Field({ nullable: true })
  dateTo?: string;
}

@ObjectType()
export class PaymentSummary {
  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  totalRefunded: number;

  @Field()
  totalPayments: number;

  @Field()
  successfulPayments: number;

  @Field()
  failedPayments: number;

  @Field()
  pendingPayments: number;
}

@ObjectType()
export class PaginatedPayments {
  @Field(() => [PaymentType])
  payments: PaymentType[];

  @Field()
  totalCount: number;

  @Field()
  hasMore: boolean;
}