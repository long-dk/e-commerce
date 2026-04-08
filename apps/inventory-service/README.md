# Inventory Service

A comprehensive inventory management microservice for the e-commerce platform, built with NestJS, MongoDB, GraphQL, and real-time WebSocket support.

## Features

### Core Inventory Management
- **Product Inventory Tracking**: Track stock levels, reserved quantities, and availability
- **Stock Status Management**: Automatic status calculation (In Stock, Low Stock, Out of Stock)
- **Reorder Point Management**: Configurable reorder points with automatic alerts
- **Stock Movement History**: Complete audit trail of all inventory changes
- **Multi-Location Support**: Warehouse, shelf, and bin location tracking

### Real-Time Features
- **WebSocket Notifications**: Real-time inventory updates and alerts
- **GraphQL Subscriptions**: Subscribe to inventory changes and alerts
- **Live Stock Monitoring**: Real-time stock level monitoring across the platform

### Business Logic
- **Stock Reservations**: Reserve stock for pending orders
- **Stock Adjustments**: Increase/decrease inventory with full audit trail
- **Availability Checking**: Check stock availability for orders
- **Bulk Operations**: Check multiple products' availability simultaneously

### Integration
- **Kafka Event Integration**: Publish/subscribe to inventory events
- **Order Integration**: Automatic stock reservation/release for orders
- **Payment Integration**: Stock restoration on payment refunds
- **Product Integration**: Sync with product catalog changes

## Architecture

### Tech Stack
- **Framework**: NestJS 10.2.10
- **Database**: MongoDB with Mongoose ODM
- **API**: GraphQL with Apollo Server
- **Real-Time**: Socket.IO WebSocket Gateway
- **Events**: Kafka for inter-service communication
- **Language**: TypeScript

### Data Models

#### Inventory Entity
```typescript
{
  _id: ObjectId,
  productId: string,           // Reference to product catalog
  sku: string,                // Stock Keeping Unit
  productName: string,        // Cached product name
  quantity: number,           // Current stock quantity
  reservedQuantity: number,   // Reserved for pending orders
  availableQuantity: number,  // Computed: quantity - reservedQuantity
  reorderPoint: number,       // Minimum stock level before reorder
  maxStock: number,           // Maximum stock capacity
  minStock: number,           // Minimum stock level
  status: InventoryStatus,    // IN_STOCK | LOW_STOCK | OUT_OF_STOCK
  unitCost: number,           // Cost per unit
  totalValue: number,         // Computed: quantity * unitCost
  location: string,           // Physical location
  warehouse: string,          // Warehouse name
  shelf: string,              // Shelf location
  bin: string,                // Bin location
  dimensions: string,         // Product dimensions
  weight: number,             // Product weight
  categories: string[],       // Product categories
  tags: string[],             // Product tags
  supplierInfo: string,       // Supplier information
  isActive: boolean,          // Active inventory tracking
  trackInventory: boolean,    // Enable inventory tracking
  lastStockUpdate: Date,      // Last stock change
  lastReorderDate: Date,      // Last reorder date
  metadata: string,           // Additional data (JSON)
  createdAt: Date,
  updatedAt: Date
}
```

#### Stock Movement Entity
```typescript
{
  _id: ObjectId,
  productId: string,
  inventoryId: ObjectId,
  movementType: StockMovementType,
  quantity: number,           // Change amount (+/-)
  previousQuantity: number,   // Stock before movement
  newQuantity: number,        // Stock after movement
  reference: string,          // Order/Payment ID
  referenceType: string,      // 'order', 'payment', 'manual'
  reason: string,             // Movement reason
  performedBy: string,        // User/system that performed action
  location: string,           // Location of movement
  notes: string,              // Additional notes
  metadata: string,           // Additional data (JSON)
  createdAt: Date,
  updatedAt: Date
}
```

## API

### GraphQL Endpoints

#### Queries
```graphql
# Get inventory item
query GetInventory($id: ID!) {
  inventory(id: $id) {
    _id
    productId
    sku
    productName
    quantity
    availableQuantity
    status
    reorderPoint
    needsReorder
  }
}

# List inventory with filters
query GetInventoryList($filters: InventoryFilters, $limit: Int, $offset: Int) {
  inventoryList(filters: $filters, limit: $limit, offset: $offset) {
    inventory {
      _id
      productId
      productName
      quantity
      availableQuantity
      status
    }
    totalCount
    hasMore
  }
}

# Get inventory summary
query GetInventorySummary {
  inventorySummary {
    totalProducts
    inStock
    lowStock
    outOfStock
    totalValue
    needsReorder
  }
}

# Check stock availability
query CheckStock($productId: String!, $quantity: Float!) {
  checkStock(productId: $productId, quantity: $quantity) {
    productId
    availableQuantity
    canFulfill
    status
    message
  }
}
```

#### Mutations
```graphql
# Create inventory
mutation CreateInventory($input: CreateInventoryInput!) {
  createInventory(input: $input) {
    _id
    productId
    quantity
    status
  }
}

# Update inventory
mutation UpdateInventory($input: UpdateInventoryInput!) {
  updateInventory(input: $input) {
    _id
    productId
    quantity
    status
  }
}

# Adjust stock
mutation AdjustStock($input: StockAdjustmentInput!) {
  adjustStock(input: $input) {
    _id
    quantity
    availableQuantity
    status
  }
}

# Reserve stock
mutation ReserveStock($input: ReserveStockInput!) {
  reserveStock(input: $input) {
    _id
    reservedQuantity
    availableQuantity
  }
}

# Release stock
mutation ReleaseStock($input: ReleaseStockInput!) {
  releaseStock(input: $input) {
    _id
    reservedQuantity
    availableQuantity
  }
}
```

