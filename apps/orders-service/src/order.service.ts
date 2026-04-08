import { Injectable, NotFoundException, BadRequestException, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { OrderGateway } from './order.gateway';
import { Order, OrderItem, OrderStatus } from './order.entity';
import { Order as OrderType, OrderItem as OrderItemType } from './order.types';
import { CreateOrderInput, UpdateOrderInput, OrdersInput } from './order.dto';
import { LoggerService } from '@app/common';
import { PaymentStatus } from '@app/dto';

@Injectable()
export class OrderService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private dataSource: DataSource,
    @Inject('KAFKA_CLIENT') private kafkaClient: ClientKafka,
    private orderGateway: OrderGateway,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async create(input: CreateOrderInput, userId: string): Promise<OrderType> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate and get product information (would call Products Service)
      const orderItems = await this.validateAndPrepareOrderItems(input.items);

      // Calculate totals
      const subtotal = orderItems.reduce((sum, item) => sum + item.getTotal(), 0);
      const taxAmount = this.calculateTax(subtotal);
      const shippingAmount = this.calculateShipping(subtotal);
      const totalAmount = subtotal + taxAmount + shippingAmount - (input.discountAmount || 0);

      // Create order
      const order = queryRunner.manager.create(Order, {
        userId,
        totalAmount,
        taxAmount,
        shippingAmount,
        discountAmount: input.discountAmount || 0,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        notes: input.notes,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress || input.shippingAddress,
        paymentMethod: input.paymentMethod,
        items: orderItems,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Create order items
      for (const item of orderItems) {
        item.orderId = savedOrder.id;
      }
      await queryRunner.manager.save(OrderItem, orderItems);

      await queryRunner.commitTransaction();

      // Publish order created event
      this.kafkaClient.emit('order.created', {
        orderId: savedOrder.id,
        userId,
        totalAmount,
        items: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      // Emit real-time event
      const createdOrder = this.toOrderResponse(savedOrder);
      this.orderGateway.emitOrderCreated(createdOrder);

      return createdOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(userId: string, input: OrdersInput = {}): Promise<OrderType[]> {
    const { limit = 10, offset = 0, orderBy = 'createdAt', orderDirection = 'DESC', filter } = input;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.userId = :userId', { userId })
      .orderBy(`order.${orderBy}`, orderDirection)
      .limit(limit)
      .offset(offset);

    if (filter) {
      if (filter.status) {
        queryBuilder.andWhere('order.status = :status', { status: filter.status });
      }
      if (filter.paymentStatus) {
        queryBuilder.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: filter.paymentStatus });
      }
    }

    const orders = await queryBuilder.getMany();
    return orders.map(order => this.toOrderResponse(order));
  }

  async findOne(id: string, userId?: string): Promise<OrderType> {
    const whereConditions: any = { id };
    if (userId) {
      whereConditions.userId = userId;
    }

    const order = await this.orderRepository.findOne({
      where: whereConditions,
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(order);
  }

  async count(userId: string, input: OrdersInput = {}): Promise<number> {
    const { filter } = input;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId });

    if (filter) {
      if (filter.status) {
        queryBuilder.andWhere('order.status = :status', { status: filter.status });
      }
      if (filter.paymentStatus) {
        queryBuilder.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: filter.paymentStatus });
      }
    }

    return queryBuilder.getCount();
  }

  async update(id: string, input: UpdateOrderInput, userId: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only update pending orders');
    }

    const updateData: Partial<Order> = {};
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.shippingAddress) updateData.shippingAddress = input.shippingAddress;
    if (input.billingAddress) updateData.billingAddress = input.billingAddress;

    await this.orderRepository.update(id, updateData);

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  }

  async cancel(id: string, userId: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (!order.canCancel) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    await this.orderRepository.update(id, { status: OrderStatus.CANCELLED });

    // Publish order cancelled event
    this.kafkaClient.emit('order.cancelled', {
      orderId: id,
      userId,
      reason: 'user_cancelled',
    });

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderCancelled(updatedOrder);

    return updatedOrder;
  }

  async confirm(id: string, userId?: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in pending status');
    }

    await this.orderRepository.update(id, { status: OrderStatus.CONFIRMED });

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderConfirmed(updatedOrder);

    return updatedOrder;
  }

  async ship(id: string, shippingData: { trackingNumber?: string; carrier?: string }, userId: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (!order.canShip) {
      throw new BadRequestException('Order cannot be shipped');
    }

    const updateData: Partial<Order> = {
      status: OrderStatus.SHIPPED,
      shippedAt: new Date(),
    };

    if (shippingData.trackingNumber) updateData.trackingNumber = shippingData.trackingNumber;
    if (shippingData.carrier) updateData.carrier = shippingData.carrier;

    await this.orderRepository.update(id, updateData);

    // Publish order shipped event
    this.kafkaClient.emit('order.shipped', {
      orderId: id,
      userId,
      trackingNumber: shippingData.trackingNumber,
      carrier: shippingData.carrier,
    });

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderShipped(updatedOrder);

    return updatedOrder;
  }

  async deliver(id: string, userId: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (!order.canDeliver) {
      throw new BadRequestException('Order cannot be delivered');
    }

    await this.orderRepository.update(id, {
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });

    // Publish order delivered event
    this.kafkaClient.emit('order.delivered', {
      orderId: id,
      userId,
    });

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderDelivered(updatedOrder);

    return updatedOrder;
  }

  async processRefund(id: string, amount: number, userId: string): Promise<OrderType> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.CANCELLED && order.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is not eligible for refund');
    }

    const refundAmount = amount || order.totalAmount;

    await this.orderRepository.update(id, {
      status: OrderStatus.REFUNDED,
      paymentStatus: PaymentStatus.REFUNDED,
    });

    // Publish refund processed event
    this.kafkaClient.emit('order.refunded', {
      orderId: id,
      userId,
      refundAmount,
    });

    const updatedOrder = await this.findOne(id, userId);

    // Emit real-time event
    this.orderGateway.emitOrderRefunded(updatedOrder);

    return updatedOrder;
  }

  // Admin methods
  async updateStatus(id: string, status: string): Promise<OrderType> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.orderRepository.update(id, { status: status as OrderStatus });

    const updatedOrder = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!updatedOrder) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(updatedOrder);
  }

  async updatePaymentStatus(id: string, paymentStatus: string, transactionId?: string): Promise<OrderType> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updateData: Partial<Order> = { paymentStatus: paymentStatus as PaymentStatus };
    if (transactionId) updateData.transactionId = transactionId;

    await this.orderRepository.update(id, updateData);

    const updatedOrder = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!updatedOrder) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(updatedOrder);
  }

  // Kafka message handlers
  async handlePaymentProcessed(data: any) {
    const { orderId, transactionId, status } = data;

    if (status === 'success') {
      await this.updatePaymentStatus(orderId, PaymentStatus.COMPLETED, transactionId);
      // Auto-confirm order when payment is successful
      await this.confirm(orderId); // Skip user check for system operations
    } else {
      await this.updatePaymentStatus(orderId, PaymentStatus.FAILED, transactionId);
    }
  }

  async handlePaymentFailed(data: any) {
    // Handle payment failure
    this.logger.log('Payment failed for order:', data.orderId);
  }

  async handleInventoryReserved(data: any) {
    // Handle inventory reservation confirmation
    this.logger.log('Inventory reserved for order:', data.orderId);
  }

  async handleShippingCreated(data: any) {
    // Handle shipping label creation
    this.logger.log('Shipping created for order:', data.orderId);
  }

  // Helper methods
  private async validateAndPrepareOrderItems(items: any[]): Promise<OrderItem[]> {
    // In a real implementation, this would call the Products Service
    // to validate product availability and get current prices
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      // Mock product validation - in real app, call Products Service
      const productInfo = await this.getProductInfo(item.productId);

      const orderItem = this.orderItemRepository.create({
        productId: item.productId,
        productName: productInfo.name,
        productSku: productInfo.sku,
        productDescription: productInfo.description,
        price: productInfo.price,
        quantity: item.quantity,
        discount: item.discount || 0,
        productOptions: item.productOptions,
        productImage: productInfo.image,
      });

      orderItems.push(orderItem);
    }

    return orderItems;
  }

  private async getProductInfo(productId: string): Promise<any> {
    // Mock product info - in real app, call Products Service via HTTP or Kafka
    return {
      id: productId,
      name: `Product ${productId.substring(0, 8)}`,
      sku: `SKU-${productId.substring(0, 8)}`,
      description: 'Product description',
      price: 29.99,
      image: 'https://example.com/image.jpg',
    };
  }

  private calculateTax(subtotal: number): number {
    return Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
  }

  private calculateShipping(subtotal: number): number {
    return subtotal > 50 ? 0 : 5.99; // Free shipping over $50
  }

  private toOrderResponse(order: Order): OrderType {
    return {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      discountAmount: order.discountAmount,
      subtotal: order.getSubtotal(),
      totalItems: order.getTotalItems(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      notes: order.notes,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod,
      transactionId: order.transactionId,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      items: order.items?.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productDescription: item.productDescription,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount,
        total: item.getTotal(),
        productImage: item.productImage,
        productOptions: item.productOptions,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })) || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      canCancel: order.canCancel(),
      canShip: order.canShip(),
      canDeliver: order.canDeliver(),
    };
  }

  getHello(): string {
    return 'Hello World!';
  }
}