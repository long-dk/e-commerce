#!/usr/bin/env node

const io = require('socket.io-client');
const readline = require('readline');

const PAYMENTS_SERVICE_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:4004';
const GRAPHQL_URL = `${PAYMENTS_SERVICE_URL}/graphql`;

let socket;
let currentUserId = 'demo-user-' + Math.random().toString(36).substr(2, 9);
let currentPaymentId = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log('\n🚀 Payments Service WebSocket Test Client');
  console.log('==========================================');
  console.log('1. Connect to Payments Service');
  console.log('2. Authenticate');
  console.log('3. Subscribe to Payments');
  console.log('4. Subscribe to Specific Payment');
  console.log('5. Create Payment (via GraphQL)');
  console.log('6. Process Payment');
  console.log('7. Complete Payment');
  console.log('8. Fail Payment');
  console.log('9. Refund Payment');
  console.log('10. Cancel Payment');
  console.log('11. Retry Payment');
  console.log('12. Get Payment Summary');
  console.log('13. List Payments');
  console.log('14. Disconnect');
  console.log('15. Exit');
  console.log('==========================================');
  rl.question('Choose an option (1-15): ', handleChoice);
}

function handleChoice(choice) {
  switch (choice) {
    case '1':
      connect();
      break;
    case '2':
      authenticate();
      break;
    case '3':
      subscribeToPayments();
      break;
    case '4':
      subscribeToPayment();
      break;
    case '5':
      createPayment();
      break;
    case '6':
      processPayment();
      break;
    case '7':
      completePayment();
      break;
    case '8':
      failPayment();
      break;
    case '9':
      refundPayment();
      break;
    case '10':
      cancelPayment();
      break;
    case '11':
      retryPayment();
      break;
    case '12':
      getPaymentSummary();
      break;
    case '13':
      listPayments();
      break;
    case '14':
      disconnect();
      break;
    case '15':
      console.log('Goodbye! 👋');
      process.exit(0);
      break;
    default:
      console.log('❌ Invalid choice. Please try again.');
      showMenu();
  }
}

