import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';
import { LoggerService } from './logger.service';

export interface MetricLabels {
  [key: string]: string | number;
}

@Injectable()
export class PrometheusMetricsService {
  private register: promClient.Registry;

  // Standard metrics
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;
  private httpRequestSize: promClient.Histogram;
  private httpResponseSize: promClient.Histogram;
  private activeConnections: promClient.Gauge;
  private dbConnectionPoolSize: promClient.Gauge;
  private dbConnectionPoolUsed: promClient.Gauge;

  // Custom business metrics
  private ordersTotal: promClient.Counter;
  private ordersProcessingDuration: promClient.Histogram;
  private paymentsTotal: promClient.Counter;
  private paymentsSuccessRate: promClient.Gauge;
  private paymentsProcessingDuration: promClient.Histogram;
  private inventoryLevelGauge: promClient.Gauge;
  private inventoryAdjustmentsTotal: promClient.Counter;
  private notificationsSentTotal: promClient.Counter;
  private kafkaMessagesTotal: promClient.Counter;
  private cacheHits: promClient.Counter;
  private cacheMisses: promClient.Counter;

  constructor(private readonly logger: LoggerService) {
    // Create a custom registry (use default if using global)
    this.register = new promClient.Registry();

    // Initialize default metrics
    promClient.collectDefaultMetrics({ register: this.register });

    // HTTP metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in milliseconds',
      labelNames: ['service', 'method', 'endpoint', 'status_code'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.register],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['service', 'method', 'endpoint', 'status_code'],
      registers: [this.register],
    });

    this.httpRequestSize = new promClient.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP request payloads in bytes',
      labelNames: ['service', 'method', 'endpoint'],
      registers: [this.register],
    });

    this.httpResponseSize = new promClient.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP response payloads in bytes',
      labelNames: ['service', 'method', 'endpoint', 'status_code'],
      registers: [this.register],
    });

    this.activeConnections = new promClient.Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      labelNames: ['service'],
      registers: [this.register],
    });

    // Database metrics
    this.dbConnectionPoolSize = new promClient.Gauge({
      name: 'db_connection_pool_size',
      help: 'Database connection pool size',
      labelNames: ['service', 'database'],
      registers: [this.register],
    });

    this.dbConnectionPoolUsed = new promClient.Gauge({
      name: 'db_connection_pool_used',
      help: 'Number of used database connections',
      labelNames: ['service', 'database'],
      registers: [this.register],
    });

    // Business metrics - Orders
    this.ordersTotal = new promClient.Counter({
      name: 'orders_total',
      help: 'Total number of orders created',
      labelNames: ['service', 'status', 'customer_tier'],
      registers: [this.register],
    });

    this.ordersProcessingDuration = new promClient.Histogram({
      name: 'order_processing_duration_ms',
      help: 'Time taken to process an order in milliseconds',
      labelNames: ['service', 'step'],
      buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
      registers: [this.register],
    });

    // Business metrics - Payments
    this.paymentsTotal = new promClient.Counter({
      name: 'payments_total',
      help: 'Total number of payment transactions',
      labelNames: ['service', 'method', 'status'],
      registers: [this.register],
    });

    this.paymentsSuccessRate = new promClient.Gauge({
      name: 'payment_success_rate',
      help: 'Payment success rate (0-1)',
      labelNames: ['service'],
      registers: [this.register],
    });

    this.paymentsProcessingDuration = new promClient.Histogram({
      name: 'payment_processing_duration_ms',
      help: 'Time taken to process a payment in milliseconds',
      labelNames: ['service', 'method'],
      buckets: [100, 500, 1000, 5000, 10000],
      registers: [this.register],
    });

    // Business metrics - Inventory
    this.inventoryLevelGauge = new promClient.Gauge({
      name: 'inventory_level',
      help: 'Current inventory level by product',
      labelNames: ['service', 'product_id', 'status'],
      registers: [this.register],
    });

    this.inventoryAdjustmentsTotal = new promClient.Counter({
      name: 'inventory_adjustments_total',
      help: 'Total inventory adjustments',
      labelNames: ['service', 'product_id', 'type'],
      registers: [this.register],
    });

    // Business metrics - Notifications
    this.notificationsSentTotal = new promClient.Counter({
      name: 'notifications_sent_total',
      help: 'Total notifications sent',
      labelNames: ['service', 'type', 'status'],
      registers: [this.register],
    });

    // Infrastructure metrics - Kafka
    this.kafkaMessagesTotal = new promClient.Counter({
      name: 'kafka_messages_total',
      help: 'Total Kafka messages processed',
      labelNames: ['service', 'topic', 'type'],
      registers: [this.register],
    });

    // Cache metrics
    this.cacheHits = new promClient.Counter({
      name: 'cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['service', 'cache_type'],
      registers: [this.register],
    });

    this.cacheMisses = new promClient.Counter({
      name: 'cache_misses_total',
      help: 'Total cache misses',
      labelNames: ['service', 'cache_type'],
      registers: [this.register],
    });

    this.logger.log('PrometheusMetricsService initialized');
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    serviceName: string,
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
  ) {
    this.httpRequestDuration.labels(serviceName, method, endpoint, statusCode.toString()).observe(duration);
    this.httpRequestTotal.labels(serviceName, method, endpoint, statusCode.toString()).inc();

    if (requestSize) {
      this.httpRequestSize.labels(serviceName, method, endpoint).observe(requestSize);
    }

    if (responseSize) {
      this.httpResponseSize.labels(serviceName, method, endpoint, statusCode.toString()).observe(responseSize);
    }
  }

  /**
   * Record active connections
   */
  setActiveConnections(serviceName: string, count: number) {
    this.activeConnections.labels(serviceName).set(count);
  }

  /**
   * Record database connection pool metrics
   */
  recordDbConnectionPool(serviceName: string, database: string, poolSize: number, usedConnections: number) {
    this.dbConnectionPoolSize.labels(serviceName, database).set(poolSize);
    this.dbConnectionPoolUsed.labels(serviceName, database).set(usedConnections);
  }

  /**
   * Record order creation
   */
  recordOrderCreated(serviceName: string, status: string = 'created', customerTier: string = 'standard') {
    this.ordersTotal.labels(serviceName, status, customerTier).inc();
  }

  /**
   * Record order processing duration
   */
  recordOrderProcessingDuration(serviceName: string, step: string, duration: number) {
    this.ordersProcessingDuration.labels(serviceName, step).observe(duration);
  }

  /**
   * Record payment transaction
   */
  recordPayment(serviceName: string, method: string, status: string) {
    this.paymentsTotal.labels(serviceName, method, status).inc();
  }

  /**
   * Record payment success rate
   */
  setPaymentSuccessRate(serviceName: string, rate: number) {
    this.paymentsSuccessRate.labels(serviceName).set(Math.max(0, Math.min(1, rate)));
  }

  /**
   * Record payment processing duration
   */
  recordPaymentProcessingDuration(serviceName: string, method: string, duration: number) {
    this.paymentsProcessingDuration.labels(serviceName, method).observe(duration);
  }

  /**
   * Record inventory level
   */
  setInventoryLevel(serviceName: string, productId: string, level: number, status: string = 'normal') {
    this.inventoryLevelGauge.labels(serviceName, productId, status).set(level);
  }

  /**
   * Record inventory adjustment
   */
  recordInventoryAdjustment(serviceName: string, productId: string, type: string) {
    this.inventoryAdjustmentsTotal.labels(serviceName, productId, type).inc();
  }

  /**
   * Record notification sent
   */
  recordNotificationSent(serviceName: string, type: string, status: string = 'sent') {
    this.notificationsSentTotal.labels(serviceName, type, status).inc();
  }

  /**
   * Record Kafka message
   */
  recordKafkaMessage(serviceName: string, topic: string, type: string = 'produced') {
    this.kafkaMessagesTotal.labels(serviceName, topic, type).inc();
  }

  /**
   * Record cache hit
   */
  recordCacheHit(serviceName: string, cacheType: string) {
    this.cacheHits.labels(serviceName, cacheType).inc();
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(serviceName: string, cacheType: string) {
    this.cacheMisses.labels(serviceName, cacheType).inc();
  }

  /**
   * Get prometheus metrics in text format
   */
  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get content type for prometheus metrics
   */
  getContentType(): string {
    return this.register.contentType;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.register.resetMetrics();
  }
}
