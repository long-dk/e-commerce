# Shipping Service

The Shipping Service manages order fulfillment and delivery tracking for the e-commerce platform.

## Features

- **Shipment Management**: Create, update, and track shipments
- **Real-time Updates**: WebSocket notifications for shipment status changes
- **Event Integration**: Kafka integration for order lifecycle events
- **GraphQL API**: Full GraphQL schema for queries, mutations, and subscriptions
- **Status Tracking**: Comprehensive shipment status management

## Architecture

The service follows the same microservice pattern as other services in the platform:

- **Entity**: TypeORM entity for database persistence
- **Types**: GraphQL type definitions
- **Service**: Business logic layer
- **Resolver**: GraphQL resolvers
- **Gateway**: WebSocket gateway for real-time updates
- **Kafka Handler**: Event-driven integration

## API

### GraphQL Queries

```graphql
query GetShipment($id: ID!) {
  getShipment(id: $id) {
    id
    orderId
    status
    carrier
    trackingNumber
    shippedAt
    deliveredAt
    isActive
    isComplete
  }
}

query GetShipments($filters: ShipmentFilters, $pagination: PaginationInput) {
  getShipments(filters: $filters, pagination: $pagination) {
    items {
      id
      orderId
      status
      carrier
      trackingNumber
    }
    total
    page
    limit
  }
}
```

### GraphQL Mutations

```graphql
mutation CreateShipment($input: CreateShipmentInput!) {
  createShipment(input: $input) {
    id
    orderId
    status
  }
}

mutation UpdateShipment($id: ID!, $input: UpdateShipmentInput!) {
  updateShipment(id: $id, input: $input) {
    id
    status
  }
}

mutation MarkAsShipped($id: ID!) {
  markAsShipped(id: $id) {
    id
    status
    shippedAt
  }
}
```

### GraphQL Subscriptions

```graphql
subscription OnShipmentCreated {
  shipmentCreated {
    id
    orderId
    status
  }
}

subscription OnShipmentUpdated {
  shipmentUpdated {
    id
    status
  }
}
```

## WebSocket Events

The service provides real-time updates via WebSocket:

- `shipOrder`: Ship an order
- `trackShipment`: Get real-time tracking updates

## Kafka Events

The service listens to and publishes Kafka events:

### Consumes:
- `order.shipped`: Triggered when an order is ready for shipping
- `order.delivered`: Updates shipment status when order is delivered
- `order.cancelled`: Cancels shipment when order is cancelled

### Publishes:
- `shipment.created`: When a new shipment is created
- `shipment.shipped`: When a shipment is marked as shipped
- `shipment.delivered`: When a shipment is marked as delivered

## Running the Service

### Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Run demo app
npm run demo
```

### Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## Demo Endpoints

The demo app provides REST endpoints for testing:

- `GET /demo/shipping` - Get all shipments
- `GET /demo/shipping/:id` - Get shipment by ID
- `POST /demo/shipping` - Create new shipment
- `POST /demo/shipping/:id/update` - Update shipment
- `POST /demo/shipping/:id/ship` - Mark shipment as shipped
- `POST /demo/shipping/:id/deliver` - Mark shipment as delivered
- `GET /demo/shipping/status/:status` - Get shipments by status

## Database Schema

The shipment entity includes:

- `id`: Unique identifier
- `orderId`: Reference to the order
- `status`: Current shipping status (PENDING, SHIPPED, DELIVERED, CANCELLED)
- `carrier`: Shipping carrier (FedEx, UPS, USPS, etc.)
- `trackingNumber`: Tracking number for the shipment
- `shippedAt`: Timestamp when shipped
- `deliveredAt`: Timestamp when delivered
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Integration

The shipping service integrates with:

- **Inventory Service**: Consumes inventory events to trigger shipping
- **Order Service**: Receives order events for fulfillment
- **Notification Service**: Publishes events for customer notifications

## Configuration

The service requires:

- PostgreSQL database connection
- Kafka broker connection
- JWT authentication (via shared library)

Environment variables and configuration are managed through the NestJS ConfigModule.