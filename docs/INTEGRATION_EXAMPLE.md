/**
 * INTEGRATION EXAMPLE: Using Resilient HTTP Client in Orders Service
 * This file shows how to integrate circuit breaker and retry patterns
 * into an existing microservice for inter-service communication.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ResilientHttpClientFactory, ResilientHttpClient } from '@app/common';

export interface ExternalServiceConfig {
  paymentServiceUrl: string;
  inventoryServiceUrl: string;
  shippingServiceUrl: string;
  notificationServiceUrl: string;
}

/**
 * External Service Integration Manager
 * Wraps all inter-service calls with circuit breaker and retry patterns
 */
@Injectable()
export class ExternalServicesIntegration {
  private paymentClient: ResilientHttpClient;
  private inventoryClient: ResilientHttpClient;
  private shippingClient: ResilientHttpClient;
  private notificationClient: ResilientHttpClient;
  private readonly logger = new Logger(ExternalServicesIntegration.name);

  constructor(
    private httpClientFactory: ResilientHttpClientFactory,
    private config: ExternalServiceConfig,
  ) {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Payment Service - Critical, needs strict circuit breaker
    this.paymentClient = this.httpClientFactory.getOrCreate({
      serviceName: 'payments',
      circuitBreaker: {
        name: 'payment-service-circuit-breaker',
        failureThreshold: 3,      // Open after 3 failures
        successThreshold: 2,      // Close after 2 successes
        timeout: 30000,           // Retry after 30 seconds
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitterFactor: 0.2,
      },
    });

    // Inventory Service - Important, moderate circuit breaker
    this.inventoryClient = this.httpClientFactory.getOrCreate({
      serviceName: 'inventory',
      circuitBreaker: {
        name: 'inventory-service-circuit-breaker',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 50,
        maxDelay: 3000,
      },
    });

    // Shipping Service - Non-critical for order creation, lenient
    this.shippingClient = this.httpClientFactory.getOrCreate({
      serviceName: 'shipping',
      circuitBreaker: {
        name: 'shipping-service-circuit-breaker',
        failureThreshold: 8,
        successThreshold: 3,
        timeout: 120000,
      },
      retry: {
        maxAttempts: 2,
        initialDelay: 200,
        maxDelay: 10000,
      },
    });

    // Notification Service - Not critical, lenient
    this.notificationClient = this.httpClientFactory.getOrCreate({
      serviceName: 'notifications',
      circuitBreaker: {
        name: 'notification-service-circuit-breaker',
        failureThreshold: 10,
        timeout: 180000,
      },
      retry: {
        maxAttempts: 2,
        initialDelay: 100,
        maxDelay: 5000,
      },
    });
  }

  /**
   * Verify inventory availability with resilience
   */
  async verifyInventory(productId: string, quantity: number): Promise<boolean> {
    try {
      const response = await this.inventoryClient.post(
        `${this.config.inventoryServiceUrl}/verify`,
        { productId, quantity },
        { timeout: 10000 }
      );
      return response.data.available;
    } catch (error) {
      this.logger.error(
        `Failed to verify inventory for product ${productId}`,
        error
      );
      // Graceful degradation: assume available if service is down
      // (would need retry on actual order placement)
      throw error;
    }
  }

  /**
   * Reserve inventory with resilience
   */
  async reserveInventory(
    productId: string,
    quantity: number,
    orderId: string
  ): Promise<boolean> {
    try {
      const response = await this.inventoryClient.post(
        `${this.config.inventoryServiceUrl}/reserve`,
        { productId, quantity, orderId },
        { timeout: 15000 }
      );
      return response.data.reserved;
    } catch (error) {
      this.logger.error(
        `Failed to reserve inventory for order ${orderId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Initialize payment with resilience (CRITICAL)
   */
  async initializePayment(
    orderId: string,
    amount: number,
    userId: string,
    paymentMethod: string
  ): Promise<{ paymentId: string; transactionId: string }> {
    try {
      const response = await this.paymentClient.post(
        `${this.config.paymentServiceUrl}/initialize`,
        {
          orderId,
          amount,
          userId,
          paymentMethod,
        },
        { timeout: 30000 }
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to initialize payment for order ${orderId}`, error);
      // Payment failures should always be propagated
      throw error;
    }
  }

