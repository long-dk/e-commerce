import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './inventory.gateway';
import { StockMovementType } from './inventory.entity';
import { LoggerService } from '@app/common';

@Injectable()
export class InventoryKafkaService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly inventoryService: InventoryService,
    private readonly inventoryGateway: InventoryGateway,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  // Handle order events
  async handleOrderCreated(orderData: any) {
    try {
      // Reserve stock for order items
      const reservationResults: Array<{ productId: string; quantity: number; success: boolean; error?: string }> = [];

      for (const item of orderData.items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            await this.inventoryService.reserveStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              reference: orderData.orderId,
              referenceType: 'order',
            });

            reservationResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          } else {
            reservationResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: false,
              error: 'Product not found in inventory',
            });
          }
        } catch (error) {
          this.logger.error(`Failed to reserve stock for product ${item.productId}:`, error);
          reservationResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      // Publish reservation result
      this.kafkaClient.emit('inventory.reservation.completed', {
        orderId: orderData.orderId,
        reservations: reservationResults,
        timestamp: new Date().toISOString(),
      });

      // Emit WebSocket event
      this.inventoryGateway.emitAlert('orderStockReserved', {
        orderId: orderData.orderId,
        items: reservationResults,
      });

    } catch (error) {
      this.logger.error('Failed to process order created event:', error);

      // Publish failure event
      this.kafkaClient.emit('inventory.reservation.failed', {
        orderId: orderData.orderId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleOrderCancelled(orderData: any) {
    this.logger.log('Processing order cancelled event:', orderData);

    try {
      // Release reserved stock for cancelled order
      const releaseResults: Array<{ productId:any; quantity:any; success:boolean; error?:string }> = [];

      for (const item of orderData.items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            await this.inventoryService.releaseStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              reference: orderData.orderId,
            });

            releaseResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          }
        } catch (error) {
          this.logger.error(`Failed to release stock for product ${item.productId}:`, error);
          releaseResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      // Publish release result
      this.kafkaClient.emit('inventory.reservation.released', {
        orderId: orderData.orderId,
        releases: releaseResults,
        timestamp: new Date().toISOString(),
      });

      // Emit WebSocket event
      this.inventoryGateway.emitAlert('orderStockReleased', {
        orderId: orderData.orderId,
        items: releaseResults,
      });

    } catch (error) {
      this.logger.error('Failed to process order cancelled event:', error);
    }
  }

  async handleOrderShipped(orderData: any) {
    this.logger.log('Processing order shipped event:', orderData);

    try {
      // Convert reserved stock to actual stock reduction
      const shipmentResults: Array<{ productId:any; quantity:any; success:boolean; error?:string }> = [];

      for (const item of orderData.items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            // First release the reservation
            await this.inventoryService.releaseStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              reference: orderData.orderId,
            });

            // Then reduce actual stock
            await this.inventoryService.adjustStock({
              inventoryId: inventory._id,
              quantity: -item.quantity,
              movementType: StockMovementType.SALE,
              reason: 'Order shipment',
              reference: orderData.orderId,
              referenceType: 'order',
              performedBy: 'system',
            });

            shipmentResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          }
        } catch (error) {
          this.logger.error(`Failed to process shipment for product ${item.productId}:`, error);
          shipmentResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      // Publish shipment result
      this.kafkaClient.emit('inventory.shipment.completed', {
        orderId: orderData.orderId,
        shipments: shipmentResults,
        timestamp: new Date().toISOString(),
      });

      // Emit WebSocket event
      this.inventoryGateway.emitAlert('orderShipped', {
        orderId: orderData.orderId,
        items: shipmentResults,
      });

    } catch (error) {
      this.logger.error('Failed to process order shipped event:', error);
    }
  }

  // Handle payment events
  async handlePaymentCompleted(paymentData: any) {
    this.logger.log('Processing payment completed event:', paymentData);

    // Payment completion might trigger additional inventory actions
    // For now, just log and emit WebSocket event
    this.inventoryGateway.emitAlert('paymentCompleted', {
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      paymentId: paymentData.paymentId,
    });
  }

  async handlePaymentRefunded(refundData: any) {
    this.logger.log('Processing payment refunded event:', refundData);

    try {
      // Restore stock when payment is refunded
      const refundResults: Array<{ productId:any; quantity:any; success:boolean; error?:string }> = [];

      for (const item of refundData.items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            // Increase stock back
            await this.inventoryService.adjustStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              movementType: StockMovementType.RETURN,
              reason: 'Payment refund',
              reference: refundData.refundId,
              referenceType: 'refund',
              performedBy: 'system',
            });

            refundResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          }
        } catch (error) {
          this.logger.error(`Failed to restore stock for product ${item.productId}:`, error);
          refundResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      // Publish refund result
      this.kafkaClient.emit('inventory.refund.completed', {
        refundId: refundData.refundId,
        orderId: refundData.orderId,
        restorations: refundResults,
        timestamp: new Date().toISOString(),
      });

      // Emit WebSocket event
      this.inventoryGateway.emitAlert('paymentRefunded', {
        refundId: refundData.refundId,
        orderId: refundData.orderId,
        items: refundResults,
      });

    } catch (error) {
      this.logger.error('Failed to process payment refunded event:', error);
    }
  }

  // Inventory check methods (called by other services)
  async checkInventoryAvailability(productIds: string[], quantities: number[]) {
    try {
      const result = await this.inventoryService.checkBulkStock(productIds, quantities);
      return result;
    } catch (error) {
      this.logger.error('Failed to check inventory availability:', error);
      throw error;
    }
  }

  async reserveInventoryForOrder(orderId: string, items: any[]) {
    try {
      const reservationResults: Array<{ productId:any; quantity:any; success:boolean; error?:string }> = [];

      for (const item of items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            await this.inventoryService.reserveStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              reference: orderId,
              referenceType: 'order',
            });

            reservationResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          } else {
            reservationResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: false,
              error: 'Product not found in inventory',
            });
          }
        } catch (error) {
          reservationResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        orderId,
        reservations: reservationResults,
        allReserved: reservationResults.every(r => r.success),
      };
    } catch (error) {
      this.logger.error('Failed to reserve inventory for order:', error);
      throw error;
    }
  }

  async releaseInventoryReservation(orderId: string, items: any[]) {
    try {
      const releaseResults: Array<{ productId:any; quantity:any; success:boolean; error?:string }> = [];

      for (const item of items) {
        try {
          const inventory = await this.inventoryService.findByProductId(item.productId);
          if (inventory) {
            await this.inventoryService.releaseStock({
              inventoryId: inventory._id,
              quantity: item.quantity,
              reference: orderId,
            });

            releaseResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: true,
            });
          }
        } catch (error) {
          releaseResults.push({
            productId: item.productId,
            quantity: item.quantity,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        orderId,
        releases: releaseResults,
        allReleased: releaseResults.every(r => r.success),
      };
    } catch (error) {
      this.logger.error('Failed to release inventory reservation:', error);
      throw error;
    }
  }

  // Publish inventory events
  publishInventoryLowStock(inventory: any) {
    this.kafkaClient.emit('inventory.low_stock', {
      productId: inventory.productId,
      inventoryId: inventory._id,
      currentQuantity: inventory.quantity,
      availableQuantity: inventory.availableQuantity,
      reorderPoint: inventory.reorderPoint,
      timestamp: new Date().toISOString(),
    });
  }

  publishInventoryOutOfStock(inventory: any) {
    this.kafkaClient.emit('inventory.out_of_stock', {
      productId: inventory.productId,
      inventoryId: inventory._id,
      timestamp: new Date().toISOString(),
    });
  }

  publishInventoryReorderNeeded(inventory: any) {
    this.kafkaClient.emit('inventory.reorder_needed', {
      productId: inventory.productId,
      inventoryId: inventory._id,
      currentQuantity: inventory.quantity,
      reorderPoint: inventory.reorderPoint,
      maxStock: inventory.maxStock,
      timestamp: new Date().toISOString(),
    });
  }
}