function connect() {
  if (socket) {
    console.log('⚠️  Already connected. Disconnect first.');
    showMenu();
    return;
  }

  console.log(`🔌 Connecting to ${PAYMENTS_SERVICE_URL}/payments...`);

  socket = io(`${PAYMENTS_SERVICE_URL}/payments`, {
    transports: ['websocket', 'polling'],
    auth: {
      token: 'demo-jwt-token-' + currentUserId
    }
  });

  socket.on('connect', () => {
    console.log('✅ Connected to Payments Service!');
    console.log(`🔗 Socket ID: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from Payments Service');
  });

  socket.on('connected', (data) => {
    console.log('📡 Welcome message:', data);
  });

  socket.on('authenticated', (data) => {
    console.log('🔐 Authentication successful:', data);
  });

  socket.on('authentication_failed', (data) => {
    console.log('❌ Authentication failed:', data);
  });

  socket.on('subscribed', (data) => {
    console.log('📢 Subscribed to:', data);
  });

  socket.on('unsubscribed', (data) => {
    console.log('🔕 Unsubscribed from:', data);
  });

  // Payment events
  socket.on('paymentCreated', (data) => {
    console.log('💳 PAYMENT CREATED:', JSON.stringify(data, null, 2));
  });

  socket.on('paymentProcessing', (data) => {
    console.log('⚙️  PAYMENT PROCESSING:', JSON.stringify(data, null, 2));
  });

  socket.on('paymentCompleted', (data) => {
    console.log('✅ PAYMENT COMPLETED:', JSON.stringify(data, null, 2));
  });

  socket.on('paymentFailed', (data) => {
    console.log('❌ PAYMENT FAILED:', JSON.stringify(data, null, 2));
  });

  socket.on('paymentRefunded', (data) => {
    console.log('💸 PAYMENT REFUNDED:', JSON.stringify(data, null, 2));
  });

  socket.on('paymentCancelled', (data) => {
    console.log('🚫 PAYMENT CANCELLED:', JSON.stringify(data, null, 2));
  });

  socket.on('error', (error) => {
    console.log('🚨 Socket Error:', error);
  });

  setTimeout(() => showMenu(), 1000);
}

function authenticate() {
  if (!socket) {
    console.log('❌ Not connected. Connect first.');
    showMenu();
    return;
  }

  const token = 'demo-jwt-token-' + currentUserId;
  console.log(`🔐 Authenticating with token: ${token}`);

  socket.emit('authenticate', { token });
  setTimeout(() => showMenu(), 1000);
}

function subscribeToPayments() {
  if (!socket) {
    console.log('❌ Not connected. Connect first.');
    showMenu();
    return;
  }

  console.log('📢 Subscribing to all payments...');
  socket.emit('subscribeToPayments');
  setTimeout(() => showMenu(), 500);
}

function subscribeToPayment() {
  if (!socket) {
    console.log('❌ Not connected. Connect first.');
    showMenu();
    return;
  }

  rl.question('Enter Payment ID to subscribe to: ', (paymentId) => {
    console.log(`📢 Subscribing to payment: ${paymentId}`);
    socket.emit('subscribeToPayment', { paymentId });
    setTimeout(() => showMenu(), 500);
  });
}

async function createPayment() {
  try {
    const orderId = 'demo-order-' + Math.random().toString(36).substr(2, 9);
    const amount = (Math.random() * 500 + 10).toFixed(2);

    console.log(`💳 Creating payment for order ${orderId}, amount: $${amount}`);

    const query = `
      mutation CreatePayment($input: CreatePaymentInput!) {
        createPayment(input: $input) {
          id
          orderId
          amount
          status
          paymentMethod
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        orderId,
        amount: parseFloat(amount),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentData: JSON.stringify({
          token: 'demo_payment_token_' + Date.now()
        })
      }
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.createPayment) {
      console.log('✅ Payment created successfully!');
      console.log(JSON.stringify(response.data.createPayment, null, 2));
      currentPaymentId = response.data.createPayment.id;
    } else {
      console.log('❌ Failed to create payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error creating payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function processPayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  try {
    console.log(`⚙️  Processing payment: ${currentPaymentId}`);

    const query = `
      mutation ProcessPayment($input: ProcessPaymentInput!) {
        processPayment(input: $input) {
          id
          status
          gatewayTransactionId
          updatedAt
        }
      }
    `;

    const variables = {
      input: {
        paymentId: currentPaymentId,
        gatewayTransactionId: 'gw_txn_' + Date.now()
      }
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.processPayment) {
      console.log('✅ Payment processing started!');
      console.log(JSON.stringify(response.data.processPayment, null, 2));
    } else {
      console.log('❌ Failed to process payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error processing payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function completePayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  try {
    console.log(`✅ Completing payment: ${currentPaymentId}`);

    const query = `
      mutation CompletePayment($paymentId: ID!, $transactionId: String) {
        completePayment(paymentId: $paymentId, transactionId: $transactionId) {
          id
          status
          transactionId
          processedAt
        }
      }
    `;

    const variables = {
      paymentId: currentPaymentId,
      transactionId: 'txn_' + Date.now()
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.completePayment) {
      console.log('✅ Payment completed successfully!');
      console.log(JSON.stringify(response.data.completePayment, null, 2));
    } else {
      console.log('❌ Failed to complete payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error completing payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function failPayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  try {
    console.log(`❌ Failing payment: ${currentPaymentId}`);

    const query = `
      mutation FailPayment($paymentId: ID!, $reason: String) {
        failPayment(paymentId: $paymentId, reason: $reason) {
          id
          status
          failureReason
        }
      }
    `;

    const variables = {
      paymentId: currentPaymentId,
      reason: 'Demo failure reason'
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.failPayment) {
      console.log('✅ Payment failed!');
      console.log(JSON.stringify(response.data.failPayment, null, 2));
    } else {
      console.log('❌ Failed to fail payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error failing payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function refundPayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  rl.question('Enter refund amount (leave empty for full refund): ', async (amount) => {
    try {
      console.log(`💸 Refunding payment: ${currentPaymentId}`);

      const query = `
        mutation RefundPayment($input: RefundPaymentInput!) {
          refundPayment(input: $input) {
            id
            status
            refundedAmount
            remainingAmount
            refundReason
          }
        }
      `;

      const variables = {
        input: {
          paymentId: currentPaymentId,
          amount: amount ? parseFloat(amount) : undefined,
          reason: 'Demo refund'
        }
      };

      const response = await graphqlRequest(query, variables);

      if (response.data?.refundPayment) {
        console.log('✅ Payment refunded successfully!');
        console.log(JSON.stringify(response.data.refundPayment, null, 2));
      } else {
        console.log('❌ Failed to refund payment:', response.errors);
      }
    } catch (error) {
      console.log('❌ Error refunding payment:', error.message);
    }

    setTimeout(() => showMenu(), 1000);
  });
}

async function cancelPayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  try {
    console.log(`🚫 Cancelling payment: ${currentPaymentId}`);

    const query = `
      mutation CancelPayment($input: CancelPaymentInput!) {
        cancelPayment(input: $input) {
          id
          status
          failureReason
        }
      }
    `;

    const variables = {
      input: {
        paymentId: currentPaymentId,
        reason: 'Demo cancellation'
      }
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.cancelPayment) {
      console.log('✅ Payment cancelled!');
      console.log(JSON.stringify(response.data.cancelPayment, null, 2));
    } else {
      console.log('❌ Failed to cancel payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error cancelling payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function retryPayment() {
  if (!currentPaymentId) {
    console.log('❌ No current payment. Create a payment first.');
    showMenu();
    return;
  }

  try {
    console.log(`🔄 Retrying payment: ${currentPaymentId}`);

    const query = `
      mutation RetryPayment($paymentId: ID!) {
        retryPayment(paymentId: $paymentId)
      }
    `;

    const variables = {
      paymentId: currentPaymentId
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.retryPayment) {
      console.log('✅ Payment retry initiated!');
    } else {
      console.log('❌ Failed to retry payment:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error retrying payment:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function getPaymentSummary() {
  try {
    console.log('📊 Getting payment summary...');

    const query = `
      query GetPaymentSummary {
        paymentSummary {
          totalAmount
          totalRefunded
          totalPayments
          successfulPayments
          failedPayments
          pendingPayments
        }
      }
    `;

    const response = await graphqlRequest(query);

    if (response.data?.paymentSummary) {
      console.log('📊 Payment Summary:');
      console.log(JSON.stringify(response.data.paymentSummary, null, 2));
    } else {
      console.log('❌ Failed to get payment summary:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error getting payment summary:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

async function listPayments() {
  try {
    console.log('📋 Listing payments...');

    const query = `
      query ListPayments($pagination: PaginationInput) {
        payments(pagination: $pagination) {
          payments {
            id
            orderId
            amount
            status
            paymentMethod
            createdAt
          }
          totalCount
          hasMore
        }
      }
    `;

    const variables = {
      pagination: {
        take: 5
      }
    };

    const response = await graphqlRequest(query, variables);

    if (response.data?.payments) {
      console.log('📋 Recent Payments:');
      console.log(JSON.stringify(response.data.payments, null, 2));
    } else {
      console.log('❌ Failed to list payments:', response.errors);
    }
  } catch (error) {
    console.log('❌ Error listing payments:', error.message);
  }

  setTimeout(() => showMenu(), 1000);
}

function disconnect() {
  if (socket) {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    socket = null;
  } else {
    console.log('⚠️  Not connected.');
  }
  setTimeout(() => showMenu(), 500);
}

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer demo-jwt-token-${currentUserId}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  return await response.json();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (socket) {
    socket.disconnect();
  }
  process.exit(0);
});

// Start the application
console.log('🎯 Payments Service WebSocket Test Client');
console.log(`📍 Service URL: ${PAYMENTS_SERVICE_URL}`);
console.log(`👤 Current User ID: ${currentUserId}`);
showMenu();