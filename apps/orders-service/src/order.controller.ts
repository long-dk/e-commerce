import { Controller, Get } from '@nestjs/common';
import { OrderService } from './order.service';
import { LoggerService } from '@app/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly logger: LoggerService,
  ) {}

  @EventPattern('payment.processed')
  async handlePaymentProcessed(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `Received event on topic "${topic}" (partition: ${partition}, offset: ${offset}): ${JSON.stringify(data)}`,
      OrderController.name,
    );

    try {
      await this.orderService.handlePaymentProcessed(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(offset, 10) + 1).toString(),
        },
      ]);
      this.logger.log(
        `Successfully processed event and committed offset ${offset} for topic "${topic}"`,
        OrderController.name,
      );
    } catch (error) {
      this.logger.error('Error processing payment.processed event', error, OrderController.name);
      // Optionally, implement retry logic or send the message to a dead-letter topic
    }
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `Received event on topic "${topic}" (partition: ${partition}, offset: ${offset}): ${JSON.stringify(data)}`,
      OrderController.name,
    );

    try {
      await this.orderService.handlePaymentFailed(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(offset, 10) + 1).toString(),
        },
      ]);
      this.logger.log(
        `Successfully processed event and committed offset ${offset} for topic "${topic}"`,
        OrderController.name,
      );
    } catch (error) {
      this.logger.error('Error processing payment.failed event', error, OrderController.name);
      // Optionally, implement retry logic or send the message to a dead-letter topic
    }
  }

  @EventPattern('inventory.reserved')
  async handleInventoryReserved(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `Received event on topic "${topic}" (partition: ${partition}, offset: ${offset}): ${JSON.stringify(data)}`,
      OrderController.name,
    );

    try {
      await this.orderService.handleInventoryReserved(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(offset, 10) + 1).toString(),
        },
      ]);
      this.logger.log(
        `Successfully processed event and committed offset ${offset} for topic "${topic}"`,
        OrderController.name,
      );
    } catch (error) {
      this.logger.error('Error processing inventory.reserved event', error, OrderController.name);
      // Optionally, implement retry logic or send the message to a dead-letter topic
    }
  }

  @EventPattern('shipping.created')
  async handleShippingCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;

    this.logger.log(
      `Received event on topic "${topic}" (partition: ${partition}, offset: ${offset}): ${JSON.stringify(data)}`,
      OrderController.name,
    );

    try {
      await this.orderService.handleShippingCreated(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(offset, 10) + 1).toString(),
        },
      ]);
      this.logger.log(
        `Successfully processed event and committed offset ${offset} for topic "${topic}"`,
        OrderController.name,
      );
    } catch (error) {
      this.logger.error('Error processing shipping.created event', error, OrderController.name);
      // Optionally, implement retry logic or send the message to a dead-letter topic
    }
  }

  @Get()
  getHello(): string {
    return this.orderService.getHello();
  }
}
