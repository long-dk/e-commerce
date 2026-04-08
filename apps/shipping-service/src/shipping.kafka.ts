import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingGateway } from './shipping.gateway';
import { ShippingStatus } from './shipping.entity';
import { LoggerService } from '@app/common';

@Injectable()
export class ShippingKafkaService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly shippingService: ShippingService,
    private readonly shippingGateway: ShippingGateway,
    private readonly logger: LoggerService
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async handleOrderShipped(orderData: any) {
    try {
      const carrier = orderData.carrier || 'DefaultCarrier';
      const trackingNumber = orderData.trackingNumber || `TRK-${Date.now()}`;

      const shipment = await this.shippingService.markAsShipped(orderData.orderId, carrier, trackingNumber);

      this.kafkaClient.emit('shipping.shipped', {
        orderId: orderData.orderId,
        shipmentId: shipment.id,
        status: shipment.status,
        trackingNumber,
        timestamp: new Date().toISOString(),
      });

      this.shippingGateway.server.emit('shipping.shipped', shipment);
    } catch (error) {
      this.logger.error('Failed to process order.shipped event', error);
      this.kafkaClient.emit('shipping.shipped.failed', {
        orderId: orderData.orderId,
        error: error.message,
      });
    }
  }

  async handleOrderDelivered(orderData: any) {
    try {
      const shipment = await this.shippingService.markAsDelivered(orderData.orderId);

      this.kafkaClient.emit('shipping.delivered', {
        orderId: orderData.orderId,
        shipmentId: shipment.id,
        status: shipment.status,
        timestamp: new Date().toISOString(),
      });

      this.shippingGateway.server.emit('shipping.delivered', shipment);
    } catch (error) {
      this.logger.error('Failed to process order.delivered event', error);
      this.kafkaClient.emit('shipping.delivered.failed', {
        orderId: orderData.orderId,
        error: error.message,
      });
    }
  }

  async handleOrderCancelled(orderData: any) {
    try {
      const shipment = await this.shippingService.findByOrderId(orderData.orderId);
      if (!shipment) return;

      await this.shippingService.update(shipment.id, { id: shipment.id, status: ShippingStatus.CANCELLED });
      this.kafkaClient.emit('shipping.cancelled', {
        orderId: orderData.orderId,
        shipmentId: shipment.id,
        status: ShippingStatus.CANCELLED,
        timestamp: new Date().toISOString(),
      });

      this.shippingGateway.server.emit('shipping.cancelled', shipment);
    } catch (error) {
      this.logger.error('Failed to process order.cancelled event', error);
      this.kafkaClient.emit('shipping.cancelled.failed', {
        orderId: orderData.orderId,
        error: error.message,
      });
    }
  }
}
