import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { PaymentService } from './payment.service';
import {
  PaymentType,
  CreatePaymentInput,
  ProcessPaymentInput,
  RefundPaymentInput,
  PaymentFilters,
  PaymentSummary,
  PaginatedPayments
} from './payment.types';
import {
  CreatePaymentDto,
  ProcessPaymentDto,
  RefundPaymentDto,
  CancelPaymentDto,
  PaymentFiltersDto,
  PaginationInput
} from './payment.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@app/common';

@Resolver(() => PaymentType)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Query(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async payment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<PaymentType> {
    return this.paymentService.findOne(id, user.id);
  }

  @Query(() => PaginatedPayments)
  @UseGuards(JwtAuthGuard)
  async payments(
    @CurrentUser() user?: any,
    @Args('filters', { nullable: true }) filters?: PaymentFiltersDto,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<PaginatedPayments> {
    if (!user) throw new Error('User not authenticated');
    return this.paymentService.findAll(filters, pagination, user.id);
  }

  @Query(() => PaymentSummary)
  @UseGuards(JwtAuthGuard)
  async paymentSummary(
    @CurrentUser() user?: any,
    @Args('filters', { nullable: true }) filters?: PaymentFiltersDto,
  ): Promise<PaymentSummary> {
    if (!user) throw new Error('User not authenticated');
    return this.paymentService.getSummary(filters, user.id);
  }

  @Query(() => [PaymentType])
  @UseGuards(JwtAuthGuard)
  async paymentsByOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentUser() user: any,
  ): Promise<PaymentType[]> {
    return this.paymentService.findByOrder(orderId, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async createPayment(
    @Args('input') input: CreatePaymentDto,
    @CurrentUser() user: any,
  ): Promise<PaymentType> {
    return this.paymentService.create(input, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async processPayment(
    @Args('input') input: ProcessPaymentDto,
    @CurrentUser() user: any,
  ): Promise<PaymentType> {
    return this.paymentService.processPayment(input.paymentId, input, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async completePayment(
    @CurrentUser() user: any,
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @Args('transactionId', { nullable: true }) transactionId?: string,
  ): Promise<PaymentType> {
    return this.paymentService.completePayment(paymentId, transactionId, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async failPayment(
    @CurrentUser() user: any,
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<PaymentType> {
    return this.paymentService.failPayment(paymentId, reason, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async refundPayment(
    @Args('input') input: RefundPaymentDto,
    @CurrentUser() user: any,
  ): Promise<PaymentType> {
    return this.paymentService.refundPayment(input.paymentId, input.amount, input.reason, user.id);
  }

  @Mutation(() => PaymentType)
  @UseGuards(JwtAuthGuard)
  async cancelPayment(
    @Args('input') input: CancelPaymentDto,
    @CurrentUser() user: any,
  ): Promise<PaymentType> {
    return this.paymentService.cancelPayment(input.paymentId, input.reason, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async retryPayment(
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    return this.paymentService.retryPayment(paymentId, user.id);
  }
}