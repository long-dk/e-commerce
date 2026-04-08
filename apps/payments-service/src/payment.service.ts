import { Injectable, NotFoundException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentMethod, Currency } from './payment.entity';
import {
  PaymentType,
  CreatePaymentInput,
  PaymentFilters,
  PaymentSummary,
  PaginatedPayments
} from './payment.types';
import { CreatePaymentDto, PaymentFiltersDto, PaginationInput } from './payment.dto';
import { Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PaymentGateway } from './payment-gateway.interface';
import { LoggerService } from '@app/common';
import { PaymentStatus } from '@app/dto';

@Injectable()
export class PaymentService implements OnModuleInit, OnModuleDestroy {
  private paymentGateways: Map<string, PaymentGateway> = new Map();

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private dataSource: DataSource,
    @Inject('KAFKA_CLIENT') private kafkaClient: ClientKafka,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async create(input: CreatePaymentDto, userId: string): Promise<PaymentType> {
    // Validate order exists (would typically call Orders Service)
    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: input.orderId, userId }
    });

    if (existingPayment) {
      throw new BadRequestException('Payment already exists for this order');
    }

    const payment = this.paymentRepository.create({
      ...input,
      userId,
      status: PaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Publish payment created event
    this.kafkaClient.emit('payment.created', {
      paymentId: savedPayment.id,
      orderId: savedPayment.orderId,
      userId: savedPayment.userId,
      amount: savedPayment.amount,
      currency: savedPayment.currency,
      paymentMethod: savedPayment.paymentMethod,
    });

    this.logger.log(`Payment created: ${savedPayment.id} for order ${savedPayment.orderId}`);

    return this.toPaymentResponse(savedPayment);
  }

  async findOne(id: string, userId: string): Promise<PaymentType> {
    const payment = await this.paymentRepository.findOne({
      where: { id, userId }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPaymentResponse(payment);
  }

  async findAll(
    filters?: PaymentFiltersDto,
    pagination?: PaginationInput,
    userId?: string,
  ): Promise<PaginatedPayments> {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');

    if (userId) {
      queryBuilder.andWhere('payment.userId = :userId', { userId });
    }

    if (filters) {
      if (filters.orderId) {
        queryBuilder.andWhere('payment.orderId = :orderId', { orderId: filters.orderId });
      }

      if (filters.status && filters.status.length > 0) {
        queryBuilder.andWhere('payment.status IN (:...status)', { status: filters.status });
      }

      if (filters.paymentMethod && filters.paymentMethod.length > 0) {
        queryBuilder.andWhere('payment.paymentMethod IN (:...paymentMethod)', { paymentMethod: filters.paymentMethod });
      }

      if (filters.paymentGateway) {
        queryBuilder.andWhere('payment.paymentGateway = :paymentGateway', { paymentGateway: filters.paymentGateway });
      }

      if (filters.dateFrom) {
        queryBuilder.andWhere('payment.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
      }

      if (filters.dateTo) {
        queryBuilder.andWhere('payment.createdAt <= :dateTo', { dateTo: filters.dateTo });
      }
    }

    const skip = pagination?.skip || 0;
    const take = pagination?.take || 20;

    queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(take + 1); // Take one extra to check if there are more

    const payments = await queryBuilder.getMany();
    const hasMore = payments.length > take;
    const resultPayments = hasMore ? payments.slice(0, take) : payments;

    const totalCount = await queryBuilder.getCount();

    return {
      payments: resultPayments.map(payment => this.toPaymentResponse(payment)),
      totalCount,
      hasMore,
    };
  }

  async findByOrder(orderId: string, userId: string): Promise<PaymentType[]> {
    const payments = await this.paymentRepository.find({
      where: { orderId, userId },
      order: { createdAt: 'DESC' }
    });

    return payments.map(payment => this.toPaymentResponse(payment));
  }

  async getSummary(filters?: PaymentFiltersDto, userId?: string): Promise<PaymentSummary> {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');

    if (userId) {
      queryBuilder.andWhere('payment.userId = :userId', { userId });
    }

    if (filters) {
      // Apply same filters as findAll
      if (filters.orderId) {
        queryBuilder.andWhere('payment.orderId = :orderId', { orderId: filters.orderId });
      }
      if (filters.status && filters.status.length > 0) {
        queryBuilder.andWhere('payment.status IN (:...status)', { status: filters.status });
      }
      if (filters.paymentMethod && filters.paymentMethod.length > 0) {
        queryBuilder.andWhere('payment.paymentMethod IN (:...paymentMethod)', { paymentMethod: filters.paymentMethod });
      }
      if (filters.paymentGateway) {
        queryBuilder.andWhere('payment.paymentGateway = :paymentGateway', { paymentGateway: filters.paymentGateway });
      }
      if (filters.dateFrom) {
        queryBuilder.andWhere('payment.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
      }
      if (filters.dateTo) {
        queryBuilder.andWhere('payment.createdAt <= :dateTo', { dateTo: filters.dateTo });
      }
    }

    const summary = await queryBuilder
      .select([
        'COUNT(*) as totalPayments',
        'SUM(CASE WHEN status = :completed THEN 1 ELSE 0 END) as successfulPayments',
        'SUM(CASE WHEN status = :failed THEN 1 ELSE 0 END) as failedPayments',
        'SUM(CASE WHEN status IN (:pending, :processing) THEN 1 ELSE 0 END) as pendingPayments',
        'SUM(amount) as totalAmount',
        'SUM(refundedAmount) as totalRefunded'
      ])
      .setParameters({
        completed: PaymentStatus.COMPLETED,
        failed: PaymentStatus.FAILED,
        pending: PaymentStatus.PENDING,
        processing: PaymentStatus.PROCESSING,
      })
      .getRawOne();

    return {
      totalAmount: parseFloat(summary.totalAmount || 0),
      totalRefunded: parseFloat(summary.totalRefunded || 0),
      totalPayments: parseInt(summary.totalPayments || 0),
      successfulPayments: parseInt(summary.successfulPayments || 0),
      failedPayments: parseInt(summary.failedPayments || 0),
      pendingPayments: parseInt(summary.pendingPayments || 0),
    };
  }

  async processPayment(paymentId: string, input: any, userId: string): Promise<PaymentType> {
    const payment = await this.findPaymentByIdAndUser(paymentId, userId);

    if (!payment.canProcess()) {
      throw new BadRequestException('Payment cannot be processed in current state');
    }

    // Update payment status to processing
    payment.status = PaymentStatus.PROCESSING;
    payment.gatewayTransactionId = input.gatewayTransactionId;
    payment.gatewayResponse = input.gatewayResponse;

    const updatedPayment = await this.paymentRepository.save(payment);

    // Publish payment processing event
    this.kafkaClient.emit('payment.processing', {
      paymentId: updatedPayment.id,
      orderId: updatedPayment.orderId,
      userId: updatedPayment.userId,
    });

    this.logger.log(`Payment processing started: ${paymentId}`);

    return this.toPaymentResponse(updatedPayment);
  }

  async completePayment(paymentId: string, transactionId?: string, userId?: string): Promise<PaymentType> {
    const payment = await this.findPaymentById(paymentId);

    if (payment.status !== PaymentStatus.PROCESSING) {
      throw new BadRequestException('Payment must be in processing state to complete');
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.transactionId = transactionId || payment.transactionId;
    payment.processedAt = new Date();

    const updatedPayment = await this.paymentRepository.save(payment);

    // Publish payment completed event
    this.kafkaClient.emit('payment.completed', {
      paymentId: updatedPayment.id,
      orderId: updatedPayment.orderId,
      userId: updatedPayment.userId,
      amount: updatedPayment.amount,
      transactionId: updatedPayment.transactionId,
    });

    this.logger.log(`Payment completed: ${paymentId} for order ${payment.orderId}`);

    return this.toPaymentResponse(updatedPayment);
  }

  async failPayment(paymentId: string, reason?: string, userId?: string): Promise<PaymentType> {
    const payment = await this.findPaymentById(paymentId);

    if (![PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(payment.status)) {
      throw new BadRequestException('Payment cannot be failed in current state');
    }

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = reason;

    const updatedPayment = await this.paymentRepository.save(payment);

    // Publish payment failed event
    this.kafkaClient.emit('payment.failed', {
      paymentId: updatedPayment.id,
      orderId: updatedPayment.orderId,
      userId: updatedPayment.userId,
      reason: updatedPayment.failureReason,
    });

    this.logger.log(`Payment failed: ${paymentId}, reason: ${reason}`);

    return this.toPaymentResponse(updatedPayment);
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string, userId?: string): Promise<PaymentType> {
    const payment = await this.findPaymentById(paymentId);

    const refundAmount = amount || payment.getRemainingAmount();

    if (!payment.canRefundAmount(refundAmount)) {
      throw new BadRequestException('Payment cannot be refunded or insufficient remaining amount');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      payment.refundedAmount += refundAmount;
      payment.refundReason = reason;

      if (payment.refundedAmount >= payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }

      const updatedPayment = await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();

      // Publish payment refunded event
      this.kafkaClient.emit('payment.refunded', {
        paymentId: updatedPayment.id,
        orderId: updatedPayment.orderId,
        userId: updatedPayment.userId,
        refundAmount,
        totalRefunded: updatedPayment.refundedAmount,
        reason: updatedPayment.refundReason,
      });

      this.logger.log(`Payment refunded: ${paymentId}, amount: ${refundAmount}`);

      return this.toPaymentResponse(updatedPayment);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelPayment(paymentId: string, reason?: string, userId?: string): Promise<PaymentType> {
    const payment = await this.findPaymentById(paymentId);

    if (!payment.canCancel()) {
      throw new BadRequestException('Payment cannot be cancelled in current state');
    }

    payment.status = PaymentStatus.CANCELLED;
    payment.failureReason = reason;

    const updatedPayment = await this.paymentRepository.save(payment);

    // Publish payment cancelled event
    this.kafkaClient.emit('payment.cancelled', {
      paymentId: updatedPayment.id,
      orderId: updatedPayment.orderId,
      userId: updatedPayment.userId,
      reason: updatedPayment.failureReason,
    });

    this.logger.log(`Payment cancelled: ${paymentId}`);

    return this.toPaymentResponse(updatedPayment);
  }

  async retryPayment(paymentId: string, userId?: string): Promise<boolean> {
    const payment = await this.findPaymentById(paymentId);

    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException('Only failed payments can be retried');
    }

    // Reset payment to pending for retry
    payment.status = PaymentStatus.PENDING;
    payment.failureReason = undefined;
    payment.gatewayTransactionId = undefined;
    payment.gatewayResponse = undefined;

    await this.paymentRepository.save(payment);

    // Publish payment retry event
    this.kafkaClient.emit('payment.retry', {
      paymentId: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
    });

    this.logger.log(`Payment retry initiated: ${paymentId}`);

    return true;
  }

  // Kafka message handlers
  async handleOrderCreated(data: any) {
    this.logger.log(`Order created event received: ${data.orderId}`);
    // Could automatically create payment record or send notification
  }

  async handleOrderCancelled(data: any) {
    this.logger.log(`Order cancelled event received: ${data.orderId}`);

    // Find and cancel associated payments
    const payments = await this.paymentRepository.find({
      where: { orderId: data.orderId, status: PaymentStatus.PENDING }
    });

    for (const payment of payments) {
      await this.cancelPayment(payment.id, 'Order cancelled');
    }
  }

  private async findPaymentById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private async findPaymentByIdAndUser(id: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id, userId }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private toPaymentResponse(payment: Payment): PaymentType {
    return {
      ...payment,
      remainingAmount: payment.getRemainingAmount(),
      canProcess: payment.canProcess(),
      canRefund: payment.canRefund(),
      canCancel: payment.canCancel(),
    };
  }

  getHello(): string {
    return 'Hello World!';
  }
}