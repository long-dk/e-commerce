import { Injectable } from '@nestjs/common';
import {
  ResilientHttpClientFactory,
  ResilientHttpClient,
} from '@app/common';

export interface ExternalPaymentGatewayConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: Date;
  gatewayReference?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
}

/**
 * Example: External Payment Service with Circuit Breaker and Retry
 * Demonstrates integration with third-party payment gateways using resilient HTTP client
 */
@Injectable()
export class ExternalPaymentService {
  private httpClient: ResilientHttpClient;

  constructor(
    private resilientHttpClientFactory: ResilientHttpClientFactory,
    private config: ExternalPaymentGatewayConfig,
  ) {
    // Create a resilient HTTP client for this payment gateway
    this.httpClient = this.resilientHttpClientFactory.getOrCreate({
      serviceName: `payment-gateway-${config.name}`,
      circuitBreaker: {
        name: `payment-${config.name}`,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute before trying again
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 200,
        maxDelay: 5000,
        jitterFactor: 0.2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      },
    });
  }

  /**
   * Process a payment through the external gateway
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await this.httpClient.post<any>(
        `${this.config.baseUrl}/charge`,
        {
          order_id: request.orderId,
          amount: request.amount,
          currency: request.currency,
          payment_method: request.method,
          metadata: request.metadata,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.config.timeout || 30000,
        }
      );

      return {
        transactionId: response.data.transaction_id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        timestamp: new Date(response.data.timestamp),
        gatewayReference: response.data.gateway_reference,
      };
    } catch (error) {
      throw this.handlePaymentError(error);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const response = await this.httpClient.get<any>(
        `${this.config.baseUrl}/transaction/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: this.config.timeout || 30000,
        }
      );

      return {
        transactionId: response.data.transaction_id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        timestamp: new Date(response.data.timestamp),
        gatewayReference: response.data.gateway_reference,
      };
    } catch (error) {
      throw this.handlePaymentError(error);
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(request: RefundRequest): Promise<PaymentResponse> {
    try {
      const response = await this.httpClient.post<any>(
        `${this.config.baseUrl}/refund`,
        {
          transaction_id: request.transactionId,
          amount: request.amount,
          reason: request.reason,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.config.timeout || 30000,
        }
      );

      return {
        transactionId: response.data.transaction_id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        timestamp: new Date(response.data.timestamp),
        gatewayReference: response.data.gateway_reference,
      };
    } catch (error) {
      throw this.handlePaymentError(error);
    }
  }

  /**
   * Get health/availability of the payment gateway
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get(
        `${this.config.baseUrl}/health`,
        {
          timeout: 5000,
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get service health metrics
   */
  getHealthMetrics() {
    return {
      circuitBreaker: this.httpClient.getCircuitBreakerMetrics(),
      retry: this.httpClient.getRetryMetrics(),
    };
  }

  /**
   * Reset circuit breaker (useful for manual recovery)
   */
  resetCircuitBreaker(): void {
    this.httpClient.resetCircuitBreaker();
  }

  private handlePaymentError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(`Payment processing failed: ${String(error)}`);
  }
}
