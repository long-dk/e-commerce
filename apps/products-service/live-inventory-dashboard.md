# Live Inventory Dashboard

A real-time inventory management dashboard that displays live product stock levels, low stock alerts, and inventory analytics.

## Features

- **Real-time Stock Updates**: Live inventory levels across all products
- **Low Stock Alerts**: Visual indicators for products below minimum stock levels
- **Category Analytics**: Stock distribution by product categories
- **Recent Activity**: Live feed of inventory changes
- **Multi-client Sync**: Dashboard stays synchronized across multiple browser tabs

## Implementation

### Backend Integration

The dashboard connects to the Products Service WebSocket for real-time updates:

```javascript
// dashboard.js
import io from 'socket.io-client';

class InventoryDashboard {
  constructor() {
    this.socket = io('http://localhost:4002/products');
    this.products = new Map();
    this.alerts = [];
    this.setupSocketListeners();
    this.initializeDashboard();
  }

  setupSocketListeners() {
    // Global stock updates
    this.socket.on('stockUpdated', (data) => {
      this.updateProductStock(data.productId, data.newStock, data.reason);
      this.updateActivityFeed(data);
    });

    // Low stock alerts
    this.socket.on('lowStockAlert', (alert) => {
      this.showLowStockAlert(alert);
      this.updateAlertCounter();
    });

    // Product changes
    this.socket.on('productCreated', (data) => {
      this.addNewProduct(data.product);
    });

    this.socket.on('productUpdated', (data) => {
      this.updateProductInfo(data.product);
    });

    this.socket.on('productDeleted', (data) => {
      this.removeProduct(data.productId);
    });
  }

  updateProductStock(productId, newStock, reason) {
    const product = this.products.get(productId);
    if (product) {
      const oldStock = product.stock;
      product.stock = newStock;

      // Update UI
      this.updateStockDisplay(productId, newStock);

      // Visual feedback for stock changes
      this.animateStockChange(productId, oldStock, newStock, reason);
    }
  }

  showLowStockAlert(alert) {
    this.alerts.unshift({
      ...alert,
      timestamp: new Date(),
      acknowledged: false
    });

    // Show notification
    this.displayAlertNotification(alert);

    // Update dashboard alert counter
    this.updateAlertCounter();
  }

  updateActivityFeed(data) {
    const activity = {
      type: 'stock_update',
      productId: data.productId,
      message: `Stock ${data.reason}: ${data.previousStock} → ${data.newStock}`,
      timestamp: new Date(data.timestamp)
    };

    this.addActivityItem(activity);
  }
}
```

### Frontend Dashboard

```html
<!-- inventory-dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Inventory Dashboard</title>
    <link rel="stylesheet" href="dashboard.css">
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>Live Inventory Dashboard</h1>
            <div class="alerts-indicator">
                <span id="alert-count">0</span> Alerts
            </div>
        </header>

        <div class="dashboard-grid">
            <div class="stats-panel">
                <div class="stat-card">
                    <h3>Total Products</h3>
                    <span id="total-products">0</span>
                </div>
                <div class="stat-card">
                    <h3>Low Stock Items</h3>
                    <span id="low-stock-count">0</span>
                </div>
                <div class="stat-card">
                    <h3>Out of Stock</h3>
                    <span id="out-of-stock-count">0</span>
                </div>
            </div>

            <div class="products-panel">
                <h2>Product Inventory</h2>
                <div class="product-filters">
                    <select id="category-filter">
                        <option value="">All Categories</option>
                    </select>
                    <input type="text" id="search-input" placeholder="Search products...">
                </div>
                <div id="products-list" class="products-list">
                    <!-- Products will be dynamically added here -->
                </div>
            </div>

            <div class="activity-panel">
                <h2>Recent Activity</h2>
                <div id="activity-feed" class="activity-feed">
                    <!-- Activity items will be added here -->
                </div>
            </div>

            <div class="alerts-panel">
                <h2>Stock Alerts</h2>
                <div id="alerts-list" class="alerts-list">
                    <!-- Alerts will be displayed here -->
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="dashboard.js"></script>
</body>
</html>
```

### CSS Styling

```css
/* dashboard.css */
.dashboard {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}

.alerts-indicator {
    background: #ff4444;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: auto 1fr;
    gap: 20px;
}

.stats-panel {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
}

.stat-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

.stat-card h3 {
    margin: 0 0 10px 0;
    color: #666;
    font-size: 14px;
}

.stat-card span {
    font-size: 32px;
    font-weight: bold;
    color: #333;
}

.products-panel, .activity-panel, .alerts-panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
}

.product-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.3s;
}

.product-item:hover {
    background-color: #f8f9fa;
}

.product-info h4 {
    margin: 0 0 5px 0;
    color: #333;
}

.product-info .category {
    color: #666;
    font-size: 14px;
}

.stock-info {
    text-align: right;
}

.stock-level {
    font-size: 18px;
    font-weight: bold;
}

.stock-level.low-stock {
    color: #ff6b35;
}

.stock-level.out-of-stock {
    color: #d63031;
}

.stock-level.good-stock {
    color: #00b894;
}

.activity-item {
    padding: 10px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
}

.activity-item .timestamp {
    color: #666;
    font-size: 12px;
}

.alert-item {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 10px;
}

.alert-item.unacknowledged {
    background: #ffeaa7;
    border-color: #d63031;
}

.alert-message {
    font-weight: bold;
    color: #d63031;
}

.alert-details {
    margin-top: 5px;
    color: #666;
    font-size: 14px;
}

/* Animations */
@keyframes stockChange {
    0% { background-color: #74b9ff; }
    50% { background-color: #0984e3; }
    100% { background-color: transparent; }
}

.stock-change-animation {
    animation: stockChange 2s ease-out;
}

@keyframes alertPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

.alert-pulse {
    animation: alertPulse 0.5s ease-in-out;
}
```

## Usage

1. **Start the Products Service:**
   ```bash
   npm run start:products
   ```

2. **Open the dashboard in multiple browser tabs:**
   ```bash
   # Serve the HTML file (using a simple HTTP server)
   npx http-server . -p 8080
   ```

3. **Test real-time updates:**
   - Make changes via GraphQL API
   - Watch inventory update in real-time across all tabs
   - See low stock alerts appear instantly

## API Integration

The dashboard integrates with the Products Service GraphQL API for initial data loading:

```graphql
query GetInventoryDashboard {
  products(input: { limit: 1000 }) {
    products {
      id
      name
      category
      stock
      minStockLevel
      price
    }
    total
  }

  categories
}
```

This creates a comprehensive live inventory management system with real-time updates, alerts, and multi-client synchronization.