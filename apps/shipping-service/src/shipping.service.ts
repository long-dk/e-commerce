import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { In, Like } from 'typeorm';
import { ShippingStatus } from './shipping.entity';
import {
  CreateShipmentInput,
  UpdateShipmentInput,
  ShipmentFilters,
  PaginatedShipments,
  ShipmentSummary,
  ShipmentType,
} from './shipping.types';
import { ShippingRepository } from './shipping.repository';
import { ShippingGateway } from './shipping.gateway';

@Injectable()
export class ShippingService {
  constructor(
    private readonly shipmentRepository: ShippingRepository,
    private readonly shippingGateway: ShippingGateway,
  ) {}

  async create(input: CreateShipmentInput): Promise<ShipmentType> {
    const existing = await this.shipmentRepository.findOne({ where: { orderId: input.orderId } });
    if (existing) {
      throw new BadRequestException(`Shipment for order ${input.orderId} already exists`);
    }

    const data = this.shipmentRepository.create({
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

    const saved = await this.shipmentRepository.save(data);

    const shipment = this.shipmentRepository.toShipmentType(saved);
    this.shippingGateway.broadcastShippingEvent('shipmentCreated', shipment);

    return shipment;
  }

  async update(id: string, input: UpdateShipmentInput): Promise<ShipmentType> {
    const shipment = await this.shipmentRepository.update(id, input);
    this.shippingGateway.broadcastShippingEvent('shipmentUpdated', shipment);
    return shipment;
  }

  async findOne(id: string): Promise<ShipmentType> {
    const shipment = await this.shipmentRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }
    return this.shipmentRepository.toShipmentType(shipment);
  }

  async findByOrderId(orderId: string): Promise<ShipmentType | null> {
    return this.shipmentRepository.findByOrderId(orderId);
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
      shipments: list.map(shipment => this.shipmentRepository.toShipmentType(shipment)),
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
    const shipment = await this.shipmentRepository.markAsShipped(orderId, carrier, trackingNumber);
    this.shippingGateway.broadcastShippingEvent('shipmentUpdated', shipment);
    return shipment;
  }
  
  async markAsDelivered(orderId: string): Promise<ShipmentType> {
    const shipment = await this.shipmentRepository.markAsDelivered(orderId);
    this.shippingGateway.broadcastShippingEvent('shipmentUpdated', shipment);
    return shipment;
  }

  getHello(): string {
    return 'Hello World!';
  }
}
