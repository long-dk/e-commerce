#!/usr/bin/env node

/**
 * WebSocket Test Script for Products Service
 * This script demonstrates real-time WebSocket functionality
 */

const io = require('socket.io-client');

const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://localhost:4002';
const TEST_PRODUCT_ID = '507f1f77bcf86cd799439011'; // Example MongoDB ObjectId

console.log('🚀 Connecting to Products Service WebSocket...');

const socket = io(`${PRODUCTS_SERVICE_URL}/products`, {
  transports: ['websocket', 'polling'],
  timeout: 5000,
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to Products Service WebSocket');
  console.log('🔗 Socket ID:', socket.id);
});

socket.on('connection', (data) => {
  console.log('📡 Connection acknowledged:', data);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('🚨 WebSocket error:', error);
});

// Product events
socket.on('productCreated', (data) => {
  console.log('🆕 Product Created:', {
    id: data.product.id,
    name: data.product.name,
    price: data.product.price,
    timestamp: data.timestamp,
  });
});

socket.on('productUpdated', (data) => {
  console.log('📝 Product Updated:', {
    id: data.product.id,
    name: data.product.name,
    changes: 'Price/Stock/Description updated',
    timestamp: data.timestamp,
  });
});

socket.on('productDeleted', (data) => {
  console.log('🗑️  Product Deleted:', {
    productId: data.productId,
    timestamp: data.timestamp,
  });
});

socket.on('stockUpdated', (data) => {
  console.log('📦 Stock Updated:', {
    productId: data.productId,
    previousStock: data.previousStock,
    newStock: data.newStock,
    reason: data.reason,
    timestamp: data.timestamp,
  });
});

socket.on('lowStockAlert', (data) => {
  console.log('⚠️  Low Stock Alert:', {
    productId: data.productId,
    productName: data.productName,
    currentStock: data.currentStock,
    minStockLevel: data.minStockLevel,
    timestamp: data.timestamp,
  });
});

// Room-specific events
socket.on('productUpdate', (data) => {
  console.log('🔄 Product Update (Subscribed):', {
    productId: data.productId,
    product: data.product,
    timestamp: data.timestamp,
  });
});

socket.on('productStockUpdate', (data) => {
  console.log('📊 Stock Update (Subscribed):', data);
});

socket.on('categoryProductCreated', (data) => {
  console.log('📂 Category Product Created:', {
    category: 'Subscribed Category',
    product: data.product,
    timestamp: data.timestamp,
  });
});

// Test subscription after connection
socket.on('connect', () => {
  console.log('\n🧪 Testing subscription features...');

  // Subscribe to a specific product
  setTimeout(() => {
    console.log('📌 Subscribing to product:', TEST_PRODUCT_ID);
    socket.emit('subscribeToProduct', { productId: TEST_PRODUCT_ID });

    socket.on('subscription', (data) => {
      console.log('✅ Subscription confirmed:', data);
    });
  }, 1000);

  // Subscribe to a category
  setTimeout(() => {
    console.log('📂 Subscribing to category: Electronics');
    socket.emit('subscribeToCategory', { category: 'Electronics' });
  }, 2000);

  // Get connected clients count
  setTimeout(() => {
    console.log('👥 Requesting connected clients count...');
    socket.emit('getConnectedClients');
  }, 3000);

  socket.on('connectedClients', (data) => {
    console.log('👤 Connected clients:', data);
  });

  // Unsubscribe after 10 seconds
  setTimeout(() => {
    console.log('🚪 Unsubscribing from product...');
    socket.emit('unsubscribeFromProduct', { productId: TEST_PRODUCT_ID });

    socket.on('unsubscription', (data) => {
      console.log('👋 Unsubscription confirmed:', data);
    });
  }, 10000);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting from WebSocket...');
  socket.disconnect();
  process.exit(0);
});

console.log('🎧 Listening for real-time events...');
console.log('💡 Make changes to products via GraphQL API to see live updates');
console.log('🔄 Press Ctrl+C to exit\n');