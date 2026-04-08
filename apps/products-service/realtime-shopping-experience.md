# Real-Time Shopping Experience

A modern e-commerce shopping experience with real-time inventory updates, live cart synchronization, and instant stock alerts.

## Features

- **Live Cart Updates**: Cart items update automatically when stock changes
- **Real-time Availability**: See product availability change instantly
- **Multi-user Synchronization**: Multiple users see the same stock levels
- **Instant Alerts**: Get notified when items in your cart go out of stock
- **Seamless Checkout**: Prevent checkout with out-of-stock items

## Implementation

### Shopping Cart with Real-Time Updates

```javascript
// realtime-cart.js
import io from 'socket.io-client';

class RealTimeShoppingCart {
  constructor() {
    this.socket = io('http://localhost:4002/products');
    this.cart = new Map();
    this.subscribedProducts = new Set();
    this.setupSocketListeners();
    this.loadExistingCart();
  }

  setupSocketListeners() {
    // Stock updates affect cart items
    this.socket.on('stockUpdated', (data) => {
      this.handleStockUpdate(data.productId, data.newStock, data.reason);
    });

    // Low stock alerts for cart items
    this.socket.on('lowStockAlert', (alert) => {
      if (this.cart.has(alert.productId)) {
        this.showCartAlert(alert);
      }
    });

    // Product deletions affect cart
    this.socket.on('productDeleted', (data) => {
      if (this.cart.has(data.productId)) {
        this.handleProductDeleted(data.productId);
      }
    });

    // Product updates (price changes, etc.)
    this.socket.on('productUpdated', (data) => {
      if (this.cart.has(data.product.id)) {
        this.updateCartItemInfo(data.product);
      }
    });
  }

  addToCart(productId, quantity = 1) {
    const currentQuantity = this.cart.get(productId) || 0;
    const newQuantity = currentQuantity + quantity;

    // Subscribe to product updates
    this.subscribeToProduct(productId);

    // Add to cart
    this.cart.set(productId, newQuantity);
    this.updateCartDisplay();

    // Emit cart update event (could be used for analytics)
    this.socket.emit('cartUpdated', {
      productId,
      quantity: newQuantity,
      action: 'add'
    });
  }

  subscribeToProduct(productId) {
    if (!this.subscribedProducts.has(productId)) {
      this.socket.emit('subscribeToProduct', { productId });
      this.subscribedProducts.add(productId);
    }
  }

  handleStockUpdate(productId, newStock, reason) {
    if (this.cart.has(productId)) {
      const cartQuantity = this.cart.get(productId);

      if (newStock === 0) {
        // Item is now out of stock
        this.showOutOfStockAlert(productId);
        this.disableCartItem(productId);
      } else if (newStock < cartQuantity) {
        // Not enough stock for current cart quantity
        this.adjustCartQuantity(productId, newStock);
        this.showStockReducedAlert(productId, cartQuantity, newStock);
      }

      // Update availability display
      this.updateProductAvailability(productId, newStock);
    }
  }

  handleProductDeleted(productId) {
    this.cart.delete(productId);
    this.subscribedProducts.delete(productId);
    this.updateCartDisplay();
    this.showProductDeletedAlert(productId);
  }

  updateCartItemInfo(product) {
    // Update price, name, etc. in cart display
    const cartItem = document.querySelector(`[data-product-id="${product.id}"]`);
    if (cartItem) {
      cartItem.querySelector('.price').textContent = `$${product.price}`;
      cartItem.querySelector('.name').textContent = product.name;
    }
  }

  showOutOfStockAlert(productId) {
    const alert = {
      type: 'out_of_stock',
      productId,
      message: 'An item in your cart is now out of stock',
      action: 'remove'
    };
    this.displayAlert(alert);
  }

  showStockReducedAlert(productId, oldQuantity, newStock) {
    const alert = {
      type: 'stock_reduced',
      productId,
      message: `Stock reduced from ${oldQuantity} to ${newStock} for item in your cart`,
      action: 'adjust'
    };
    this.displayAlert(alert);
  }

  showCartAlert(alert) {
    const cartAlert = {
      type: 'low_stock_cart',
      productId: alert.productId,
      message: `Low stock alert: ${alert.productName} has only ${alert.currentStock} left`,
      action: 'review'
    };
    this.displayAlert(cartAlert);
  }

  adjustCartQuantity(productId, maxQuantity) {
    this.cart.set(productId, maxQuantity);
    this.updateCartDisplay();
  }

  updateCartDisplay() {
    // Update cart UI
    this.renderCartItems();
    this.updateCartTotal();
    this.updateCheckoutButton();
  }

  updateCheckoutButton() {
    const checkoutBtn = document.getElementById('checkout-btn');
    const hasOutOfStockItems = this.hasOutOfStockItems();

    if (hasOutOfStockItems) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Remove Out of Stock Items to Checkout';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Proceed to Checkout';
    }
  }

  hasOutOfStockItems() {
    // Check if any cart items are out of stock
    for (const [productId, quantity] of this.cart) {
      const product = this.getProductInfo(productId);
      if (!product || product.stock === 0) {
        return true;
      }
    }
    return false;
  }
}
```