#### Subscriptions
```graphql
# Subscribe to inventory updates
subscription OnInventoryUpdated($productId: String) {
  inventoryUpdated(productId: $productId) {
    _id
    productId
    quantity
    availableQuantity
    status
  }
}

# Subscribe to alerts
subscription OnLowStockAlert {
  lowStockAlert {
    _id
    productId
    quantity
    reorderPoint
  }
}
```

### WebSocket Events

#### Client Events
```javascript
// Subscribe to inventory updates
socket.emit('subscribeToInventory', {
  productIds: ['product-1', 'product-2'] // optional
});

// Subscribe to alerts
socket.emit('subscribeToAlerts');

// Get inventory status
socket.emit('getInventoryStatus', {
  productId: 'product-1'
});

// Check stock
socket.emit('checkStock', {
  productId: 'product-1',
  quantity: 5
});
```

#### Server Events
```javascript
// Inventory updates
socket.on('inventoryCreated', (data) => {
  console.log('New inventory created:', data.inventory);
});

socket.on('inventoryUpdated', (data) => {
  console.log('Inventory updated:', data.inventory);
});

// Alerts
socket.on('lowStockAlert', (data) => {
  console.log('Low stock alert:', data.inventory);
});

socket.on('outOfStockAlert', (data) => {
  console.log('Out of stock alert:', data.inventory);
});

socket.on('reorderAlert', (data) => {
  console.log('Reorder needed:', data.inventory);
});
```

## Kafka Events

### Consuming Events
- `order.created` - Reserve stock for new orders
- `order.cancelled` - Release reserved stock
- `order.shipped` - Convert reservations to actual stock reduction
- `payment.completed` - Handle payment completion
- `payment.refunded` - Restore stock on refunds

### Publishing Events
- `inventory.reservation.completed` - Stock reservation successful
- `inventory.reservation.failed` - Stock reservation failed
- `inventory.shipment.completed` - Stock shipment processed
- `inventory.refund.completed` - Stock refund processed
- `inventory.low_stock` - Low stock alert
- `inventory.out_of_stock` - Out of stock alert
- `inventory.reorder_needed` - Reorder needed alert

## Setup & Running

### Prerequisites
- Node.js 18+
- MongoDB 5+
- Kafka 2.8+
- Redis (optional, for GraphQL subscriptions)

### Installation
```bash
# Install dependencies
npm install

# Start MongoDB
mongod

# Start Kafka
# Follow Kafka setup instructions

# Start the service
npm run start:dev
```

### Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/inventory

# Kafka
KAFKA_BROKERS=localhost:9092

# JWT
JWT_SECRET=your-jwt-secret

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Demo Application
```bash
# Start demo app
npm run start:demo

# Access demo at http://localhost:3005
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

### Demo Scenarios
```bash
# Setup demo data
GET http://localhost:3005/demo/setup

# Run test scenarios
GET http://localhost:3005/demo/test-scenarios
```

## Monitoring & Alerts

### Stock Level Alerts
- **Low Stock**: When quantity ≤ reorderPoint
- **Out of Stock**: When quantity ≤ 0
- **Reorder Needed**: When quantity ≤ reorderPoint
- **Overstocked**: When quantity > maxStock
- **Understocked**: When quantity < minStock

### Real-Time Notifications
- WebSocket broadcasts for all inventory changes
- GraphQL subscriptions for targeted updates
- Kafka events for inter-service communication

### Dashboard Metrics
- Total products tracked
- Current stock levels
- Value of inventory
- Stock movement history
- Alert summaries

## Business Rules

### Stock Status Calculation
```typescript
if (quantity <= 0) return OUT_OF_STOCK;
if (quantity <= reorderPoint) return LOW_STOCK;
return IN_STOCK;
```

### Availability Calculation
```typescript
availableQuantity = quantity - reservedQuantity;
canFulfill = availableQuantity >= requestedQuantity;
```

### Stock Movement Types
- `STOCK_IN` - Stock received/increased
- `STOCK_OUT` - Stock removed/decreased
- `SALE` - Stock sold
- `RETURN` - Stock returned
- `ADJUSTMENT_IN` - Manual increase
- `ADJUSTMENT_OUT` - Manual decrease
- `DAMAGE` - Damaged stock
- `LOSS` - Lost stock
- `RESERVATION` - Stock reserved
- `RESERVATION_RELEASE` - Reservation released
- `INITIAL_STOCK` - Initial setup

## Performance Considerations

### Database Indexes
- `productId` (unique)
- `sku` (unique)
- `status`
- `isActive`
- `categories`
- `tags`
- `createdAt`, `updatedAt`

### Caching Strategy
- Redis for frequently accessed inventory data
- Cache invalidation on stock changes
- Aggregated data caching for summaries

### Scalability
- Horizontal scaling with MongoDB sharding
- Read replicas for high-traffic queries
- Kafka partitioning for event processing
- WebSocket clustering support

## Security

### Authentication
- JWT token validation for all API calls
- WebSocket authentication required
- User role-based access control

### Data Validation
- Input sanitization and validation
- Business rule enforcement
- Audit trail for all changes

### API Security
- CORS configuration
- Rate limiting
- Input validation pipes
- Error message sanitization

## Contributing

1. Follow TypeScript best practices
2. Add unit tests for new features
3. Update GraphQL schema documentation
4. Test WebSocket and Kafka integrations
5. Update this README for API changes

## License

MIT License - see LICENSE file for details.