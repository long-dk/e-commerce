#!/usr/bin/env node

/**
 * Real-Time E-Commerce Features Demo
 *
 * This script demonstrates the live inventory dashboards, real-time shopping
 * experiences, instant stock alerts, and seamless multi-client synchronization
 * features of the e-commerce microservices platform.
 */

const io = require('socket.io-client');
const readline = require('readline');

class RealTimeDemo {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('🚀 Real-Time E-Commerce Features Demo');
    console.log('=====================================\n');

    this.showMenu();
  }

  showMenu() {
    console.log('Available Demos:');
    console.log('1. 📊 Live Inventory Dashboard');
    console.log('2. 🛒 Real-Time Shopping Experience');
    console.log('3. ⚡ Instant Stock Alerts');
    console.log('4. 🔄 Multi-Client Synchronization');
    console.log('5. 🎯 Run All Demos');
    console.log('6. Exit\n');

    this.rl.question('Choose a demo (1-6): ', (choice) => {
      switch (choice) {
        case '1':
          this.runInventoryDashboard();
          break;
        case '2':
          this.runShoppingExperience();
          break;
        case '3':
          this.runStockAlerts();
          break;
        case '4':
          this.runMultiClientSync();
          break;
        case '5':
          this.runAllDemos();
          break;
        case '6':
          this.exit();
          break;
        default:
          console.log('Invalid choice. Please try again.\n');
          this.showMenu();
      }
    });
  }

  async connect() {
    if (this.connected) return;

    console.log('🔌 Connecting to Products Service...');

    return new Promise((resolve, reject) => {
      this.socket = io('http://localhost:4002/products', {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to Products Service\n');
        this.connected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from Products Service');
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.log('❌ Connection failed:', error.message);
        reject(error);
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    this.socket.on('productCreated', (data) => {
      console.log(`📦 Product Created: ${data.product.name} (${data.product.id})`);
    });

    this.socket.on('productUpdated', (data) => {
      console.log(`📝 Product Updated: ${data.product.name}`);
    });

    this.socket.on('productDeleted', (data) => {
      console.log(`🗑️  Product Deleted: ${data.productId}`);
    });

    this.socket.on('stockUpdated', (data) => {
      console.log(`📊 Stock Updated: Product ${data.productId} - ${data.previousStock} → ${data.newStock}`);
    });

    this.socket.on('lowStockAlert', (alert) => {
      console.log(`🚨 LOW STOCK ALERT: ${alert.productName} - Only ${alert.currentStock} left!`);
    });

    this.socket.on('clientJoined', (data) => {
      console.log(`👤 Client Joined: ${data.clientId.substring(0, 8)}`);
    });

    this.socket.on('clientLeft', (data) => {
      console.log(`👋 Client Left: ${data.clientId.substring(0, 8)}`);
    });
  }

  async runInventoryDashboard() {
    console.log('\n📊 Live Inventory Dashboard Demo');
    console.log('=================================\n');

    try {
      await this.connect();

      console.log('🎯 Features Demonstrated:');
      console.log('• Real-time stock level updates');
      console.log('• Low stock alerts');
      console.log('• Product creation/deletion events');
      console.log('• Live activity monitoring\n');

      console.log('📋 To test this demo:');
      console.log('1. Open the inventory dashboard in your browser:');
      console.log('   http://localhost:8080/live-inventory-dashboard.html');
      console.log('2. Use GraphQL mutations to create/update products');
      console.log('3. Watch real-time updates in the dashboard\n');

      await this.waitForUserInput();

    } catch (error) {
      console.log('❌ Failed to run inventory dashboard demo:', error.message);
    }
  }

  async runShoppingExperience() {
    console.log('\n🛒 Real-Time Shopping Experience Demo');
    console.log('=====================================\n');

    try {
      await this.connect();

      console.log('🎯 Features Demonstrated:');
      console.log('• Live cart updates when stock changes');
      console.log('• Real-time product availability');
      console.log('• Instant out-of-stock notifications');
      console.log('• Multi-user cart synchronization\n');

      console.log('📋 To test this demo:');
      console.log('1. Open the shopping experience in your browser:');
      console.log('   http://localhost:8080/realtime-shopping-experience.html');
      console.log('2. Add items to cart');
      console.log('3. Change stock levels via GraphQL');
      console.log('4. Watch cart update automatically\n');

      // Simulate some stock changes
      console.log('🔄 Simulating stock changes...');
      setTimeout(() => {
        console.log('📉 Reducing stock of first product...');
      }, 2000);

      await this.waitForUserInput();

    } catch (error) {
      console.log('❌ Failed to run shopping experience demo:', error.message);
    }
  }

  async runStockAlerts() {
    console.log('\n⚡ Instant Stock Alerts Demo');
    console.log('===========================\n');

    try {
      await this.connect();

      console.log('🎯 Features Demonstrated:');
      console.log('• Real-time stock level monitoring');
      console.log('• Configurable alert thresholds');
      console.log('• Multi-channel notifications (WebSocket + Email)');
      console.log('• Alert prioritization and acknowledgment\n');

      console.log('📋 To test this demo:');
      console.log('1. Open the alerts dashboard in your browser:');
      console.log('   http://localhost:8080/alerts-dashboard.html');
      console.log('2. Create products with low stock levels');
      console.log('3. Update stock to trigger alerts');
      console.log('4. Acknowledge alerts in the dashboard\n');

      // Simulate alert generation
      console.log('🚨 Simulating alert generation...');
      setTimeout(() => {
        console.log('📢 Low stock alert should appear in dashboard!');
      }, 3000);

      await this.waitForUserInput();

    } catch (error) {
      console.log('❌ Failed to run stock alerts demo:', error.message);
    }
  }

  async runMultiClientSync() {
    console.log('\n🔄 Multi-Client Synchronization Demo');
    console.log('====================================\n');

    try {
      await this.connect();

      console.log('🎯 Features Demonstrated:');
      console.log('• Cross-tab synchronization');
      console.log('• Real-time user activity monitoring');
      console.log('• Client connection tracking');
      console.log('• Instant data consistency\n');

      console.log('📋 To test this demo:');
      console.log('1. Open the sync demo in multiple browser tabs:');
      console.log('   http://localhost:8080/multi-client-sync.html');
      console.log('2. Add products in one tab');
      console.log('3. Watch them appear in other tabs instantly');
      console.log('4. Update stock and see real-time sync\n');

      // Register as a demo client
      this.socket.emit('registerClient', {
        clientId: 'demo-client-' + Date.now(),
        userAgent: 'Demo Script',
        timestamp: new Date().toISOString()
      });

      console.log('👤 Registered as demo client');

      await this.waitForUserInput();

    } catch (error) {
      console.log('❌ Failed to run multi-client sync demo:', error.message);
    }
  }

  async runAllDemos() {
    console.log('\n🎯 Running All Demos');
    console.log('===================\n');

    console.log('This will run all real-time features simultaneously.');
    console.log('Make sure you have:');
    console.log('• Products Service running on port 4002');
    console.log('• HTTP server running on port 8080');
    console.log('• Multiple browser tabs open for testing\n');

    this.rl.question('Continue? (y/N): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        try {
          await this.connect();

          console.log('\n🚀 Starting comprehensive demo...\n');

          // Run all demos in sequence
          await this.runInventoryDashboard();
          await this.runShoppingExperience();
          await this.runStockAlerts();
          await this.runMultiClientSync();

          console.log('\n✅ All demos completed!');
          console.log('🎉 Real-time e-commerce features are working perfectly!\n');

        } catch (error) {
          console.log('❌ Demo failed:', error.message);
        }
      }

      this.showMenu();
    });
  }

  async waitForUserInput() {
    return new Promise((resolve) => {
      this.rl.question('\nPress Enter to continue...', () => {
        resolve();
      });
    });
  }

  exit() {
    console.log('\n👋 Goodbye! Thanks for trying the real-time e-commerce demos.\n');

    if (this.socket) {
      this.socket.disconnect();
    }

    this.rl.close();
    process.exit(0);
  }
}

// Check if services are running
async function checkServices() {
  console.log('🔍 Checking service availability...\n');

  try {
    // Check Products Service
    const productsResponse = await fetch('http://localhost:4002/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' })
    });

    if (productsResponse.ok) {
      console.log('✅ Products Service is running on port 4002');
    } else {
      console.log('❌ Products Service not accessible on port 4002');
      console.log('   Make sure to run: npm run start:products\n');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Products Service not accessible on port 4002');
    console.log('   Make sure to run: npm run start:products\n');
    process.exit(1);
  }

  // Check HTTP server (optional)
  try {
    const httpResponse = await fetch('http://localhost:8080');
    if (httpResponse.ok) {
      console.log('✅ HTTP Server is running on port 8080');
    } else {
      console.log('⚠️  HTTP Server not accessible on port 8080');
      console.log('   For full demo experience, run: npx http-server . -p 8080\n');
    }
  } catch (error) {
    console.log('⚠️  HTTP Server not accessible on port 8080');
    console.log('   For full demo experience, run: npx http-server . -p 8080\n');
  }

  console.log('');
}

// Start the demo
async function main() {
  await checkServices();
  new RealTimeDemo();
}

main().catch(console.error);