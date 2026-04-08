#!/usr/bin/env node

/**
 * Orders Service WebSocket Test
 *
 * Interactive testing tool for the Orders Service real-time WebSocket features.
 */

const io = require('socket.io-client');
const readline = require('readline');

class OrdersWebSocketTest {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.userId = null;
    this.subscribedOrders = new Set();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('🛒 Orders Service WebSocket Test');
    console.log('=================================\n');

    this.showMenu();
  }

  showMenu() {
    console.log('Commands:');
    console.log('1. Connect to Orders Service');
    console.log('2. Authenticate');
    console.log('3. Subscribe to user orders');
    console.log('4. Subscribe to specific order');
    console.log('5. Unsubscribe from order');
    console.log('6. Create test order (via GraphQL)');
    console.log('7. Update order status (via GraphQL)');
    console.log('8. Disconnect');
    console.log('9. Exit\n');

    this.rl.question('Choose command (1-9): ', (choice) => {
      switch (choice) {
        case '1':
          this.connect();
          break;
        case '2':
          this.authenticate();
          break;
        case '3':
          this.subscribeToOrders();
          break;
        case '4':
          this.subscribeToOrder();
          break;
        case '5':
          this.unsubscribeFromOrder();
          break;
        case '6':
          this.createTestOrder();
          break;
        case '7':
          this.updateOrderStatus();
          break;
        case '8':
          this.disconnect();
          break;
        case '9':
          this.exit();
          break;
        default:
          console.log('Invalid choice. Please try again.\n');
          this.showMenu();
      }
    });
  }

  async connect() {
    if (this.connected) {
      console.log('Already connected!\n');
      this.showMenu();
      return;
    }

    console.log('🔌 Connecting to Orders Service WebSocket...');

    this.socket = io('http://localhost:4003/orders', {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Orders Service');
      this.connected = true;
      this.setupEventListeners();
      this.showMenu();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from Orders Service');
      this.connected = false;
      this.authenticated = false;
    });

    this.socket.on('connect_error', (error) => {
      console.log('❌ Connection failed:', error.message);
      this.showMenu();
    });
  }

  setupEventListeners() {
    // Authentication events
    this.socket.on('authenticated', (data) => {
      console.log(`🔐 Authenticated as user: ${data.userId}`);
      this.authenticated = true;
      this.userId = data.userId;
    });

    this.socket.on('subscribed', (data) => {
      console.log(`📡 Subscribed to: ${data.channel}`);
    });

    this.socket.on('unsubscribed', (data) => {
      console.log(`📡 Unsubscribed from: ${data.channel}`);
    });

    // Order events
    this.socket.on('orderCreated', (data) => {
      console.log('📦 ORDER CREATED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderUpdated', (data) => {
      console.log('📝 ORDER UPDATED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderConfirmed', (data) => {
      console.log('✅ ORDER CONFIRMED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderCancelled', (data) => {
      console.log('❌ ORDER CANCELLED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderShipped', (data) => {
      console.log('🚚 ORDER SHIPPED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderDelivered', (data) => {
      console.log('📦 ORDER DELIVERED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('orderRefunded', (data) => {
      console.log('💰 ORDER REFUNDED:', JSON.stringify(data, null, 2));
    });

    this.socket.on('paymentStatusUpdated', (data) => {
      console.log('💳 PAYMENT STATUS UPDATED:', JSON.stringify(data, null, 2));
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.log('❌ WebSocket Error:', error.message);
    });
  }

  authenticate() {
    if (!this.connected) {
      console.log('Not connected! Please connect first.\n');
      this.showMenu();
      return;
    }

    // For testing, we'll use a mock token
    const mockToken = 'mock-jwt-token-for-testing';

    console.log('🔐 Authenticating with mock token...');
    this.socket.emit('authenticate', { token: mockToken });
    this.showMenu();
  }

  subscribeToOrders() {
    if (!this.authenticated) {
      console.log('Not authenticated! Please authenticate first.\n');
      this.showMenu();
      return;
    }

    console.log('📡 Subscribing to user orders...');
    this.socket.emit('subscribeToOrders');
    this.showMenu();
  }

  subscribeToOrder() {
    if (!this.authenticated) {
      console.log('Not authenticated! Please authenticate first.\n');
      this.showMenu();
      return;
    }

    this.rl.question('Enter order ID to subscribe to: ', (orderId) => {
      if (orderId && orderId.trim()) {
        console.log(`📡 Subscribing to order: ${orderId}`);
        this.socket.emit('subscribeToOrder', { orderId: orderId.trim() });
        this.subscribedOrders.add(orderId.trim());
      } else {
        console.log('Invalid order ID');
      }
      this.showMenu();
    });
  }

  unsubscribeFromOrder() {
    if (!this.authenticated) {
      console.log('Not authenticated! Please authenticate first.\n');
      this.showMenu();
      return;
    }

    if (this.subscribedOrders.size === 0) {
      console.log('No subscribed orders to unsubscribe from.\n');
      this.showMenu();
      return;
    }

    console.log('Currently subscribed orders:', Array.from(this.subscribedOrders));

    this.rl.question('Enter order ID to unsubscribe from: ', (orderId) => {
      if (orderId && this.subscribedOrders.has(orderId.trim())) {
        console.log(`📡 Unsubscribing from order: ${orderId}`);
        this.socket.emit('unsubscribeFromOrder', { orderId: orderId.trim() });
        this.subscribedOrders.delete(orderId.trim());
      } else {
        console.log('Invalid or not subscribed order ID');
      }
      this.showMenu();
    });
  }

  async createTestOrder() {
    console.log('📦 Creating test order via GraphQL...');

    try {
      const response = await fetch('http://localhost:4003/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In a real app, you'd include JWT token here
        },
        body: JSON.stringify({
          query: `
            mutation CreateTestOrder($input: CreateOrderInput!) {
              createOrder(input: $input) {
                id
                totalAmount
                status
                items {
                  productId
                  productName
                  quantity
                  price
                  total
                }
              }
            }
          `,
          variables: {
            input: {
              items: [
                {
                  productId: "test-product-1",
                  quantity: 2
                },
                {
                  productId: "test-product-2",
                  quantity: 1,
                  discount: 5.00
                }
              ],
              shippingAddress: {
                street: "123 Test Street",
                city: "Test City",
                state: "TS",
                zipCode: "12345",
                country: "Test Country"
              },
              notes: "Test order from WebSocket tester"
            }
          }
        })
      });

      const result = await response.json();

      if (result.errors) {
        console.log('❌ GraphQL Error:', result.errors);
      } else {
        console.log('✅ Order Created:', JSON.stringify(result.data.createOrder, null, 2));
      }
    } catch (error) {
      console.log('❌ Failed to create order:', error.message);
    }

    this.showMenu();
  }

  async updateOrderStatus() {
    this.rl.question('Enter order ID: ', (orderId) => {
      if (!orderId || !orderId.trim()) {
        console.log('Invalid order ID\n');
        this.showMenu();
        return;
      }

      console.log('Available status updates:');
      console.log('1. confirm - Confirm order');
      console.log('2. cancel - Cancel order');
      console.log('3. ship - Ship order');
      console.log('4. deliver - Deliver order');

      this.rl.question('Choose status update (1-4): ', async (choice) => {
        let mutation = '';
        let variables = { id: orderId.trim() };

        switch (choice) {
          case '1':
            mutation = 'confirmOrder(id: $id) { id status }';
            break;
          case '2':
            mutation = 'cancelOrder(id: $id) { id status }';
            break;
          case '3':
            mutation = 'shipOrder(id: $id, trackingNumber: "TEST123", carrier: "Test Carrier") { id status trackingNumber carrier }';
            break;
          case '4':
            mutation = 'deliverOrder(id: $id) { id status deliveredAt }';
            break;
          default:
            console.log('Invalid choice\n');
            this.showMenu();
            return;
        }

        try {
          const response = await fetch('http://localhost:4003/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `mutation UpdateOrderStatus($id: ID!) { ${mutation} }`,
              variables
            })
          });

          const result = await response.json();

          if (result.errors) {
            console.log('❌ GraphQL Error:', result.errors);
          } else {
            console.log('✅ Order Updated:', JSON.stringify(result.data, null, 2));
          }
        } catch (error) {
          console.log('❌ Failed to update order:', error.message);
        }

        this.showMenu();
      });
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from Orders Service...');
      this.socket.disconnect();
      this.connected = false;
      this.authenticated = false;
      this.userId = null;
      this.subscribedOrders.clear();
    } else {
      console.log('Not connected!\n');
    }
    this.showMenu();
  }

  exit() {
    console.log('\n👋 Goodbye! Thanks for testing the Orders Service WebSocket features.\n');

    if (this.socket) {
      this.socket.disconnect();
    }

    this.rl.close();
    process.exit(0);
  }
}

// Check if Orders Service is running
async function checkService() {
  console.log('🔍 Checking Orders Service availability...\n');

  try {
    const response = await fetch('http://localhost:4003/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' })
    });

    if (response.ok) {
      console.log('✅ Orders Service is running on port 4003');
    } else {
      console.log('❌ Orders Service not accessible on port 4003');
      console.log('   Make sure to run: npm run start:orders\n');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Orders Service not accessible on port 4003');
    console.log('   Make sure to run: npm run start:orders\n');
    process.exit(1);
  }

  console.log('');
}

// Start the test
async function main() {
  await checkService();
  new OrdersWebSocketTest();
}

main().catch(console.error);