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
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ProductService } from './product.service';
import { LoggerService } from '@app/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/products',
})
@Injectable()
export class ProductGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private connectedClients = new Map<string, Socket>();

  constructor(
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
    private readonly logger: LoggerService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send initial data
    client.emit('connection', {
      message: 'Connected to Products Service',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribeToProduct')
  async handleSubscribeToProduct(
    @MessageBody() data: { productId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { productId } = data;
    this.logger.log(`Client ${client.id} subscribed to product ${productId}`);

    // Join product-specific room
    client.join(`product:${productId}`);

    // Send current product data
    try {
      const product = await this.productService.findOne(productId);
      client.emit('productUpdate', {
        productId,
        product,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      client.emit('error', {
        message: 'Product not found',
        productId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribeToCategory')
  async handleSubscribeToCategory(
    @MessageBody() data: { category: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { category } = data;
    this.logger.log(`Client ${client.id} subscribed to category ${category}`);

    // Join category-specific room
    client.join(`category:${category}`);

    client.emit('subscription', {
      type: 'category',
      category,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribeFromProduct')
  handleUnsubscribeFromProduct(
    @MessageBody() data: { productId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { productId } = data;
    this.logger.log(`Client ${client.id} unsubscribed from product ${productId}`);

    client.leave(`product:${productId}`);

    client.emit('unsubscription', {
      type: 'product',
      productId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribeFromCategory')
  handleUnsubscribeFromCategory(
    @MessageBody() data: { category: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { category } = data;
    this.logger.log(`Client ${client.id} unsubscribed from category ${category}`);

    client.leave(`category:${category}`);

    client.emit('unsubscription', {
      type: 'category',
      category,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('getConnectedClients')
  handleGetConnectedClients(@ConnectedSocket() client: Socket) {
    client.emit('connectedClients', {
      count: this.connectedClients.size,
      timestamp: new Date().toISOString(),
    });
  }

  // Methods to emit events from ProductService
  emitProductCreated(product: any) {
    this.logger.log(`Emitting product created: ${product.id}`);

    // Emit to all clients
    this.server.emit('productCreated', {
      product,
      timestamp: new Date().toISOString(),
    });

    // Emit to category room
    this.server.to(`category:${product.category}`).emit('categoryProductCreated', {
      product,
      timestamp: new Date().toISOString(),
    });
  }

  emitProductUpdated(product: any) {
    this.logger.log(`Emitting product updated: ${product.id}`);

    // Emit to all clients
    this.server.emit('productUpdated', {
      product,
      timestamp: new Date().toISOString(),
    });

    // Emit to product-specific room
    this.server.to(`product:${product.id}`).emit('productUpdate', {
      productId: product.id,
      product,
      timestamp: new Date().toISOString(),
    });

    // Emit to category room
    this.server.to(`category:${product.category}`).emit('categoryProductUpdated', {
      product,
      timestamp: new Date().toISOString(),
    });
  }

  emitProductDeleted(productId: string, category: string) {
    this.logger.log(`Emitting product deleted: ${productId}`);

    // Emit to all clients
    this.server.emit('productDeleted', {
      productId,
      timestamp: new Date().toISOString(),
    });

    // Emit to product-specific room
    this.server.to(`product:${productId}`).emit('productDeleted', {
      productId,
      timestamp: new Date().toISOString(),
    });

    // Emit to category room
    this.server.to(`category:${category}`).emit('categoryProductDeleted', {
      productId,
      category,
      timestamp: new Date().toISOString(),
    });
  }

  emitStockUpdated(productId: string, previousStock: number, newStock: number, reason: string) {
    this.logger.log(`Emitting stock updated: ${productId} (${previousStock} -> ${newStock})`);

    const stockUpdate = {
      productId,
      previousStock,
      newStock,
      reason,
      timestamp: new Date().toISOString(),
    };

    // Emit to all clients
    this.server.emit('stockUpdated', stockUpdate);

    // Emit to product-specific room
    this.server.to(`product:${productId}`).emit('productStockUpdate', stockUpdate);
  }

  emitLowStockAlert(productId: string, productName: string, currentStock: number, minStockLevel: number) {
    this.logger.warn(`Low stock alert: ${productName} (${currentStock}/${minStockLevel})`);

    const alert = {
      productId,
      productName,
      currentStock,
      minStockLevel,
      timestamp: new Date().toISOString(),
    };

    // Emit to all clients
    this.server.emit('lowStockAlert', alert);
  }
}