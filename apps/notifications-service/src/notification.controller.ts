import { Controller } from '@nestjs/common';
import { Payload, EventPattern, Ctx, KafkaContext } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { LoggerService } from '@app/common';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationsService: NotificationService,
    private readonly logger: LoggerService,
  ) {}

  @EventPattern('order.created')
  async onOrderCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event on topic ${topic} partition ${partition} offset ${offset}`);
    this.logger.log(`Message payload: ${JSON.stringify(data)}`);
    try {
      await this.notificationsService.handleEvent('order.created', data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(), // Commit the next offset to mark this message as processed
      }]);
      this.logger.log(`Successfully processed order.created event and committed offset ${offset}`);
    } catch (error) {
      this.logger.error('Error processing order.created event', error);
      // Depending on the error, you might want to implement retry logic here or let the framework handle it based on the retry configuration.
    }
  }

  @EventPattern('payment.processed')
  async onPaymentProcessed(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event on topic ${topic} partition ${partition} offset ${offset}`);
    this.logger.log(`Message payload: ${JSON.stringify(data)}`);
    try {
      await this.notificationsService.handleEvent('payment.processed', data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(), // Commit the next offset to mark this message as processed
      }]);
      this.logger.log(`Successfully processed payment.processed event and committed offset ${offset}`);
    } catch (error) {
      this.logger.error('Error processing payment.processed event', error);
      // Depending on the error, you might want to implement retry logic here or let the framework handle it based on the retry configuration.
    }
  }

  @EventPattern('shipping.shipped')
  async onShippingShipped(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event on topic ${topic} partition ${partition} offset ${offset}`);
    this.logger.log(`Message payload: ${JSON.stringify(data)}`);
    try {
      await this.notificationsService.handleEvent('shipping.shipped', data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(), // Commit the next offset to mark this message as processed
      }]);
      this.logger.log(`Successfully processed shipping.shipped event and committed offset ${offset}`);
    } catch (error) {
      this.logger.error('Error processing shipping.shipped event', error);
      // Depending on the error, you might want to implement retry logic here or let the framework handle it based on the retry configuration.
    }
  }

  @EventPattern('shipping.delivered')
  async onShippingDelivered(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event on topic ${topic} partition ${partition} offset ${offset}`);
    this.logger.log(`Message payload: ${JSON.stringify(data)}`);
    try {
      await this.notificationsService.handleEvent('shipping.delivered', data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(), // Commit the next offset to mark this message as processed
      }]);
      this.logger.log(`Successfully processed shipping.delivered event and committed offset ${offset}`);
    } catch (error) {
      this.logger.error('Error processing shipping.delivered event', error);
      // Depending on the error, you might want to implement retry logic here or let the framework handle it based on the retry configuration.
    }
  }

  @EventPattern('inventory.low')
  async onInventoryLow(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event on topic ${topic} partition ${partition} offset ${offset}`);
    this.logger.log(`Message payload: ${JSON.stringify(data)}`);
    try {
      await this.notificationsService.handleEvent('inventory.low', data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(), // Commit the next offset to mark this message as processed
      }]);
      this.logger.log(`Successfully processed inventory.low event and committed offset ${offset}`);
    } catch (error) {
      this.logger.error('Error processing inventory.low event', error);
      // Depending on the error, you might want to implement retry logic here or let the framework handle it based on the retry configuration.
    }
  }
}