### Real-Time Product Display

```javascript
// realtime-products.js
class RealTimeProductDisplay {
  constructor() {
    this.socket = io('http://localhost:4002/products');
    this.products = new Map();
    this.setupSocketListeners();
    this.loadProducts();
  }

  setupSocketListeners() {
    // Global product updates
    this.socket.on('productCreated', (data) => {
      this.addProduct(data.product);
    });

    this.socket.on('productUpdated', (data) => {
      this.updateProduct(data.product);
    });

    this.socket.on('productDeleted', (data) => {
      this.removeProduct(data.productId);
    });

    this.socket.on('stockUpdated', (data) => {
      this.updateProductStock(data.productId, data.newStock);
    });

    this.socket.on('lowStockAlert', (alert) => {
      this.showLowStockIndicator(alert.productId);
    });
  }

  updateProductStock(productId, newStock) {
    const product = this.products.get(productId);
    if (product) {
      const oldStock = product.stock;
      product.stock = newStock;

      this.updateStockDisplay(productId, newStock);

      // Animate stock changes
      this.animateStockChange(productId, oldStock, newStock);
    }
  }

  updateStockDisplay(productId, stock) {
    const stockElement = document.querySelector(`[data-product-id="${productId}"] .stock`);
    if (stockElement) {
      stockElement.textContent = stock;

      // Update availability status
      const productCard = stockElement.closest('.product-card');
      productCard.classList.remove('out-of-stock', 'low-stock', 'in-stock');

      if (stock === 0) {
        productCard.classList.add('out-of-stock');
        stockElement.textContent = 'Out of Stock';
      } else if (stock <= 5) {
        productCard.classList.add('low-stock');
      } else {
        productCard.classList.add('in-stock');
      }
    }
  }

  showLowStockIndicator(productId) {
    const productCard = document.querySelector(`[data-product-id="${productId}"]`);
    if (productCard) {
      productCard.classList.add('low-stock-alert');
      setTimeout(() => {
        productCard.classList.remove('low-stock-alert');
      }, 5000);
    }
  }

  animateStockChange(productId, oldStock, newStock) {
    const stockElement = document.querySelector(`[data-product-id="${productId}"] .stock`);
    if (stockElement) {
      stockElement.classList.add('stock-changed');
      setTimeout(() => {
        stockElement.classList.remove('stock-changed');
      }, 2000);
    }
  }
}
```

### HTML Shopping Experience

```html
<!-- realtime-shopping.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-Time Shopping Experience</title>
    <link rel="stylesheet" href="shopping.css">
</head>
<body>
    <div class="shopping-app">
        <header class="app-header">
            <h1>Real-Time E-Commerce</h1>
            <div class="cart-indicator">
                <span id="cart-count">0</span> items
                <button id="cart-toggle">🛒</button>
            </div>
        </header>

        <div class="alerts-container" id="alerts-container">
            <!-- Real-time alerts appear here -->
        </div>

        <div class="main-content">
            <div class="products-section">
                <h2>Products</h2>
                <div id="products-grid" class="products-grid">
                    <!-- Products loaded dynamically -->
                </div>
            </div>

            <div class="cart-sidebar" id="cart-sidebar">
                <h2>Your Cart</h2>
                <div id="cart-items" class="cart-items">
                    <!-- Cart items appear here -->
                </div>
                <div class="cart-total">
                    <strong>Total: $<span id="cart-total">0.00</span></strong>
                </div>
                <button id="checkout-btn" class="checkout-btn">Proceed to Checkout</button>
            </div>
        </div>
    </div>

    <!-- Alert Modal -->
    <div id="alert-modal" class="alert-modal">
        <div class="alert-modal-content">
            <h3 id="alert-title">Alert</h3>
            <p id="alert-message"></p>
            <div class="alert-actions">
                <button id="alert-dismiss">Dismiss</button>
                <button id="alert-action">Take Action</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="realtime-cart.js"></script>
    <script src="realtime-products.js"></script>
    <script src="shopping-app.js"></script>
</body>
</html>
```

