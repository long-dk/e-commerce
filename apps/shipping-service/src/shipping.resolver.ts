import { Resolver, Query, Mutation, Args, ID, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ShippingService } from './shipping.service';
import {
  ShipmentType,
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentFilters,
  PaginatedShipments,
  ShipmentSummary,
} from './shipping.types';
import { JwtAuthGuard } from '../../../libs/shared/src/auth/jwt-auth.guard';

@Resolver(() => ShipmentType)
export class ShippingResolver {
  constructor(
    private readonly shippingService: ShippingService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => ShipmentType)
  @UseGuards(JwtAuthGuard)
  getShipment(@Args('id', { type: () => ID }) id: string) {
    return this.shippingService.findOne(id);
  }

  @Query(() => ShipmentType, { nullable: true })
  @UseGuards(JwtAuthGuard)
  getShipmentByOrder(@Args('orderId') orderId: string) {
    return this.shippingService.findByOrderId(orderId);
  }

  @Query(() => PaginatedShipments)
  @UseGuards(JwtAuthGuard)
  getShipments(
    @Args('filters', { nullable: true }) filters?: ShipmentFilters,
    @Args('limit', { defaultValue: 20 }) limit?: number,
    @Args('offset', { defaultValue: 0 }) offset?: number,
    @Args('sortBy', { defaultValue: 'updatedAt' }) sortBy?: string,
    @Args('sortOrder', { defaultValue: 'DESC' }) sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    return this.shippingService.findAll(filters || {}, limit, offset, sortBy, sortOrder);
  }

  @Query(() => ShipmentSummary)
  @UseGuards(JwtAuthGuard)
  getShipmentSummary() {
    return this.shippingService.getSummary();
  }

  @Mutation(() => ShipmentType)
  @UseGuards(JwtAuthGuard)
  async createShipment(@Args('input') input: CreateShipmentInput) {
    const shipment = await this.shippingService.create(input);
    await this.pubSub.publish('shipmentCreated', { shipmentCreated: shipment });
    return shipment;
  }

  @Mutation(() => ShipmentType)
  @UseGuards(JwtAuthGuard)
  async updateShipment(@Args('input') input: UpdateShipmentInput) {
    const shipment = await this.shippingService.update(input.id, input);
    await this.pubSub.publish('shipmentUpdated', { shipmentUpdated: shipment });
    return shipment;
  }

  @Subscription(() => ShipmentType)
  shipmentCreated() {
    return this.pubSub.asyncIterator('shipmentCreated');
  }

  @Subscription(() => ShipmentType)
  shipmentUpdated() {
    return this.pubSub.asyncIterator('shipmentUpdated');
  }

  @Subscription(() => ShipmentType)
  shipmentStatusChanged() {
    return this.pubSub.asyncIterator('shipmentStatusChanged');
  }
}
