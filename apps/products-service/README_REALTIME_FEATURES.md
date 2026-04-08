# Real-Time E-Commerce Features

This document demonstrates the live inventory dashboards, real-time shopping experiences, instant stock alerts, and seamless multi-client synchronization features implemented in the e-commerce microservices platform.

## 🚀 Quick Start

### Prerequisites

1. **Start the Products Service:**
   ```bash
   npm run start:products
   ```

2. **Start HTTP Server for Demos:**
   ```bash
   npx http-server . -p 8080
   ```

3. **Run the Interactive Demo:**
   ```bash
   npm run demo:realtime
   ```

## 📊 Live Inventory Dashboard

A comprehensive real-time inventory management system with live stock updates, alerts, and analytics.

### Features
- ✅ Real-time stock level monitoring
- ✅ Low stock alerts with visual indicators
- ✅ Category-based inventory analytics
- ✅ Live activity feed
- ✅ Multi-client synchronization

### Demo
```bash
# Open in browser
open http://localhost:8080/live-inventory-dashboard.html
```

### GraphQL Testing
```graphql
# Create test products
mutation CreateProduct($input: CreateProductInput!) {
  createProduct(input: $input) {
    id name stock category
  }
}

# Update stock to trigger alerts
mutation UpdateStock($id: ID!, $stock: Int!) {
  updateProductStock(id: $id, stock: $stock) {
    id stock
  }
}
```

## 🛒 Real-Time Shopping Experience

An immersive shopping experience where carts update automatically when inventory changes.

### Features
- ✅ Live cart synchronization
- ✅ Real-time stock availability
- ✅ Instant out-of-stock notifications
- ✅ Automatic cart adjustments
- ✅ Multi-user cart consistency

### Demo
```bash
# Open in browser
open http://localhost:8080/realtime-shopping-experience.html
```

### Key Features Demonstrated
- Add items to cart and watch stock changes affect availability
- See real-time alerts when items go out of stock
- Experience seamless checkout prevention for unavailable items

## ⚡ Instant Stock Alerts

A comprehensive alert system for inventory management with multi-channel notifications.

### Features
- ✅ Real-time stock monitoring
- ✅ Configurable alert thresholds
- ✅ Multi-channel notifications (WebSocket, Email, SMS)
- ✅ Alert prioritization (Critical, High, Medium, Low)
- ✅ Alert acknowledgment system

### Demo
```bash
# Open in browser
open http://localhost:8080/alerts-dashboard.html
```

### Alert Types
- **Critical**: Stock at 0 (Out of Stock)
- **High**: Stock ≤ 5 units
- **Medium**: Stock ≤ 10 units
- **Low**: Stock ≤ 25 units

## 🔄 Multi-Client Synchronization

Demonstrates seamless synchronization across multiple browser tabs and clients.

### Features
- ✅ Cross-tab real-time updates
- ✅ Client connection tracking
- ✅ Live user activity monitoring
- ✅ Instant data consistency
- ✅ Connection status indicators

### Demo
```bash
# Open in multiple browser tabs
open http://localhost:8080/multi-client-sync.html
```

### Test Synchronization
1. Open the demo in multiple tabs
2. Add products in one tab
3. Watch them appear instantly in other tabs
4. Update stock and see real-time synchronization
5. Monitor client join/leave events

## 🛠️ Technical Implementation

### WebSocket Architecture

```typescript
// Product Gateway with real-time events
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/products',
})
export class ProductGateway {
  // Global events
  emitProductCreated(product: any)
  emitProductUpdated(product: any)
  emitProductDeleted(productId: string, category: string)
  emitStockUpdated(data: StockUpdateData)
  emitLowStockAlert(alert: StockAlert)

  // Room-based messaging
  @SubscribeMessage('subscribeToProduct')
  handleSubscribeToProduct(@MessageBody() data: { productId: string })

  @SubscribeMessage('subscribeToCategory')
  handleSubscribeToCategory(@MessageBody() data: { category: string })
}
```

### Real-Time Event Flow

```
GraphQL Mutation → ProductService → ProductGateway → WebSocket Clients
      ↓                    ↓              ↓               ↓
   Database Update → Event Emission → Real-time Update → UI Refresh
```

### Alert System Architecture

```typescript
interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStockLevel: number;
  alertType: 'low_stock' | 'out_of_stock' | 'critical';
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: ('websocket' | 'email' | 'sms')[];
  acknowledged: boolean;
}
```

## 📈 Performance & Scalability

### WebSocket Optimization
- **Room-based messaging**: Targeted updates reduce network traffic
- **Event buffering**: Prevents message flooding during bulk operations
- **Connection pooling**: Efficient client management
- **Heartbeat monitoring**: Automatic disconnection handling

