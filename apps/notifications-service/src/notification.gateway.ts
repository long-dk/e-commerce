import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationService } from './notification.service';
import { NotificationChannel } from './notification.entity';

@WebSocketGateway({ namespace: '/notifications', cors: true })
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly notificationsService: NotificationService) {}

  @SubscribeMessage('sendNotification')
  async handleSendNotification(@MessageBody() body: { userId: string; title: string; message: string }, @ConnectedSocket() socket: Socket) {
    const notification = await this.notificationsService.create({
      userId: body.userId,
      title: body.title,
      message: body.message,
      channel: NotificationChannel.INAPP,
    });

    this.server.to(body.userId).emit('notification', notification);
    return notification;
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: { userId: string }, @ConnectedSocket() socket: Socket) {
    socket.join(data.userId);
    return { joined: data.userId };
  }
}
