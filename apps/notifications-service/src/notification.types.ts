import { Field, ObjectType, InputType, Int, OmitType } from '@nestjs/graphql';
import { Notification, NotificationStatus, NotificationChannel } from './notification.entity';

@ObjectType()
export class NotificationType extends Notification {}

@InputType()
export class CreateNotificationInput {
  @Field()
  userId: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => NotificationChannel, { nullable: true })
  channel?: NotificationChannel;

  @Field(() => NotificationStatus, { nullable: true })
  status?: NotificationStatus;

  @Field({ nullable: true })
  payload?: string;
}

@InputType()
export class UpdateNotificationInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  message?: string;

  @Field(() => NotificationStatus, { nullable: true })
  status?: NotificationStatus;

  @Field({ nullable: true })
  payload?: string;

  @Field({ nullable: true })
  readAt?: Date;
}

@InputType()
export class NotificationFilters {
  @Field({ nullable: true })
  userId?: string;

  @Field(() => NotificationStatus, { nullable: true })
  status?: NotificationStatus;

  @Field(() => NotificationChannel, { nullable: true })
  channel?: NotificationChannel;
}

@ObjectType()
export class PaginatedNotification {
  @Field(() => [NotificationType])
  items: NotificationType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@ObjectType()
export class NotificationSummary {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  unread: number;
}