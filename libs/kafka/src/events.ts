// User events
export interface UserRegisteredEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

export interface UserDeletedEvent {
  userId: string;
  deletedAt: Date;
}

// Order events
export interface OrderPlacedEvent {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  createdAt?: Date;
}

export interface OrderCancelledEvent {
  orderId: string;
  userId: string;
  cancelledAt?: Date;
  reason?: string;
}

// Payment events
export interface PaymentCompletedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  completedAt?: Date;
}

export interface PaymentFailedEvent {
  paymentId: string;
  orderId: string;
  reason: string;
  failedAt: Date;
}

// Product events
export interface ProductCreatedEvent {
  productId: string;
  name: string;
  category: string;
  price: number;
  createdAt: Date;
}

export interface ProductUpdatedEvent {
  productId: string;
  name: string;
  category: string;
  price: number;
  updatedAt: Date;
}

export interface ProductDeletedEvent {
  productId: string;
  deletedAt: Date;
}

// Inventory events
export interface InventoryUpdatedEvent {
  productId: string;
  quantity: number;
  reserved: number;
  updatedAt: Date;
}

// Shipping events
export interface ShippingCreatedEvent {
  shipmentId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  createdAt: Date;
}

export interface ShippingUpdatedEvent {
  shipmentId: string;
  status: string;
  updatedAt: Date;
  trackingInfo?: string;
}
