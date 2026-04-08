import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@app/common';
import { Order } from './order.types';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  namespace: '/orders',
})
@Injectable()
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    console.log(`Order client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Order client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // In a real implementation, validate JWT token and extract user ID
      // For demo purposes, we'll use a mock user ID
      const userId = 'user-' + client.id.substring(0, 8);
      this.connectedClients.set(client.id, userId);

      client.emit('authenticated', { userId });
      console.log(`Order client authenticated: ${client.id} -> ${userId}`);
    } catch (error) {
      client.emit('error', { message: 'Authentication failed' });
    }
  }

  @SubscribeMessage('subscribeToOrders')
  handleSubscribeToOrders(@ConnectedSocket() client: Socket) {
    const userId = this.connectedClients.get(client.id);
    if (userId) {
      client.join(`user:${userId}`);
      client.emit('subscribed', { channel: `user:${userId}` });
    } else {
      client.emit('error', { message: 'Not authenticated' });
    }
  }

  @SubscribeMessage('subscribeToOrder')
  handleSubscribeToOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.connectedClients.get(client.id);
    if (userId) {
      client.join(`order:${data.orderId}`);
      client.emit('subscribed', { channel: `order:${data.orderId}` });
    } else {
      client.emit('error', { message: 'Not authenticated' });
    }
  }

  @SubscribeMessage('unsubscribeFromOrder')
  handleUnsubscribeFromOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`order:${data.orderId}`);
    client.emit('unsubscribed', { channel: `order:${data.orderId}` });
  }

  // Real-time event emitters
  emitOrderCreated(order: Order) {
    // Emit to user's room
    this.server.to(`user:${order.userId}`).emit('orderCreated', {
      order,
      timestamp: new Date().toISOString(),
    });

    // Emit globally for admin dashboards
    this.server.emit('orderCreated', {
      order: { ...order, userId: undefined }, // Don't expose user ID globally
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderUpdated(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderUpdated', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderUpdated', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderConfirmed(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderConfirmed', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderConfirmed', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderCancelled(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderCancelled', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderCancelled', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderShipped(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderShipped', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderShipped', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderDelivered(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderDelivered', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderDelivered', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderRefunded(order: Order) {
    this.server.to(`user:${order.userId}`).emit('orderRefunded', {
      order,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('orderRefunded', {
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitPaymentStatusUpdated(order: Order) {
    this.server.to(`user:${order.userId}`).emit('paymentStatusUpdated', {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`order:${order.id}`).emit('paymentStatusUpdated', {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // Bulk operations for admin dashboards
  emitBulkOrdersUpdate(orders: Order[]) {
    this.server.emit('bulkOrdersUpdate', {
      orders,
      count: orders.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Activity feed for admin monitoring
  emitOrderActivity(activity: {
    type: string;
    orderId: string;
    userId: string;
    message: string;
    metadata?: any;
  }) {
    this.server.emit('orderActivity', {
      ...activity,
      timestamp: new Date().toISOString(),
    });
  }
}