  /**
   * Confirm payment with resilience
   */
  async confirmPayment(
    paymentId: string,
    transactionId: string
  ): Promise<boolean> {
    try {
      const response = await this.paymentClient.post(
        `${this.config.paymentServiceUrl}/confirm`,
        { paymentId, transactionId },
        { timeout: 30000 }
      );
      return response.data.confirmed;
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment ${paymentId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create shipment with resilience (non-critical)
   */
  async createShipment(
    orderId: string,
    address: any,
    items: any[]
  ): Promise<{ shipmentId: string }> {
    try {
      const response = await this.shippingClient.post(
        `${this.config.shippingServiceUrl}/shipments`,
        { orderId, address, items },
        { timeout: 20000 }
      );
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Failed to create shipment for order ${orderId}, will retry later`,
        error
      );
      // Non-critical failure, can be handled separately
      // Could be queued for retry via background job
      throw error;
    }
  }

  /**
   * Send notifications (non-critical)
   */
  async sendOrderNotification(
    userId: string,
    orderId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      await this.notificationClient.post(
        `${this.config.notificationServiceUrl}/send`,
        {
          userId,
          orderId,
          type,
          data,
        },
        { timeout: 10000 }
      );
    } catch (error) {
      // Log error but don't fail order processing
      this.logger.warn(
        `Failed to send ${type} notification for order ${orderId}`,
        error
      );
      // Don't throw - notification failures shouldn't affect order
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus(): Record<string, any> {
    return {
      payment: this.paymentClient.getCircuitBreakerMetrics(),
      inventory: this.inventoryClient.getCircuitBreakerMetrics(),
      shipping: this.shippingClient.getCircuitBreakerMetrics(),
      notifications: this.notificationClient.getCircuitBreakerMetrics(),
    };
  }

  /**
   * Get detailed metrics for monitoring
   */
  getDetailedMetrics(): Record<string, any> {
    return {
      payment: {
        circuitBreaker: this.paymentClient.getCircuitBreakerMetrics(),
        retry: this.paymentClient.getRetryMetrics(),
      },
      inventory: {
        circuitBreaker: this.inventoryClient.getCircuitBreakerMetrics(),
        retry: this.inventoryClient.getRetryMetrics(),
      },
      shipping: {
        circuitBreaker: this.shippingClient.getCircuitBreakerMetrics(),
        retry: this.shippingClient.getRetryMetrics(),
      },
      notifications: {
        circuitBreaker: this.notificationClient.getCircuitBreakerMetrics(),
        retry: this.notificationClient.getRetryMetrics(),
      },
    };
  }

  /**
   * Reset specific circuit breaker (admin function)
   */
  resetCircuitBreaker(service: 'payment' | 'inventory' | 'shipping' | 'notifications'): void {
    switch (service) {
      case 'payment':
        this.paymentClient.resetCircuitBreaker();
        break;
      case 'inventory':
        this.inventoryClient.resetCircuitBreaker();
        break;
      case 'shipping':
        this.shippingClient.resetCircuitBreaker();
        break;
      case 'notifications':
        this.notificationClient.resetCircuitBreaker();
        break;
    }
    this.logger.log(`Circuit breaker reset for ${service} service`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.paymentClient.resetCircuitBreaker();
    this.inventoryClient.resetCircuitBreaker();
    this.shippingClient.resetCircuitBreaker();
    this.notificationClient.resetCircuitBreaker();
    this.logger.log('All circuit breakers have been reset');
  }
}

/**
 * Example: Using ExternalServicesIntegration in Order Service
 */
// In your order.service.ts:
/*
@Injectable()
export class OrderService {
  constructor(
    private externalServices: ExternalServicesIntegration,
    // ... other dependencies
  ) {}

  async createOrder(createOrderInput: CreateOrderInput, userId: string) {
    // 1. Verify inventory (will retry and use circuit breaker)
    await this.externalServices.verifyInventory(
      createOrderInput.productId,
      createOrderInput.quantity
    );

    // 2. Initialize payment (critical - will strictly apply patterns)
    const payment = await this.externalServices.initializePayment(
      orderId,
      total,
      userId,
      paymentMethod
    );

    // 3. Reserve inventory
    await this.externalServices.reserveInventory(
      createOrderInput.productId,
      createOrderInput.quantity,
      orderId
    );

    // 4. Confirm payment
    await this.externalServices.confirmPayment(
      payment.paymentId,
      payment.transactionId
    );

    // 5. Create shipment (non-critical, handle failure gracefully)
    try {
      await this.externalServices.createShipment(orderId, address, items);
    } catch (error) {
      // Queue for retry, don't fail order
      this.logger.warn(`Will retry shipment creation for order ${orderId}`);
    }

    // 6. Send notification (fire and forget style)
    this.externalServices.sendOrderNotification(
      userId,
      orderId,
      'order_created',
      { order: order }
    );
  }
}
*/
