import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { Shipment, ShippingStatus } from './shipping.entity';
import {
  UpdateShipmentInput,
  ShipmentType,
} from './shipping.types';

@Injectable()
export class ShippingRepository {
  constructor(
    @InjectRepository(Shipment) private readonly shipmentRepo: Repository<Shipment>,
  ) {}

  create(entityLike: DeepPartial<Shipment>): Shipment {
    return this.shipmentRepo.create(entityLike)
  }

  async save(entity: Shipment): Promise<Shipment> {
    return this.shipmentRepo.save(entity);
  }

  async findOne(options: FindOneOptions<Shipment>): Promise<Shipment | null> {
    return this.shipmentRepo.findOne(options);
  }

  async count(options?: FindManyOptions<Shipment>): Promise<number> {
    return this.shipmentRepo.count(options);
  }
  
  async find(options?: FindManyOptions<Shipment>): Promise<Shipment[]> {
    return this.shipmentRepo.find(options);
  }

  async findAndCount(options?: FindManyOptions<Shipment>): Promise<[Shipment[], number]> {
    return this.shipmentRepo.findAndCount(options);
  }

  async findByOrderId(orderId: string): Promise<ShipmentType | null> {
    const shipment = await this.findOne({ where: { orderId } });
    return shipment ? this.toShipmentType(shipment) : null;
  }

  async update(id: string, input: UpdateShipmentInput): Promise<ShipmentType> {
    const shipment = await this.findOne({ where: { id } });
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

    const saved = await this.save(shipment);

    return this.toShipmentType(saved);
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

  toShipmentType(shipment: Shipment): ShipmentType {
    return {
      ...shipment,
      isActive: !!shipment.status && [ShippingStatus.PENDING, ShippingStatus.READY, ShippingStatus.IN_TRANSIT].includes(shipment.status),
      isComplete: !!shipment.status && [ShippingStatus.DELIVERED, ShippingStatus.CANCELLED, ShippingStatus.RETURNED, ShippingStatus.FAILED].includes(shipment.status),
    } as ShipmentType;
  }
}
