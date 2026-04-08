import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@app/common';
import { CurrentUser } from '@app/common';
import { OrderService } from './order.service';
import { Order, OrderItem } from './order.types';
import { CreateOrderInput, UpdateOrderInput, OrdersInput } from './order.dto';

@Resolver(() => Order)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => [Order])
  @UseGuards(JwtAuthGuard)
  async orders(
    @Args('input', { nullable: true }) input: OrdersInput,
    @CurrentUser() user: any,
  ): Promise<Order[]> {
    return this.orderService.findAll(user.id, input);
  }

  @Query(() => Order)
  @UseGuards(JwtAuthGuard)
  async order(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.findOne(id, user.id);
  }

  @Query(() => Int)
  @UseGuards(JwtAuthGuard)
  async ordersCount(
    @Args('input', { nullable: true }) input: OrdersInput,
    @CurrentUser() user: any,
  ): Promise<number> {
    return this.orderService.count(user.id, input);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @Args('input') input: CreateOrderInput,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.create(input, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async updateOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateOrderInput,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.update(id, input, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.cancel(id, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async confirmOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.confirm(id, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async shipOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('trackingNumber', { nullable: true }) trackingNumber: string,
    @Args('carrier', { nullable: true }) carrier: string,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.ship(id, { trackingNumber, carrier }, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async deliverOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.deliver(id, user.id);
  }

  @Mutation(() => Order)
  @UseGuards(JwtAuthGuard)
  async processRefund(
    @Args('id', { type: () => ID }) id: string,
    @Args('amount', { type: () => Int, nullable: true }) amount: number,
    @CurrentUser() user: any,
  ): Promise<Order> {
    return this.orderService.processRefund(id, amount, user.id);
  }

  // Admin-only mutations (would need admin guard in real implementation)
  @Mutation(() => Order)
  async updateOrderStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status') status: string,
  ): Promise<Order> {
    return this.orderService.updateStatus(id, status);
  }

  @Mutation(() => Order)
  async updatePaymentStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('paymentStatus') paymentStatus: string,
    @Args('transactionId', { nullable: true }) transactionId: string,
  ): Promise<Order> {
    return this.orderService.updatePaymentStatus(id, paymentStatus, transactionId);
  }
}