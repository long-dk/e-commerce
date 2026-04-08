import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { Shipment, ShippingStatus } from './shipping.entity';
import {
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentFilters,
  PaginatedShipments,
  ShipmentSummary,
  ShipmentType,
} from './shipping.types';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private toShipmentType(shipment: Shipment): ShipmentType {
    return {
      ...shipment,
      isActive: !!shipment.status && [ShippingStatus.PENDING, ShippingStatus.READY, ShippingStatus.IN_TRANSIT].includes(shipment.status),
      isComplete: !!shipment.status && [ShippingStatus.DELIVERED, ShippingStatus.CANCELLED, ShippingStatus.RETURNED, ShippingStatus.FAILED].includes(shipment.status),
    } as ShipmentType;
  }

  async create(input: CreateShipmentInput): Promise<ShipmentType> {
    const existing = await this.shipmentRepository.findOne({ where: { orderId: input.orderId } });
    if (existing) {
      throw new BadRequestException(`Shipment for order ${input.orderId} already exists`);
    }

    const shipment = this.shipmentRepository.create({
      orderId: input.orderId,
      status: ShippingStatus.PENDING,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress,
      shippingCost: input.shippingCost,
      estimatedDelivery: input.estimatedDelivery,
      metadata: input.metadata ? (input.metadata as string) : '',
    });

    const saved = await this.shipmentRepository.save(shipment);

    await this.pubSub.publish('shipmentCreated', { shipmentCreated: this.toShipmentType(saved) });

    return this.toShipmentType(saved);
  }

  async update(id: string, input: UpdateShipmentInput): Promise<ShipmentType> {
    const shipment = await this.shipmentRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    if (input.status) {
      shipment.status = input.status;
      if (input.status === ShippingStatus.DELIVERED) {
        shipment.deliveredAt = new Date();
      }
    }

    if (input.carrier) shipment.carrier = input.carrier;
    if (input.trackingNumber) shipment.trackingNumber = input.trackingNumber;
    if (input.estimatedDelivery) shipment.estimatedDelivery = new Date(input.estimatedDelivery);
    if (input.deliveredAt) shipment.deliveredAt = new Date(input.deliveredAt);
    if (input.metadata) shipment.metadata = JSON.parse(input.metadata);

    const saved = await this.shipmentRepository.save(shipment);
    await this.pubSub.publish('shipmentUpdated', { shipmentUpdated: this.toShipmentType(saved) });

    return this.toShipmentType(saved);
  }

  async findOne(id: string): Promise<ShipmentType> {
    const shipment = await this.shipmentRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }
    return this.toShipmentType(shipment);
  }

  async findByOrderId(orderId: string): Promise<ShipmentType | null> {
    const shipment = await this.shipmentRepository.findOne({ where: { orderId } });
    return shipment ? this.toShipmentType(shipment) : null;
  }

  async findAll(filters: ShipmentFilters, limit = 20, offset = 0, sortBy = 'updatedAt', sortOrder: 'ASC' | 'DESC' = 'DESC'): Promise<PaginatedShipments> {
    const where: any = {};
    if (filters?.orderId) where.orderId = filters.orderId;
    if (filters?.status) where.status = In(filters.status);
    if (filters?.trackingNumber) where.trackingNumber = Like(`%${filters.trackingNumber}%`);
    if (filters?.customerName) where.customerName = Like(`%${filters.customerName}%`);

    const [list, totalCount] = await this.shipmentRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    });

    return {
      shipments: list.map(s => this.toShipmentType(s)),
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  }

  async getSummary(): Promise<ShipmentSummary> {
    const all = await this.shipmentRepository.find();
    const summary = {
      total: all.length,
      pending: all.filter(s => s.status === ShippingStatus.PENDING).length,
      inTransit: all.filter(s => s.status === ShippingStatus.IN_TRANSIT).length,
      delivered: all.filter(s => s.status === ShippingStatus.DELIVERED).length,
      cancelled: all.filter(s => s.status === ShippingStatus.CANCELLED).length,
      returned: all.filter(s => s.status === ShippingStatus.RETURNED).length,
      failed: all.filter(s => s.status === ShippingStatus.FAILED).length,
    };

    return summary;
  }

  async markAsShipped(orderId: string, carrier: string, trackingNumber: string): Promise<ShipmentType> {
    const shipment = await this.findByOrderId(orderId);
    if (!shipment) {
      throw new NotFoundException(`Shipment for order ${orderId} not found`);
    }

    return this.update(shipment.id, {
      id: shipment.id,
      status: ShippingStatus.IN_TRANSIT,
      carrier,
      trackingNumber,
      metadata: shipment.metadata ? JSON.stringify(shipment.metadata) : undefined,
    });
  }

  async markAsDelivered(orderId: string): Promise<ShipmentType> {
    const shipment = await this.findByOrderId(orderId);
    if (!shipment) {
      throw new NotFoundException(`Shipment for order ${orderId} not found`);
    }

    return this.update(shipment.id, {
      id: shipment.id,
      status: ShippingStatus.DELIVERED,
      deliveredAt: new Date(),
    });
  }

  getHello(): string {
    return 'Hello World!';
  }
}
