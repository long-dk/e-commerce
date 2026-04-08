# Real-time Product Updates

The Products Service provides real-time updates via WebSocket connections using Socket.IO. This enables live synchronization of product data across all connected clients.

## WebSocket Gateway

**Namespace:** `/products`
**CORS:** Configured for frontend applications
**Port:** 4002 (configurable via `PRODUCTS_SERVICE_PORT`)

## Client Connection

### JavaScript/Node.js Client

```javascript
import io from 'socket.io-client';

// Connect to Products Service WebSocket
const socket = io('http://localhost:4002/products', {
  transports: ['websocket', 'polling'],
});

// Connection established
socket.on('connection', (data) => {
  console.log('Connected to Products Service:', data);
});

// Listen for global product events
socket.on('productCreated', (data) => {
  console.log('New product created:', data.product);
});

socket.on('productUpdated', (data) => {
  console.log('Product updated:', data.product);
});

socket.on('productDeleted', (data) => {
  console.log('Product deleted:', data.productId);
});

socket.on('stockUpdated', (data) => {
  console.log('Stock updated:', data);
});

socket.on('lowStockAlert', (data) => {
  console.log('Low stock alert:', data);
});
```

### React Client Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function ProductUpdates() {
  const [products, setProducts] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:4002/products');
    setSocket(newSocket);

    // Listen for product updates
    newSocket.on('productCreated', (data) => {
      setProducts(prev => [...prev, data.product]);
    });

    newSocket.on('productUpdated', (data) => {
      setProducts(prev => prev.map(p =>
        p.id === data.product.id ? data.product : p
      ));
    });

    newSocket.on('productDeleted', (data) => {
      setProducts(prev => prev.filter(p => p.id !== data.productId));
    });

    return () => newSocket.disconnect();
  }, []);

  return (
    <div>
      <h2>Real-time Product Updates</h2>
      {products.map(product => (
        <div key={product.id}>
          {product.name} - Stock: {product.stock}
        </div>
      ))}
    </div>
  );
}
```

## Subscription Features

### Subscribe to Specific Products

```javascript
// Subscribe to a specific product
socket.emit('subscribeToProduct', { productId: '507f1f77bcf86cd799439011' });

// Listen for updates to this specific product
socket.on('productUpdate', (data) => {
  console.log('Product update for subscribed item:', data);
});

// Unsubscribe when no longer needed
socket.emit('unsubscribeFromProduct', { productId: '507f1f77bcf86cd799439011' });
```

### Subscribe to Product Categories

```javascript
// Subscribe to a category
socket.emit('subscribeToCategory', { category: 'Electronics' });

// Listen for category-specific events
socket.on('categoryProductCreated', (data) => {
  console.log('New product in Electronics:', data.product);
});

socket.on('categoryProductUpdated', (data) => {
  console.log('Product updated in Electronics:', data.product);
});

// Unsubscribe from category
socket.emit('unsubscribeFromCategory', { category: 'Electronics' });
```

## Event Types

### Global Events (All Clients)

- **`productCreated`**: Fired when a new product is added
- **`productUpdated`**: Fired when any product is modified
- **`productDeleted`**: Fired when a product is removed
- **`stockUpdated`**: Fired when product stock levels change
- **`lowStockAlert`**: Fired when stock drops below minimum threshold

### Room-Specific Events

- **`productUpdate`**: Sent to clients subscribed to a specific product
- **`productStockUpdate`**: Stock updates for subscribed products
- **`categoryProductCreated`**: New products in subscribed categories
- **`categoryProductUpdated`**: Updates to products in subscribed categories
- **`categoryProductDeleted`**: Product deletions in subscribed categories

## Real-time Features

### Live Inventory Tracking

```javascript
socket.on('stockUpdated', (data) => {
  // Update UI immediately when stock changes
  updateProductStock(data.productId, data.newStock);

  if (data.reason === 'sale') {
    showPurchaseNotification(data.productId);
  }
});
```

### Low Stock Alerts

```javascript
socket.on('lowStockAlert', (data) => {
  // Show alert for products running low
  showLowStockAlert(data.productName, data.currentStock, data.minStockLevel);
});
```

### Real-time Product Search

```javascript
socket.on('productCreated', (data) => {
  // Add new products to search results immediately
  if (matchesCurrentSearch(data.product)) {
    addToSearchResults(data.product);
  }
});
```

## Server-Side Integration

The WebSocket gateway integrates with:

- **Kafka Events**: WebSocket events are triggered by Kafka messages
- **Database Changes**: Real-time updates when products are modified
- **Order Processing**: Stock updates from order placements/cancellations

## Configuration

### Environment Variables

```env
# Products Service
PRODUCTS_SERVICE_PORT=4002

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### Docker Configuration

The WebSocket port is exposed in docker-compose.yml for containerized deployments.

## Performance Considerations

- **Connection Limits**: Monitor concurrent WebSocket connections
- **Message Throttling**: Implement rate limiting for high-frequency updates
- **Room Management**: Use rooms efficiently to target specific client groups
- **Memory Usage**: Clean up disconnected clients and unused rooms

## Testing WebSocket Connections

### Using Browser Developer Tools

1. Open browser DevTools → Network tab
2. Connect to WebSocket at `ws://localhost:4002/products`
3. Send subscription messages via Console

### Using WebSocket Test Tools

```bash
# Using wscat (install with npm install -g wscat)
wscat -c ws://localhost:4002/products

# Send subscription message
{"type": "subscribeToProduct", "productId": "507f1f77bcf86cd799439011"}
```

## Error Handling

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
  // Implement reconnection logic
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Handle reconnection
});
```

## Security Considerations

- **CORS Configuration**: Restrict origins in production
- **Authentication**: Implement token-based authentication for WebSocket connections
- **Rate Limiting**: Prevent abuse with connection and message limits
- **Input Validation**: Validate all incoming subscription messages