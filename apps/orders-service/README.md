# Orders Service

A comprehensive order management microservice with real-time updates, GraphQL API, and event-driven architecture.

## Features

- ✅ **Order Lifecycle Management**: Complete order processing from creation to delivery
- ✅ **Real-time WebSocket Updates**: Live order status updates across all connected clients
- ✅ **GraphQL API**: Modern API with queries and mutations for order operations
- ✅ **PostgreSQL Integration**: Robust data persistence with TypeORM
- ✅ **Kafka Event Streaming**: Asynchronous communication with other services
- ✅ **Payment Integration**: Payment status tracking and processing
- ✅ **Shipping Management**: Tracking numbers and carrier integration
- ✅ **Order Analytics**: Status tracking and reporting capabilities

## Architecture

### Order States
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
    ↓         ↓           ↓          ↓         ↓
CANCELLED  CANCELLED   CANCELLED  DELIVERED  DELIVERED
```

### Payment States
```
PENDING → PAID
    ↓       ↓
 FAILED   REFUNDED
```

## Quick Start

### Prerequisites
- PostgreSQL database
- Kafka broker
- Node.js 18+

### Installation
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update database configuration in .env
```

### Start Service
```bash
# Development mode
npm run start:orders

# Service will be available at:
# - GraphQL API: http://localhost:4003/graphql
# - WebSocket: ws://localhost:4003/orders
```

## GraphQL API

### Queries

#### Get Orders
```graphql
query GetOrders($input: OrdersInput) {
  orders(input: $input) {
    id
    totalAmount
    status
    paymentStatus
    createdAt
    items {
      productName
      quantity
      price
      total
    }
  }
}
```

#### Get Single Order
```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    status
    paymentStatus
    shippingAddress {
      street
      city
      state
      zipCode
      country
    }
    items {
      productId
      productName
      quantity
      price
      total
    }
    canCancel
    canShip
    canDeliver
  }
}
```

#### Get Orders Count
```graphql
query GetOrdersCount($input: OrdersInput) {
  ordersCount(input: $input)
}
```

### Mutations

#### Create Order
```graphql
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    totalAmount
    status
    items {
      productId
      productName
      quantity
      price
    }
  }
}
```

#### Update Order
```graphql
mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) {
  updateOrder(id: $id, input: $input) {
    id
    notes
    shippingAddress {
      street
      city
      state
    }
  }
}
```

#### Order Status Changes
```graphql
# Cancel Order
mutation CancelOrder($id: ID!) {
  cancelOrder(id: $id) {
    id
    status
  }
}

# Confirm Order
mutation ConfirmOrder($id: ID!) {
  confirmOrder(id: $id) {
    id
    status
  }
}

# Ship Order
mutation ShipOrder($id: ID!, $trackingNumber: String, $carrier: String) {
  shipOrder(id: $id, trackingNumber: $trackingNumber, carrier: $carrier) {
    id
    status
    trackingNumber
    carrier
    shippedAt
  }
}

# Deliver Order
mutation DeliverOrder($id: ID!) {
  deliverOrder(id: $id) {
    id
    status
    deliveredAt
  }
}

# Process Refund
mutation ProcessRefund($id: ID!, $amount: Float) {
  processRefund(id: $id, amount: $amount) {
    id
    status
    paymentStatus
  }
}
```

## Real-Time WebSocket Events

### Authentication
```javascript
// Authenticate client
socket.emit('authenticate', { token: 'jwt-token' });

// Subscribe to user orders
socket.emit('subscribeToOrders');

// Subscribe to specific order
socket.emit('subscribeToOrder', { orderId: 'order-uuid' });
```

### Order Events
```javascript
// Listen for order events
socket.on('orderCreated', (data) => {
  console.log('New order:', data.order);
});

socket.on('orderUpdated', (data) => {
  console.log('Order updated:', data.order);
});

socket.on('orderConfirmed', (data) => {
  console.log('Order confirmed:', data.order);
});

socket.on('orderShipped', (data) => {
  console.log('Order shipped:', data.order);
});

socket.on('orderDelivered', (data) => {
  console.log('Order delivered:', data.order);
});

socket.on('paymentStatusUpdated', (data) => {
  console.log('Payment status:', data.paymentStatus);
});
```

## Kafka Events

### Published Events
- `order.created` - Order placed
- `order.confirmed` - Order confirmed
- `order.cancelled` - Order cancelled
- `order.shipped` - Order shipped
- `order.delivered` - Order delivered
- `order.refunded` - Refund processed

### Consumed Events
- `payment.processed` - Payment completion
- `inventory.reserved` - Inventory reservation
- `shipping.created` - Shipping label created

## Database Schema

### Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  notes TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100),
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  tracking_number VARCHAR(100),
  carrier VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_description TEXT,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  product_options JSONB,
  product_image VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### WebSocket Testing
```javascript
// Connect to WebSocket
const io = require('socket.io-client');
const socket = io('http://localhost:4003/orders');

// Test order creation
socket.emit('authenticate', { token: 'test-token' });
socket.on('authenticated', () => {
  socket.emit('subscribeToOrders');
});
```

## Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 4003

CMD ["npm", "run", "start:prod"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  orders-service:
    build: .
    ports:
      - "4003:4003"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/orders
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      - db
      - kafka
```

## Monitoring & Observability

### Health Checks
```graphql
query HealthCheck {
  __typename
}
```

### Metrics
- Order creation rate
- Order status distribution
- Payment success rate
- WebSocket connection count
- Kafka message throughput

### Logging
- Structured logging with correlation IDs
- Error tracking and alerting
- Performance monitoring
- Audit trail for order changes

## API Examples

### Create Order with Multiple Items
```javascript
const CREATE_ORDER = `
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      totalAmount
      status
      items {
        productName
        quantity
        price
        total
      }
    }
  }
`;

const variables = {
  input: {
    items: [
      {
        productId: "product-1",
        quantity: 2
      },
      {
        productId: "product-2",
        quantity: 1,
        discount: 5.00
      }
    ],
    shippingAddress: {
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zipCode: "12345",
      country: "USA"
    },
    notes: "Please handle with care"
  }
};
```

### Real-Time Order Tracking
```javascript
// Frontend implementation
import io from 'socket.io-client';

class OrderTracker {
  constructor(orderId) {
    this.orderId = orderId;
    this.socket = io('http://localhost:4003/orders');

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('authenticated', () => {
      this.socket.emit('subscribeToOrder', { orderId: this.orderId });
    });

    this.socket.on('orderUpdated', (data) => {
      this.updateOrderStatus(data.order);
    });

    this.socket.on('orderShipped', (data) => {
      this.showShippingInfo(data.order);
    });

    this.socket.on('orderDelivered', (data) => {
      this.showDeliveryConfirmation(data.order);
    });
  }

  authenticate(token) {
    this.socket.emit('authenticate', { token });
  }
}
```

## Security

- JWT authentication for API access
- WebSocket token-based authentication
- Input validation and sanitization
- SQL injection prevention with TypeORM
- Rate limiting for API endpoints
- CORS configuration for frontend access

## Performance

- Database indexing on frequently queried fields
- Connection pooling for PostgreSQL
- Redis caching for frequently accessed data
- Horizontal scaling with Kubernetes
- Message queuing for async operations

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Create feature branches
5. Submit pull requests

## License

This project is part of the E-Commerce Microservices platform.