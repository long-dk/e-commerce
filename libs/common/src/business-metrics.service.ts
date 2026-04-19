import { Injectable } from '@nestjs/common';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { LoggerService } from './logger.service';

/**
 * Business Metrics Service
 * Collects and tracks business-specific metrics across services
 * - Orders, Payments, Inventory, Users, Notifications
 */
@Injectable()
export class BusinessMetricsService {
  private serviceName: string = 'unknown';

  constructor(
    private prometheusMetrics: PrometheusMetricsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Initialize the service with the application's service name
   */
  initialize(serviceName: string) {
    this.serviceName = serviceName;
    this.logger.log(`BusinessMetricsService initialized for: ${serviceName}`);
  }

  // ============================================================================
  // ORDER METRICS
  // ============================================================================

  /**
   * Record order creation
   */
  recordOrderCreated(
    orderId: string,
    customerTier: string = 'standard',
    amount?: number,
  ) {
    this.prometheusMetrics.recordOrderCreated(
      this.serviceName,
      'created',
      customerTier,
    );
    this.logger.debug(
      `Order created: ${orderId} (tier: ${customerTier}, amount: ${amount || 'N/A'})`,
    );
  }

  /**
   * Record order status change
   */
  recordOrderStatusChange(
    orderId: string,
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  ) {
    this.prometheusMetrics.recordOrderCreated(this.serviceName, status);
    this.logger.debug(`Order ${orderId} status changed to: ${status}`);
  }

  /**
   * Record order processing step duration (payment, inventory check, shipping, etc.)
   */
  recordOrderProcessingStep(
    orderId: string,
    step: string,
    durationMs: number,
    success: boolean,
  ) {
    this.prometheusMetrics.recordOrderProcessingDuration(
      this.serviceName,
      step,
      durationMs,
    );
    this.logger.debug(
      `Order ${orderId} - ${step}: ${durationMs}ms (${success ? 'success' : 'failed'})`,
    );
  }

  // ============================================================================
  // PAYMENT METRICS
  // ============================================================================

  /**
   * Record payment transaction
   */
  recordPayment(
    orderId: string,
    method: 'credit_card' | 'paypal' | 'stripe' | 'bank_transfer' | string,
    status: 'success' | 'failed' | 'pending',
    amount?: number,
    durationMs?: number,
  ) {
    this.prometheusMetrics.recordPayment(this.serviceName, method, status);

    if (durationMs) {
      this.prometheusMetrics.recordPaymentProcessingDuration(
        this.serviceName,
        method,
        durationMs,
      );
    }

    this.logger.debug(
      `Payment recorded - Order: ${orderId}, Method: ${method}, Status: ${status}, Amount: ${amount || 'N/A'}, Duration: ${durationMs || 'N/A'}ms`,
    );
  }

  /**
   * Update payment success rate (should be called periodically)
   */
  updatePaymentSuccessRate(totalPayments: number, successfulPayments: number) {
    const successRate =
      totalPayments > 0 ? successfulPayments / totalPayments : 0;
    this.prometheusMetrics.setPaymentSuccessRate(this.serviceName, successRate);
    this.logger.debug(
      `Payment success rate updated: ${(successRate * 100).toFixed(2)}%`,
    );
  }

  /**
   * Record payment error/failure reason
   */
  recordPaymentFailure(
    orderId: string,
    method: string,
    reason: 'insufficient_funds' | 'invalid_card' | 'timeout' | 'declined' | string,
  ) {
    this.prometheusMetrics.recordPayment(this.serviceName, method, 'failed');
    this.logger.warn(
      `Payment failed - Order: ${orderId}, Reason: ${reason}`,
    );
  }

  // ============================================================================
  // INVENTORY METRICS
  // ============================================================================

  /**
   * Record current inventory level for a product
   */
  recordInventoryLevel(
    productId: string,
    quantity: number,
    reorderPoint?: number,
  ) {
    const status =
      reorderPoint && quantity <= reorderPoint ? 'low' : 'normal';
    this.prometheusMetrics.setInventoryLevel(
      this.serviceName,
      productId,
      quantity,
      status,
    );

    if (status === 'low') {
      this.logger.warn(
        `Inventory low for product ${productId}: ${quantity} units (reorder point: ${reorderPoint})`,
      );
    }
  }

  /**
   * Record inventory adjustment (stock in/out)
   */
  recordInventoryAdjustment(
    productId: string,
    type: 'restock' | 'sold' | 'return' | 'damage' | 'adjustment' | string,
    quantity: number,
  ) {
    this.prometheusMetrics.recordInventoryAdjustment(
      this.serviceName,
      productId,
      type,
    );
    this.logger.debug(
      `Inventory ${type} - Product: ${productId}, Quantity: ${quantity}`,
    );
  }

  // ============================================================================
  // NOTIFICATION METRICS
  // ============================================================================

  /**
   * Record notification sent
   */
  recordNotificationSent(
    notificationType: 'email' | 'sms' | 'push' | 'webhook' | string,
    status: 'sent' | 'failed' | 'queued' = 'sent',
    recipientId?: string,
  ) {
    this.prometheusMetrics.recordNotificationSent(
      this.serviceName,
      notificationType,
      status,
    );
    this.logger.debug(
      `Notification ${status} - Type: ${notificationType}, Recipient: ${recipientId || 'unknown'}`,
    );
  }

  /**
   * Record notification batch
   */
  recordNotificationBatch(
    notificationType: string,
    count: number,
    successCount: number,
  ) {
    for (let i = 0; i < successCount; i++) {
      this.prometheusMetrics.recordNotificationSent(
        this.serviceName,
        notificationType,
        'sent',
      );
    }
    for (let i = 0; i < count - successCount; i++) {
      this.prometheusMetrics.recordNotificationSent(
        this.serviceName,
        notificationType,
        'failed',
      );
    }
    this.logger.debug(
      `Notification batch - Type: ${notificationType}, Total: ${count}, Success: ${successCount}`,
    );
  }

  // ============================================================================
  // MESSAGING & INFRASTRUCTURE METRICS
  // ============================================================================

  /**
   * Record Kafka message processing
   */
  recordKafkaMessage(
    topic: string,
    type: 'produced' | 'consumed' = 'produced',
    success: boolean = true,
  ) {
    this.prometheusMetrics.recordKafkaMessage(
      this.serviceName,
      topic,
      type,
    );
    this.logger.debug(
      `Kafka message ${type} - Topic: ${topic}, Status: ${success ? 'success' : 'failed'}`,
    );
  }

  // ============================================================================
  // CACHE METRICS
  // ============================================================================

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string = 'redis') {
    this.prometheusMetrics.recordCacheHit(this.serviceName, cacheType);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string = 'redis') {
    this.prometheusMetrics.recordCacheMiss(this.serviceName, cacheType);
  }

