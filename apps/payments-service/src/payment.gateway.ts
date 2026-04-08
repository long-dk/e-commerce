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
import { JwtAuthGuard } from '../../../libs/shared/src/auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { LoggerService } from '@app/common';

@WebSocketGateway({
  namespace: '/payments',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class PaymentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, string>(); // socketId -> userId

  constructor(
    private readonly paymentService: PaymentService,
    private readonly logger: LoggerService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        client.disconnect();
        return;
      }

      // In a real implementation, you'd validate the JWT token here
      // For demo purposes, we'll accept any token
      const userId = this.extractUserIdFromToken(token);
      this.connectedClients.set(client.id, userId);

      this.logger.log(`Payment client connected: ${client.id} (user: ${userId})`);

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to Payments Service',
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);
    this.logger.log(`Payment client disconnected: ${client.id} (user: ${userId})`);
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.extractUserIdFromToken(data.token);
      this.connectedClients.set(client.id, userId);

      client.emit('authenticated', {
        success: true,
        userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Payment client authenticated: ${client.id} (user: ${userId})`);
    } catch (error) {
      client.emit('authentication_failed', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribeToPayments')
  handleSubscribeToPayments(@ConnectedSocket() client: Socket) {
    const userId = this.connectedClients.get(client.id);
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    client.join(`user:${userId}`);
    client.emit('subscribed', {
      channel: 'payments',
      userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Client ${client.id} subscribed to payments for user ${userId}`);
  }

  @SubscribeMessage('subscribeToPayment')
  handleSubscribeToPayment(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.connectedClients.get(client.id);
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    client.join(`payment:${data.paymentId}`);
    client.emit('subscribed', {
      channel: 'payment',
      paymentId: data.paymentId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Client ${client.id} subscribed to payment ${data.paymentId}`);
  }

  @SubscribeMessage('unsubscribeFromPayment')
  handleUnsubscribeFromPayment(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`payment:${data.paymentId}`);
    client.emit('unsubscribed', {
      channel: 'payment',
      paymentId: data.paymentId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Client ${client.id} unsubscribed from payment ${data.paymentId}`);
  }

  // Event emission methods called by the service
  emitPaymentCreated(payment: any) {
    this.server.to(`user:${payment.userId}`).emit('paymentCreated', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentCreated', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment created event emitted: ${payment.id}`);
  }

  emitPaymentProcessing(payment: any) {
    this.server.to(`user:${payment.userId}`).emit('paymentProcessing', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentProcessing', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment processing event emitted: ${payment.id}`);
  }

  emitPaymentCompleted(payment: any) {
    this.server.to(`user:${payment.userId}`).emit('paymentCompleted', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentCompleted', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment completed event emitted: ${payment.id}`);
  }

  emitPaymentFailed(payment: any) {
    this.server.to(`user:${payment.userId}`).emit('paymentFailed', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentFailed', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment failed event emitted: ${payment.id}`);
  }

  emitPaymentRefunded(payment: any, refundAmount: number) {
    this.server.to(`user:${payment.userId}`).emit('paymentRefunded', {
      payment,
      refundAmount,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentRefunded', {
      payment,
      refundAmount,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment refunded event emitted: ${payment.id}, amount: ${refundAmount}`);
  }

  emitPaymentCancelled(payment: any) {
    this.server.to(`user:${payment.userId}`).emit('paymentCancelled', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.server.to(`payment:${payment.id}`).emit('paymentCancelled', {
      payment,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Payment cancelled event emitted: ${payment.id}`);
  }

  // Utility method to extract user ID from JWT token
  private extractUserIdFromToken(token: string): string {
    // In a real implementation, you'd decode and validate the JWT
    // For demo purposes, we'll use a simple extraction
    try {
      // This is just for demo - in production, use proper JWT verification
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.userId || 'demo-user';
    } catch (error) {
      // Fallback for demo
      return 'demo-user-' + Math.random().toString(36).substr(2, 9);
    }
  }
}