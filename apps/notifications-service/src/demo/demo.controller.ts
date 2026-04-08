import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { CreateNotificationInput, NotificationFilters } from '../notification.types';

@Controller('demo/notifications')
export class DemoController {
  constructor(private readonly notificationsService: NotificationService) {}

  @Get()
  async getAll(@Param('page') page = '1', @Param('limit') limit = '20') {
    return this.notificationsService.findAll({}, Number(page), Number(limit));
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

  @Post()
  async create(@Body() input: CreateNotificationInput) {
    return this.notificationsService.create(input);
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Get('summary/:userId')
  async summary(@Param('userId') userId: string) {
    return this.notificationsService.getSummary(userId);
  }
}