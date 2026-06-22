import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationChannel } from './notification.entity';
import { NotificationRepository } from './notification.repository';
import { NotificationType } from './notification.types';

@WebSocketGateway({ namespace: '/notifications', cors: true })
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly notificationRepository: NotificationRepository) {}

  @SubscribeMessage('sendNotification')
  async handleSendNotification(@MessageBody() body: { userId: string; title: string; message: string }, @ConnectedSocket() socket: Socket) {
    const input = {
      userId: body.userId,
      title: body.title,
      message: body.message,
      channel: NotificationChannel.INAPP,
    };
    const res = await this.notificationRepository.createNotification(input);
    const notification = res as unknown as NotificationType;

    this.server.to(body.userId).emit('notification', notification);
    return notification;
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: { userId: string }, @ConnectedSocket() socket: Socket) {
    socket.join(data.userId);
    return { joined: data.userId };
  }
}