  // ============================================================================
  // USER METRICS (for Auth Service)
  // ============================================================================

  /**
   * Record user signup (to be called from auth-service)
   */
  recordUserSignup(userId: string, provider: string = 'local') {
    this.logger.debug(
      `New user signup - UserId: ${userId}, Provider: ${provider}`,
    );
    // Could emit to Kafka or record custom metric
  }

  /**
   * Record user login (to be called from auth-service)
   */
  recordUserLogin(userId: string, provider: string = 'local') {
    this.logger.debug(`User login - UserId: ${userId}, Provider: ${provider}`);
  }

  // ============================================================================
  // CUSTOM METRIC HELPERS
  // ============================================================================

  /**
   * Record database connection pool metrics
   */
  recordDatabaseConnectionPool(
    database: string,
    poolSize: number,
    usedConnections: number,
  ) {
    this.prometheusMetrics.recordDbConnectionPool(
      this.serviceName,
      database,
      poolSize,
      usedConnections,
    );
    this.logger.debug(
      `DB Connection Pool - ${database}: ${usedConnections}/${poolSize} connections used`,
    );
  }

  /**
   * Record active HTTP connections
   */
  recordActiveConnections(count: number) {
    this.prometheusMetrics.setActiveConnections(this.serviceName, count);
  }
}
