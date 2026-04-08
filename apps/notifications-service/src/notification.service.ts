import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { Notification, NotificationStatus, NotificationChannel } from './notification.entity';
import {
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilters,
  PaginatedNotification,
  NotificationSummary,
  NotificationType,
} from './notification.types';
import { LoggerService } from '@app/common';

@Injectable()
export class NotificationService {
    constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    private readonly logger: LoggerService,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationType> {
    const notificationData = {
      userId: input.userId,
      title: input.title,
      message: input.message,
      channel: input.channel ?? NotificationChannel.INAPP,
      status: input.status ?? NotificationStatus.PENDING,
      payload: input.payload ? JSON.parse(input.payload as string) : undefined,
    };

    const notification = this.notificationRepository.create(notificationData as any);
    const saved = await this.notificationRepository.save(notification);
    const result = saved as unknown as NotificationType;

    await this.pubSub.publish('notificationCreated', { notificationCreated: result });
    return result;
  }

  async findOne(id: string): Promise<NotificationType> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification as NotificationType;
  }

  async findAll(filters: NotificationFilters = {}, page = 1, limit = 20): Promise<PaginatedNotification> {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.channel) where.channel = filters.channel;

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      items: items as NotificationType[],
      total,
      page,
      limit,
    };
  }

  async update(id: string, input: UpdateNotificationInput): Promise<NotificationType> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);

    if (input.title) notification.title = input.title;
    if (input.message) notification.message = input.message;
    if (input.status) notification.status = input.status;
    if (input.payload) notification.payload = input.payload as string;
    if (input.readAt) notification.readAt = input.readAt;

    const saved = await this.notificationRepository.save(notification);
    const result = saved as NotificationType;
    await this.pubSub.publish('notificationUpdated', { notificationUpdated: result });

    return result;
  }

  async markAsRead(id: string): Promise<NotificationType> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (notification.status === NotificationStatus.READ) return notification as NotificationType;

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();

    const saved = await this.notificationRepository.save(notification);
    const result = saved as NotificationType;
    await this.pubSub.publish('notificationRead', { notificationRead: result });
    return result;
  }

  async getSummary(userId: string): Promise<NotificationSummary> {
    const total = await this.notificationRepository.count({ where: { userId } });
    const unread = await this.notificationRepository.count({
      where: { userId, status: NotificationStatus.PENDING },
    });

    return { total, unread };
  }

  async handleEvent(eventType: string, payload: any): Promise<void> {
    try {
      const message = `Event ${eventType}`;
      let title = 'Notification';
      let channel = 'INAPP';

      switch (eventType) {
        case 'order.created':
          title = 'Order Created';
          channel = 'INAPP';
          break;
        case 'payment.processed':
          title = 'Payment Processed';
          channel = 'INAPP';
          break;
        case 'shipping.shipped':
          title = 'Shipping Update';
          channel = 'INAPP';
          break;
        case 'shipping.delivered':
          title = 'Delivery Update';
          channel = 'INAPP';
          break;
        case 'inventory.low':
          title = 'Low Inventory Alert';
          channel = 'INAPP';
          break;
      }

      await this.create({
        userId: payload.userId ?? 'system',
        title,
        message: `${message} for ${payload.orderId ?? payload.productId ?? 'n/a'}`,
        channel: NotificationChannel.INAPP,
        status: NotificationStatus.PENDING,
        payload: JSON.stringify(payload),
      });
    } catch (error) {
      this.logger.error(`Failed to handle event ${eventType}`, error as any);
    }
  }
}