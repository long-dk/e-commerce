import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../../libs/shared/src/auth/jwt-auth.guard';
import {
  NotificationType,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilters,
  PaginatedNotification,
  NotificationSummary,
} from './notification.types';

@Resolver(() => NotificationType)
export class NotificationResolver {
  constructor(private readonly service: NotificationService) {}

  @Query(() => NotificationType)
  @UseGuards(JwtAuthGuard)
  getNotification(@Args('id') id: string) {
    return this.service.findOne(id);
  }

  @Query(() => PaginatedNotification)
  @UseGuards(JwtAuthGuard)
  getNotifications(
    @Args('filters', { nullable: true }) filters?: NotificationFilters,
    @Args('page', { defaultValue: 1 }) page?: number,
    @Args('limit', { defaultValue: 20 }) limit?: number,
  ) {
    return this.service.findAll(filters || {}, page, limit);
  }

  @Query(() => NotificationSummary)
  @UseGuards(JwtAuthGuard)
  getNotificationSummary(@Args('userId') userId: string) {
    return this.service.getSummary(userId);
  }

  @Mutation(() => NotificationType)
  @UseGuards(JwtAuthGuard)
  createNotification(@Args('input') input: CreateNotificationInput) {
    return this.service.create(input);
  }

  @Mutation(() => NotificationType)
  @UseGuards(JwtAuthGuard)
  updateNotification(@Args('id') id: string, @Args('input') input: UpdateNotificationInput) {
    return this.service.update(id, input);
  }

  @Mutation(() => NotificationType)
  @UseGuards(JwtAuthGuard)
  markNotificationRead(@Args('id') id: string) {
    return this.service.markAsRead(id);
  }

  @Subscription(() => NotificationType, {
    resolve: (payload) => payload.notificationCreated,
  })
  notificationCreated() {
    return this.service['pubSub'].asyncIterator('notificationCreated');
  }

  @Subscription(() => NotificationType, {
    resolve: (payload) => payload.notificationUpdated,
  })
  notificationUpdated() {
    return this.service['pubSub'].asyncIterator('notificationUpdated');
  }

  @Subscription(() => NotificationType, {
    resolve: (payload) => payload.notificationRead,
  })
  notificationRead() {
    return this.service['pubSub'].asyncIterator('notificationRead');
  }
}
