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
import { JwtService } from '@nestjs/jwt';
import { ShippingRepository } from './shipping.repository';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

@WebSocketGateway({
  namespace: '/shipping',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class ShippingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly shippingRepository: ShippingRepository,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (!token) {
      client.emit('unauthorized', { message: 'Missing token' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      client.user = payload;
      client.emit('connected', { message: 'Connected to shipping gateway', user: payload.sub });
    } catch (err) {
      client.emit('unauthorized', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // noop
  }

  broadcastShippingEvent(event: string, payload: any) {
    this.server.emit(event, { payload });
  }

  @SubscribeMessage('shipOrder')
  async handleShipOrder(
    @MessageBody() data: { orderId: string; carrier: string; trackingNumber: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const shipment = await this.shippingRepository.markAsShipped(data.orderId, data.carrier, data.trackingNumber);
      this.broadcastShippingEvent('shipmentUpdated', shipment);
      return { success: true, shipment };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  }

  @SubscribeMessage('trackShipment')
  async handleTrackShipment(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const shipment = await this.shippingRepository.findByOrderId(data.orderId);
    return { shipment };
  }
}