### Database Integration
- **Change streams**: MongoDB change streams for real-time data sync
- **Event sourcing**: Kafka integration for reliable event publishing
- **Caching**: Redis integration for high-performance data access

### Monitoring & Analytics
- **Real-time metrics**: Connection counts, event rates, latency
- **Error tracking**: Failed deliveries and connection issues
- **Performance monitoring**: Memory usage and CPU utilization

## 🔧 Configuration

### Environment Variables

```env
# WebSocket Configuration
PRODUCTS_SERVICE_PORT=4002
FRONTEND_URL=http://localhost:3000

# Alert System
ALERT_CRITICAL_THRESHOLD=0
ALERT_LOW_THRESHOLD=5
ALERT_MEDIUM_THRESHOLD=10
ALERT_HIGH_THRESHOLD=25
ALERT_EMAIL_RECIPIENTS=admin@company.com,manager@company.com
```

### Alert Thresholds

Customize alert sensitivity in `alert.service.ts`:

```typescript
private alertThresholds = {
  critical: 0,    // Out of stock
  low: 5,         // Very low stock
  medium: 10,     // Low stock
  high: 25        // Monitor stock
};
```

## 🧪 Testing

### WebSocket Testing
```bash
# Run WebSocket tests
npm run test:websocket
```

### Interactive Demo
```bash
# Run comprehensive demo
npm run demo:realtime
```

### Manual Testing
```bash
# Test with curl
curl -X POST http://localhost:4002/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createProduct(input: { name: \"Test Product\", stock: 3 }) { id name stock } }"
  }'
```

## 📚 API Reference

### WebSocket Events

#### Outgoing Events (Server → Client)
- `productCreated` - New product added
- `productUpdated` - Product modified
- `productDeleted` - Product removed
- `stockUpdated` - Stock level changed
- `lowStockAlert` - Stock alert triggered
- `clientJoined` - New client connected
- `clientLeft` - Client disconnected

#### Incoming Events (Client → Server)
- `subscribeToProduct` - Subscribe to product updates
- `subscribeToCategory` - Subscribe to category updates
- `acknowledgeAlert` - Acknowledge stock alert
- `registerClient` - Register client for tracking

### GraphQL Mutations

```graphql
# Product Management
mutation CreateProduct($input: CreateProductInput!) {
  createProduct(input: $input) {
    id name stock category price
  }
}

mutation UpdateProductStock($id: ID!, $stock: Int!) {
  updateProductStock(id: $id, stock: $stock) {
    id stock
  }
}

# Alert Management
mutation AcknowledgeAlert($alertId: ID!) {
  acknowledgeAlert(alertId: $alertId) {
    success message
  }
}
```

## 🚀 Production Deployment

### Docker Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  products-service:
    build: ./apps/products-service
    ports:
      - "4002:4002"
    environment:
      - NODE_ENV=production
      - FRONTEND_URL=https://yourapp.com
    depends_on:
      - mongodb
      - kafka
```

### Kubernetes Deployment
```yaml
# products-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: products-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: products-service
  template:
    metadata:
      labels:
        app: products-service
    spec:
      containers:
      - name: products-service
        image: your-registry/products-service:latest
        ports:
        - containerPort: 4002
        env:
        - name: FRONTEND_URL
          value: "https://yourapp.com"
```

### Load Balancing
- Use Redis adapter for Socket.IO clustering
- Implement sticky sessions for WebSocket connections
- Configure horizontal scaling with Kubernetes

## 🔍 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
```bash
# Check service status
curl http://localhost:4002/health

# Verify CORS settings
# Check FRONTEND_URL environment variable
```

**Alerts Not Triggering**
```bash
# Verify alert thresholds
# Check email configuration
# Test WebSocket connection
npm run test:websocket
```

**Multi-Client Sync Issues**
```bash
# Check client registration
# Verify room subscriptions
# Test with single client first
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=socket.io:* npm run start:products

# Monitor WebSocket events
npm run demo:realtime
```

## 🎯 Next Steps

1. **Enhanced Analytics**: Add real-time sales tracking and inventory turnover metrics
2. **Mobile Support**: Implement React Native WebSocket client
3. **Push Notifications**: Add browser push notifications for critical alerts
4. **Advanced Filtering**: Category-based and role-based alert subscriptions
5. **Audit Trail**: Complete history of inventory changes and alert responses

---

## 📞 Support

For questions or issues with the real-time features:

1. Check the [WebSocket Testing Guide](test-websocket.js)
2. Run the [Interactive Demo](demo-realtime-features.js)
3. Review [Real-Time Updates Documentation](REALTIME_UPDATES.md)
4. Check service logs and WebSocket connection status

The real-time e-commerce platform provides enterprise-grade real-time capabilities with seamless multi-client synchronization, instant alerts, and live inventory management.