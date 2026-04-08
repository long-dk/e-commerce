import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Field, ObjectType, ID, Float, registerEnumType } from '@nestjs/graphql';
import { PaymentStatus } from '@app/dto';

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CAD = 'CAD',
  AUD = 'AUD'
}

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
});

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
});

registerEnumType(Currency, {
  name: 'Currency',
});

@Entity('payments')
@ObjectType()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column('uuid')
  @Index()
  @Field()
  orderId: string;

  @Column('uuid')
  @Index()
  @Field()
  userId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @Field(() => Float)
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD
  })
  @Field(() => Currency)
  currency: Currency;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod
  })
  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  @Field({ nullable: true })
  transactionId?: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  gatewayTransactionId?: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  paymentGateway?: string;

  @Column('json', { nullable: true })
  @Field(() => String, { nullable: true })
  paymentData?: string; // Encrypted payment method details

  @Column('json', { nullable: true })
  @Field(() => String, { nullable: true })
  gatewayResponse?: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  @Field(() => Float)
  refundedAmount: number;

  @Column({ nullable: true })
  @Field({ nullable: true })
  failureReason?: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  refundReason?: string;

  @CreateDateColumn()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @Field()
  updatedAt: Date;

  @Column({ nullable: true })
  @Field({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  @Field({ nullable: true })
  refundedAt?: Date;

  // Business logic methods
  canProcess(): boolean {
    return this.status === PaymentStatus.PENDING;
  }

  canRefund(): boolean {
    return [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED].includes(this.status);
  }

  canCancel(): boolean {
    return [PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(this.status);
  }

  isCompleted(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === PaymentStatus.FAILED;
  }

  isRefunded(): boolean {
    return this.status === PaymentStatus.REFUNDED;
  }

  getRemainingAmount(): number {
    return this.amount - this.refundedAmount;
  }

  canRefundAmount(amount: number): boolean {
    return this.canRefund() && this.getRemainingAmount() >= amount;
  }
}