### CSS Styling

```css
/* shopping.css */
.shopping-app {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}

.cart-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f8f9fa;
    padding: 10px 20px;
    border-radius: 25px;
}

.main-content {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 30px;
}

.products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
}

.product-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s;
}

.product-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}

.product-card.out-of-stock {
    opacity: 0.6;
    position: relative;
}

.product-card.out-of-stock::after {
    content: 'OUT OF STOCK';
    position: absolute;
    top: 10px;
    right: 10px;
    background: #d63031;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
}

.product-card.low-stock .stock {
    color: #ff6b35;
    font-weight: bold;
}

.product-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
}

.product-info {
    padding: 15px;
}

.product-name {
    margin: 0 0 10px 0;
    font-size: 18px;
    font-weight: bold;
}

.product-price {
    font-size: 20px;
    font-weight: bold;
    color: #00b894;
    margin-bottom: 10px;
}

.product-stock {
    font-size: 14px;
    color: #666;
    margin-bottom: 15px;
}

.add-to-cart-btn {
    width: 100%;
    padding: 10px;
    background: #0984e3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.add-to-cart-btn:hover {
    background: #0761b7;
}

.add-to-cart-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.cart-sidebar {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
    height: fit-content;
}

.cart-items {
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 20px;
}

.cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
}

.cart-item-info h4 {
    margin: 0 0 5px 0;
    font-size: 16px;
}

.cart-item-quantity {
    color: #666;
    font-size: 14px;
}

.cart-item-price {
    font-weight: bold;
}

.cart-total {
    text-align: right;
    font-size: 18px;
    margin-bottom: 20px;
    padding-top: 15px;
    border-top: 2px solid #e0e0e0;
}

.checkout-btn {
    width: 100%;
    padding: 15px;
    background: #00b894;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
}

.checkout-btn:hover {
    background: #019875;
}

.checkout-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

/* Alerts */
.alerts-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
}

.alert {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease-out;
}

.alert.error {
    background: #fadbd8;
    border-color: #f5c6cb;
}

.alert.success {
    background: #d4edda;
    border-color: #c3e6cb;
}

.alert-message {
    margin: 0;
    font-weight: bold;
}

.alert-details {
    margin: 5px 0 0 0;
    font-size: 14px;
    color: #666;
}

.alert-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 2000;
    align-items: center;
    justify-content: center;
}

.alert-modal.show {
    display: flex;
}

.alert-modal-content {
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
}

.alert-actions {
    margin-top: 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.alert-actions button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

/* Animations */
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes stockChanged {
    0% { background-color: #74b9ff; }
    50% { background-color: #0984e3; }
    100% { background-color: transparent; }
}

.stock-changed {
    animation: stockChanged 2s ease-out;
}

@keyframes lowStockAlert {
    0% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7); }
    50% { box-shadow: 0 0 0 10px rgba(255, 107, 53, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0); }
}

.low-stock-alert {
    animation: lowStockAlert 2s ease-in-out;
}
```

## Usage

1. **Start the Products Service:**
   ```bash
   npm run start:products
   ```

2. **Open the shopping experience:**
   ```bash
   npx http-server . -p 8080
   # Visit http://localhost:8080/realtime-shopping.html
   ```

3. **Test real-time features:**
   - Add items to cart
   - Change stock levels via GraphQL
   - Watch cart update automatically
   - See alerts when items go out of stock
   - Open multiple tabs to test synchronization

## GraphQL Integration

The shopping experience loads products via GraphQL:

```graphql
query GetProductsForShopping($input: ProductsInput!) {
  products(input: $input) {
    products {
      id
      name
      description
      price
      stock
      minStockLevel
      category
      images
    }
    total
    hasMore
  }
}
```

This creates an immersive real-time shopping experience where users get instant feedback on inventory changes and cart status.