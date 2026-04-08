export interface PaymentGateway {
  name: string;

  processPayment(
    paymentData: PaymentData,
    paymentMethod: PaymentMethod,
  ): Promise<PaymentResult>;

  refundPayment(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<RefundResult>;

  validatePaymentMethod(paymentMethodData: any): Promise<boolean>;
}

export interface PaymentData {
  amount: number;
  currency: string;
  paymentMethodData: any;
  orderId: string;
  userId: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  gatewayResponse?: any;
  errorMessage?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  gatewayResponse?: any;
  errorMessage?: string;
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
}

// Example Stripe Gateway Implementation
export class StripeGateway implements PaymentGateway {
  name = 'stripe';

  async processPayment(paymentData: PaymentData, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Implementation would integrate with Stripe API
    // This is a placeholder for the actual implementation
    return {
      success: true,
      transactionId: `stripe_${Date.now()}`,
      gatewayResponse: { status: 'succeeded' },
    };
  }

  async refundPayment(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    // Implementation would integrate with Stripe API
    return {
      success: true,
      refundId: `refund_${Date.now()}`,
      gatewayResponse: { status: 'succeeded' },
    };
  }

  async validatePaymentMethod(paymentMethodData: any): Promise<boolean> {
    // Validate payment method data
    return true;
  }
}

// Example PayPal Gateway Implementation
export class PayPalGateway implements PaymentGateway {
  name = 'paypal';

  async processPayment(paymentData: PaymentData, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Implementation would integrate with PayPal API
    return {
      success: true,
      transactionId: `paypal_${Date.now()}`,
      gatewayResponse: { status: 'COMPLETED' },
    };
  }

  async refundPayment(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    // Implementation would integrate with PayPal API
    return {
      success: true,
      refundId: `paypal_refund_${Date.now()}`,
      gatewayResponse: { status: 'COMPLETED' },
    };
  }

  async validatePaymentMethod(paymentMethodData: any): Promise<boolean> {
    // Validate payment method data
    return true;
  }
}