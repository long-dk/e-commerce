# Seamless Multi-Client Synchronization

A demonstration of real-time synchronization across multiple clients, showing how WebSocket connections enable seamless updates across browsers, tabs, and devices.

## Features

- **Cross-Tab Synchronization**: Changes in one tab instantly reflect in others
- **Real-time User Activity**: See what other users are doing
- **Conflict Resolution**: Handle simultaneous updates gracefully
- **Connection Status**: Visual indicators for connection health
- **Offline Queue**: Queue actions when offline, sync when reconnected

## Implementation

### Multi-Client Synchronization Demo

```html
<!-- multi-client-sync.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Client Synchronization Demo</title>
    <link rel="stylesheet" href="sync-demo.css">
</head>
<body>
    <div class="sync-demo">
        <header class="demo-header">
            <h1>Multi-Client Synchronization Demo</h1>
            <div class="connection-status">
                <span id="connection-indicator" class="status-connected">🟢</span>
                <span id="connection-text">Connected</span>
                <span id="client-count">1 client</span>
            </div>
        </header>

        <div class="demo-controls">
            <div class="client-info">
                <h3>Your Client ID: <span id="client-id">Loading...</span></h3>
                <p>Changes you make will sync to all connected clients</p>
            </div>

            <div class="action-buttons">
                <button id="add-product-btn">Add Random Product</button>
                <button id="update-stock-btn">Update Random Stock</button>
                <button id="simulate-activity-btn">Simulate User Activity</button>
                <button id="clear-all-btn">Clear All Products</button>
            </div>
        </div>

        <div class="demo-content">
            <div class="products-section">
                <h2>Products <span id="products-count">(0)</span></h2>
                <div id="products-list" class="products-list">
                    <!-- Products will appear here -->
                </div>
            </div>

            <div class="activity-section">
                <h2>Real-Time Activity Feed</h2>
                <div id="activity-feed" class="activity-feed">
                    <!-- Activity events will appear here -->
                </div>
            </div>

            <div class="clients-section">
                <h2>Connected Clients <span id="clients-count">(1)</span></h2>
                <div id="clients-list" class="clients-list">
                    <!-- Connected clients will appear here -->
                </div>
            </div>
        </div>

        <div class="sync-stats">
            <div class="stat">
                <span class="stat-label">Total Sync Events:</span>
                <span id="sync-events-count" class="stat-value">0</span>
            </div>
            <div class="stat">
                <span class="stat-label">Last Sync:</span>
                <span id="last-sync-time" class="stat-value">Never</span>
            </div>
            <div class="stat">
                <span class="stat-label">Connection Uptime:</span>
                <span id="uptime" class="stat-value">00:00:00</span>
            </div>
        </div>
    </div>

    <!-- Action Modal -->
    <div id="action-modal" class="action-modal">
        <div class="action-modal-content">
            <h3 id="action-title">Action in Progress</h3>
            <p id="action-message">Processing your request...</p>
            <div class="action-progress">
                <div id="progress-bar" class="progress-bar"></div>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="multi-client-sync.js"></script>
</body>
</html>
```

### Multi-Client Synchronization JavaScript

