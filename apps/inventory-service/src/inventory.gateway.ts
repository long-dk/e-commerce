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
import { Inject, UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { InventoryService } from './inventory.service';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/inventory',
})
export class InventoryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly jwtService: JwtService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    // Subscribe to GraphQL pubsub events and broadcast to WebSocket clients
    this.setupPubSubSubscriptions();
  }

  async handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (token) {
        const payload = this.jwtService.verify(token);
        client.user = payload;
        this.connectedClients.set(client.id, client);

        console.log(`Inventory WebSocket client connected: ${client.id}, user: ${payload.sub}`);

        // Send welcome message
        client.emit('connected', {
          message: 'Connected to inventory service',
          userId: payload.sub,
          timestamp: new Date().toISOString(),
        });
      } else {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
      }
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      client.emit('error', { message: 'Invalid authentication token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    console.log(`Inventory WebSocket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribeToInventory')
  handleSubscribeToInventory(
    @MessageBody() data: { productIds?: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { productIds } = data;

    if (productIds && productIds.length > 0) {
      // Join rooms for specific products
      productIds.forEach(productId => {
        client.join(`inventory:${productId}`);
      });

      client.emit('subscribed', {
        message: `Subscribed to inventory updates for products: ${productIds.join(', ')}`,
        productIds,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Subscribe to all inventory updates
      client.join('inventory:all');

      client.emit('subscribed', {
        message: 'Subscribed to all inventory updates',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('unsubscribeFromInventory')
  handleUnsubscribeFromInventory(
    @MessageBody() data: { productIds?: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { productIds } = data;

    if (productIds && productIds.length > 0) {
      // Leave rooms for specific products
      productIds.forEach(productId => {
        client.leave(`inventory:${productId}`);
      });

      client.emit('unsubscribed', {
        message: `Unsubscribed from inventory updates for products: ${productIds.join(', ')}`,
        productIds,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Unsubscribe from all inventory updates
      client.leave('inventory:all');

      client.emit('unsubscribed', {
        message: 'Unsubscribed from all inventory updates',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribeToAlerts')
  handleSubscribeToAlerts(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.join('inventory:alerts');

    client.emit('alertsSubscribed', {
      message: 'Subscribed to inventory alerts',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribeFromAlerts')
  handleUnsubscribeFromAlerts(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.leave('inventory:alerts');

    client.emit('alertsUnsubscribed', {
      message: 'Unsubscribed from inventory alerts',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('getInventoryStatus')
  async handleGetInventoryStatus(
    @MessageBody() data: { productId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { productId } = data;
      const inventory = await this.inventoryService.findByProductId(productId);

      if (inventory) {
        client.emit('inventoryStatus', {
          productId,
          inventory,
          timestamp: new Date().toISOString(),
        });
      } else {
        client.emit('inventoryStatus', {
          productId,
          inventory: null,
          message: 'Product not found in inventory',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      client.emit('error', {
        message: 'Failed to get inventory status',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('checkStock')
  async handleCheckStock(
    @MessageBody() data: { productId: string; quantity: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const { productId, quantity } = data;
      const result = await this.inventoryService.checkStock(productId, quantity);

      client.emit('stockCheckResult', {
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      client.emit('error', {
        message: 'Failed to check stock',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private setupPubSubSubscriptions() {
    // Subscribe to GraphQL pubsub events and broadcast to WebSocket clients
    this.pubSub.subscribe('inventoryCreated', (payload) => {
      const inventory = payload.inventoryCreated;
      this.broadcastInventoryUpdate('inventoryCreated', inventory);
    });

    this.pubSub.subscribe('inventoryUpdated', (payload) => {
      const inventory = payload.inventoryUpdated;
      this.broadcastInventoryUpdate('inventoryUpdated', inventory);
    });

    this.pubSub.subscribe('inventoryDeleted', (payload) => {
      const inventoryId = payload.inventoryDeleted;
      this.broadcastInventoryDeletion('inventoryDeleted', inventoryId);
    });

    this.pubSub.subscribe('lowStockAlert', (payload) => {
      const inventory = payload.lowStockAlert;
      this.broadcastAlert('lowStockAlert', inventory);
    });

    this.pubSub.subscribe('outOfStockAlert', (payload) => {
      const inventory = payload.outOfStockAlert;
      this.broadcastAlert('outOfStockAlert', inventory);
    });

    this.pubSub.subscribe('reorderAlert', (payload) => {
      const inventory = payload.reorderAlert;
      this.broadcastAlert('reorderAlert', inventory);
    });
  }

  private broadcastInventoryUpdate(event: string, inventory: any) {
    // Broadcast to all clients subscribed to this product
    this.server.to(`inventory:${inventory.productId}`).emit(event, {
      inventory,
      timestamp: new Date().toISOString(),
    });

    // Also broadcast to clients subscribed to all inventory updates
    this.server.to('inventory:all').emit(event, {
      inventory,
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastInventoryDeletion(event: string, inventoryId: string) {
    // Broadcast to all clients (since we don't know the product ID for deleted items)
    this.server.emit(event, {
      inventoryId,
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastAlert(event: string, inventory: any) {
    // Broadcast alerts to clients subscribed to alerts
    this.server.to('inventory:alerts').emit(event, {
      inventory,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit custom events from service layer
  emitInventoryEvent(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitToProduct(productId: string, event: string, data: any) {
    this.server.to(`inventory:${productId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitToAll(event: string, data: any) {
    this.server.to('inventory:all').emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitAlert(event: string, data: any) {
    this.server.to('inventory:alerts').emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}