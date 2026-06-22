import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationChannel } from './notification.entity';
import { CreateNotificationInput } from './notification.types';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectRepository(Notification) private readonly notiRepo: Repository<Notification>
  ) {}

  create(entityLike: DeepPartial<Notification>): Notification {
    return this.notiRepo.create(entityLike)
  }

  async save(entity: Notification): Promise<Notification> {
    return this.notiRepo.save(entity);
  }

  async findOne(options: FindOneOptions<Notification>): Promise<Notification | null> {
    return this.notiRepo.findOne(options);
  }

  async count(options?: FindManyOptions<Notification>): Promise<number> {
    return this.notiRepo.count(options);
  }

  async findAndCount(options?: FindManyOptions<Notification>): Promise<[Notification[], number]> {
    return this.notiRepo.findAndCount(options);
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const data = {
      userId: input.userId,
      title: input.title,
      message: input.message,
      channel: input.channel ?? NotificationChannel.INAPP,
      status: input.status ?? NotificationStatus.PENDING,
      payload: input.payload ? JSON.parse(input.payload as string) : undefined,
    };

    const notification = this.create(data);
    return this.save(notification);
  }
}