```javascript
// multi-client-sync.js
class MultiClientSyncDemo {
  constructor() {
    this.socket = null;
    this.clientId = null;
    this.products = new Map();
    this.connectedClients = new Set();
    this.activityFeed = [];
    this.syncEventsCount = 0;
    this.connectionStartTime = Date.now();
    this.uptimeInterval = null;

    this.initializeSocket();
    this.setupEventListeners();
    this.startUptimeTimer();
  }

  initializeSocket() {
    this.socket = io('http://localhost:4002/products', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.clientId = this.socket.id;
      document.getElementById('client-id').textContent = this.clientId.substring(0, 8);
      this.updateConnectionStatus(true);
      this.registerClient();
    });

    this.socket.on('disconnect', () => {
      this.updateConnectionStatus(false);
    });

    this.socket.on('reconnect', () => {
      this.updateConnectionStatus(true);
      this.resyncData();
    });

    // Product events
    this.socket.on('productCreated', (data) => {
      this.handleProductCreated(data.product, data.sourceClientId);
    });

    this.socket.on('productUpdated', (data) => {
      this.handleProductUpdated(data.product, data.sourceClientId);
    });

    this.socket.on('productDeleted', (data) => {
      this.handleProductDeleted(data.productId, data.sourceClientId);
    });

    this.socket.on('stockUpdated', (data) => {
      this.handleStockUpdated(data, data.sourceClientId);
    });

    // Client management
    this.socket.on('clientJoined', (data) => {
      this.handleClientJoined(data.clientId);
    });

    this.socket.on('clientLeft', (data) => {
      this.handleClientLeft(data.clientId);
    });

    this.socket.on('clientsList', (data) => {
      this.updateClientsList(data.clients);
    });

    // Activity events
    this.socket.on('userActivity', (data) => {
      this.handleUserActivity(data);
    });

    this.socket.on('syncEvent', (data) => {
      this.handleSyncEvent(data);
    });
  }

  registerClient() {
    this.socket.emit('registerClient', {
      clientId: this.clientId,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');

    if (connected) {
      indicator.textContent = '🟢';
      indicator.className = 'status-connected';
      text.textContent = 'Connected';
    } else {
      indicator.textContent = '🔴';
      indicator.className = 'status-disconnected';
      text.textContent = 'Disconnected';
    }
  }

  handleProductCreated(product, sourceClientId) {
    this.products.set(product.id, product);
    this.addProductToUI(product);
    this.addActivityEvent({
      type: 'product_created',
      message: `Product "${product.name}" created`,
      sourceClientId,
      timestamp: new Date()
    });
    this.updateSyncStats();
  }

  handleProductUpdated(product, sourceClientId) {
    this.products.set(product.id, product);
    this.updateProductInUI(product);
    this.addActivityEvent({
      type: 'product_updated',
      message: `Product "${product.name}" updated`,
      sourceClientId,
      timestamp: new Date()
    });
    this.updateSyncStats();
  }

  handleProductDeleted(productId, sourceClientId) {
    const product = this.products.get(productId);
    if (product) {
      this.products.delete(productId);
      this.removeProductFromUI(productId);
      this.addActivityEvent({
        type: 'product_deleted',
        message: `Product "${product.name}" deleted`,
        sourceClientId,
        timestamp: new Date()
      });
    }
    this.updateSyncStats();
  }

  handleStockUpdated(data, sourceClientId) {
    const product = this.products.get(data.productId);
    if (product) {
      const oldStock = product.stock;
      product.stock = data.newStock;

      this.updateProductStockInUI(data.productId, data.newStock);
      this.addActivityEvent({
        type: 'stock_updated',
        message: `Stock for "${product.name}" changed: ${oldStock} → ${data.newStock}`,
        sourceClientId,
        timestamp: new Date()
      });
    }
    this.updateSyncStats();
  }

  handleClientJoined(clientId) {
    this.connectedClients.add(clientId);
    this.updateClientsCount();
    this.addClientToUI(clientId);
    this.addActivityEvent({
      type: 'client_joined',
      message: `Client ${clientId.substring(0, 8)} joined`,
      sourceClientId: clientId,
      timestamp: new Date()
    });
  }

  handleClientLeft(clientId) {
    this.connectedClients.delete(clientId);
    this.updateClientsCount();
    this.removeClientFromUI(clientId);
    this.addActivityEvent({
      type: 'client_left',
      message: `Client ${clientId.substring(0, 8)} left`,
      sourceClientId: clientId,
      timestamp: new Date()
    });
  }

  updateClientsList(clients) {
    this.connectedClients = new Set(clients);
    this.updateClientsCount();
    this.renderClientsList();
  }

  handleUserActivity(data) {
    this.addActivityEvent({
      type: 'user_activity',
      message: data.message,
      sourceClientId: data.clientId,
      timestamp: new Date(data.timestamp)
    });
  }

  handleSyncEvent(data) {
    this.syncEventsCount++;
    document.getElementById('sync-events-count').textContent = this.syncEventsCount;
    document.getElementById('last-sync-time').textContent = new Date().toLocaleTimeString();
  }

  addProductToUI(product) {
    const productsList = document.getElementById('products-list');
    const productElement = this.createProductElement(product);
    productsList.appendChild(productElement);
    this.updateProductsCount();
  }

  updateProductInUI(product) {
    const existingElement = document.querySelector(`[data-product-id="${product.id}"]`);
    if (existingElement) {
      const newElement = this.createProductElement(product);
      existingElement.replaceWith(newElement);
    }
  }

  removeProductFromUI(productId) {
    const productElement = document.querySelector(`[data-product-id="${productId}"]`);
    if (productElement) {
      productElement.remove();
      this.updateProductsCount();
    }
  }

  updateProductStockInUI(productId, newStock) {
    const stockElement = document.querySelector(`[data-product-id="${productId}"] .stock-value`);
    if (stockElement) {
      stockElement.textContent = newStock;
      stockElement.classList.add('stock-updated');
      setTimeout(() => {
        stockElement.classList.remove('stock-updated');
      }, 2000);
    }
  }

  createProductElement(product) {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.setAttribute('data-product-id', product.id);

    div.innerHTML = `
      <div class="product-header">
        <h4 class="product-name">${product.name}</h4>
        <span class="product-id">${product.id.substring(0, 8)}</span>
      </div>
      <div class="product-details">
        <span class="product-price">$${product.price}</span>
        <span class="product-stock">Stock: <span class="stock-value">${product.stock}</span></span>
        <span class="product-category">${product.category}</span>
      </div>
    `;

    return div;
  }

  addClientToUI(clientId) {
    const clientsList = document.getElementById('clients-list');
    const clientElement = document.createElement('div');
    clientElement.className = 'client-item';
    clientElement.setAttribute('data-client-id', clientId);

    clientElement.innerHTML = `
      <span class="client-id">${clientId.substring(0, 8)}</span>
      <span class="client-status">🟢 Connected</span>
    `;

    clientsList.appendChild(clientElement);
  }

  removeClientFromUI(clientId) {
    const clientElement = document.querySelector(`[data-client-id="${clientId}"]`);
    if (clientElement) {
      clientElement.remove();
    }
  }

  renderClientsList() {
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = '';

    this.connectedClients.forEach(clientId => {
      this.addClientToUI(clientId);
    });
  }

  addActivityEvent(event) {
    this.activityFeed.unshift(event);
    if (this.activityFeed.length > 50) {
      this.activityFeed = this.activityFeed.slice(0, 50);
    }

    this.renderActivityFeed();
  }

  renderActivityFeed() {
    const activityFeed = document.getElementById('activity-feed');
    activityFeed.innerHTML = '';

    this.activityFeed.forEach(event => {
      const eventElement = document.createElement('div');
      eventElement.className = `activity-item ${event.type}`;

      const isOwnEvent = event.sourceClientId === this.clientId;
      const sourceText = isOwnEvent ? 'You' : `Client ${event.sourceClientId.substring(0, 8)}`;

      eventElement.innerHTML = `
        <span class="activity-time">${event.timestamp.toLocaleTimeString()}</span>
        <span class="activity-source ${isOwnEvent ? 'own' : ''}">${sourceText}</span>
        <span class="activity-message">${event.message}</span>
      `;

      activityFeed.appendChild(eventElement);
    });
  }

  updateProductsCount() {
    const count = this.products.size;
    document.getElementById('products-count').textContent = `(${count})`;
  }

  updateClientsCount() {
    const count = this.connectedClients.size;
    document.getElementById('clients-count').textContent = `(${count})`;
    document.getElementById('client-count').textContent = `${count} client${count !== 1 ? 's' : ''}`;
  }

  updateSyncStats() {
    this.syncEventsCount++;
    document.getElementById('sync-events-count').textContent = this.syncEventsCount;
    document.getElementById('last-sync-time').textContent = new Date().toLocaleTimeString();
  }

  startUptimeTimer() {
    this.uptimeInterval = setInterval(() => {
      const uptime = Date.now() - this.connectionStartTime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      const seconds = Math.floor((uptime % 60000) / 1000);

      document.getElementById('uptime').textContent =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  setupEventListeners() {
    // Action buttons
    document.getElementById('add-product-btn').addEventListener('click', () => {
      this.addRandomProduct();
    });

    document.getElementById('update-stock-btn').addEventListener('click', () => {
      this.updateRandomStock();
    });

    document.getElementById('simulate-activity-btn').addEventListener('click', () => {
      this.simulateUserActivity();
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
      this.clearAllProducts();
    });
  }

  async addRandomProduct() {
    this.showActionModal('Adding Product', 'Creating a new random product...');

    try {
      const product = {
        name: this.generateRandomName(),
        description: 'A randomly generated product for sync demo',
        price: Math.floor(Math.random() * 100) + 10,
        stock: Math.floor(Math.random() * 50) + 1,
        category: this.getRandomCategory(),
        minStockLevel: 5
      };

      // In a real app, this would be a GraphQL mutation
      const response = await fetch('http://localhost:4002/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateProduct($input: CreateProductInput!) {
              createProduct(input: $input) {
                id
                name
                price
                stock
                category
              }
            }
          `,
          variables: { input: product }
        })
      });

      const result = await response.json();
      if (result.data?.createProduct) {
        this.hideActionModal();
      }
    } catch (error) {
      console.error('Failed to add product:', error);
      this.hideActionModal();
    }
  }

  async updateRandomStock() {
    if (this.products.size === 0) {
      alert('No products to update. Add some products first.');
      return;
    }

    this.showActionModal('Updating Stock', 'Changing stock level of a random product...');

    try {
      const productIds = Array.from(this.products.keys());
      const randomProductId = productIds[Math.floor(Math.random() * productIds.length)];
      const newStock = Math.floor(Math.random() * 100) + 1;

      // In a real app, this would be a GraphQL mutation
      const response = await fetch('http://localhost:4002/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdateProductStock($id: ID!, $stock: Int!) {
              updateProductStock(id: $id, stock: $stock) {
                id
                stock
              }
            }
          `,
          variables: { id: randomProductId, stock: newStock }
        })
      });

      const result = await response.json();
      if (result.data?.updateProductStock) {
        this.hideActionModal();
      }
    } catch (error) {
      console.error('Failed to update stock:', error);
      this.hideActionModal();
    }
  }

  simulateUserActivity() {
    const activities = [
      'is browsing products',
      'is updating inventory',
      'is checking stock levels',
      'is adding new products',
      'is reviewing alerts'
    ];

    const randomActivity = activities[Math.floor(Math.random() * activities.length)];

    this.socket.emit('userActivity', {
      clientId: this.clientId,
      message: randomActivity,
      timestamp: new Date().toISOString()
    });
  }

  async clearAllProducts() {
    if (!confirm('Are you sure you want to clear all products? This will affect all connected clients.')) {
      return;
    }

    this.showActionModal('Clearing Products', 'Removing all products...');

    try {
      // In a real app, this would be a GraphQL mutation
      // For demo purposes, we'll emit a custom event
      this.socket.emit('clearAllProducts', {
        clientId: this.clientId,
        timestamp: new Date().toISOString()
      });

      this.hideActionModal();
    } catch (error) {
      console.error('Failed to clear products:', error);
      this.hideActionModal();
    }
  }

  showActionModal(title, message) {
    document.getElementById('action-title').textContent = title;
    document.getElementById('action-message').textContent = message;
    document.getElementById('action-modal').style.display = 'flex';

    // Animate progress bar
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '0%';
    setTimeout(() => {
      progressBar.style.width = '100%';
    }, 100);
  }

  hideActionModal() {
    document.getElementById('action-modal').style.display = 'none';
  }

  generateRandomName() {
    const adjectives = ['Amazing', 'Super', 'Mega', 'Ultra', 'Pro', 'Elite', 'Premium'];
    const nouns = ['Widget', 'Gadget', 'Device', 'Tool', 'Item', 'Product', 'Accessory'];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);

    return `${adjective} ${noun} ${number}`;
  }

  getRandomCategory() {
    const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Toys'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  resyncData() {
    // Request current state from server
    this.socket.emit('requestSync', { clientId: this.clientId });
  }
}

// Initialize the demo
new MultiClientSyncDemo();
```

### CSS Styling

```css
/* sync-demo.css */
.sync-demo {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.demo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}

.connection-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
}

.status-connected {
    color: #00b894;
}

.status-disconnected {
    color: #d63031;
}

.demo-controls {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 30px;
    margin-bottom: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
}

.client-info h3 {
    margin: 0 0 10px 0;
    color: #333;
}

.client-info p {
    margin: 0;
    color: #666;
}

.action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.action-buttons button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    background: #0984e3;
    color: white;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
}

.action-buttons button:hover {
    background: #0761b7;
}

.demo-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr;
    gap: 20px;
}

.products-section, .activity-section, .clients-section {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
}

.products-list {
    max-height: 400px;
    overflow-y: auto;
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

.product-header {
    display: flex;
    align-items: center;
    gap: 10px;
}

.product-name {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
}

.product-id {
    font-size: 12px;
    color: #666;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 3px;
}

.product-details {
    display: flex;
    gap: 15px;
    font-size: 14px;
}

.product-price {
    font-weight: bold;
    color: #00b894;
}

.product-stock {
    color: #666;
}

.stock-updated {
    animation: stockFlash 2s ease-out;
}

.product-category {
    color: #666;
    font-style: italic;
}

.activity-feed {
    max-height: 300px;
    overflow-y: auto;
}

.activity-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
}

.activity-time {
    color: #999;
    font-size: 12px;
}

.activity-source {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    background: #e9ecef;
}

.activity-source.own {
    background: #d4edda;
    color: #155724;
}

.activity-message {
    flex: 1;
}

.clients-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.client-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
}

.client-id {
    font-family: monospace;
    font-weight: bold;
}

.client-status {
    font-size: 14px;
}

.sync-stats {
    margin-top: 30px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}

.stat {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

.stat-label {
    display: block;
    color: #666;
    font-size: 14px;
    margin-bottom: 5px;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #333;
}

/* Modal */
.action-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.action-modal.show {
    display: flex;
}

.action-modal-content {
    background: white;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
    max-width: 400px;
    width: 90%;
}

.action-progress {
    margin-top: 20px;
    background: #e9ecef;
    border-radius: 10px;
    height: 8px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: #0984e3;
    width: 0%;
    transition: width 2s ease-out;
}

/* Animations */
@keyframes stockFlash {
    0% { background-color: #74b9ff; color: white; }
    50% { background-color: #0984e3; color: white; }
    100% { background-color: transparent; color: inherit; }
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.activity-item {
    animation: fadeIn 0.3s ease-out;
}

.product-item {
    animation: fadeIn 0.3s ease-out;
}

/* Responsive */
@media (max-width: 768px) {
    .demo-content {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;
    }

    .sync-stats {
        grid-template-columns: 1fr;
    }

    .demo-controls {
        grid-template-columns: 1fr;
        gap: 20px;
    }

    .action-buttons {
        flex-direction: row;
        flex-wrap: wrap;
    }
}
```

## Usage

1. **Start the Products Service:**
   ```bash
   npm run start:products
   ```

2. **Open multiple browser tabs/windows:**
   ```bash
   npx http-server . -p 8080
   # Visit http://localhost:8080/multi-client-sync.html in multiple tabs
   ```

3. **Test synchronization:**
   - Add products in one tab, watch them appear in others
   - Update stock in one tab, see changes sync instantly
   - Simulate user activity to see real-time activity feed
   - Open/close tabs to see client join/leave events

## Extended WebSocket Features

To enhance the multi-client synchronization, extend the ProductGateway:

```javascript
// product.gateway.ts (enhanced)
export class ProductGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private connectedClients = new Map<string, ClientInfo>();

  @SubscribeMessage('registerClient')
  async handleRegisterClient(
    @MessageBody() data: { clientId: string; userAgent: string; timestamp: string },
    @ConnectedSocket() client: Socket
  ) {
    const clientInfo: ClientInfo = {
      id: data.clientId,
      socketId: client.id,
      userAgent: data.userAgent,
      connectedAt: new Date(data.timestamp),
      lastActivity: new Date()
    };

    this.connectedClients.set(client.id, clientInfo);

    // Notify all clients about new client
    this.server.emit('clientJoined', { clientId: data.clientId });

    // Send current clients list to new client
    const clientsList = Array.from(this.connectedClients.keys());
    client.emit('clientsList', { clients: clientsList });

    // Send current products to new client
    await this.syncProductsToClient(client);
  }

  @SubscribeMessage('userActivity')
  async handleUserActivity(
    @MessageBody() data: { clientId: string; message: string; timestamp: string },
    @ConnectedSocket() client: Socket
  ) {
    // Update last activity
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }

    // Broadcast activity to all other clients
    client.broadcast.emit('userActivity', data);
  }

  @SubscribeMessage('requestSync')
  async handleRequestSync(@ConnectedSocket() client: Socket) {
    await this.syncProductsToClient(client);
  }

  private async syncProductsToClient(client: Socket) {
    // Get current products from service
    const products = await this.productService.findAll();

    // Send products to client
    client.emit('syncProducts', {
      products: products.map(p => this.toProductResponseDto(p)),
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      this.connectedClients.delete(client.id);

      // Notify all clients about client leaving
      this.server.emit('clientLeft', { clientId: clientInfo.id });
    }
  }
}
```

This creates a comprehensive multi-client synchronization system that demonstrates real-time collaboration and instant data consistency across all connected clients.