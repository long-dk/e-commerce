import { Controller, Get } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { ShippingKafkaService } from './shipping.kafka';
import { LoggerService } from '@app/common';

@Controller()
export class ShippingController {
  constructor(
    private readonly shippingKafkaService: ShippingKafkaService,
    private readonly shippingService: ShippingService,
    private readonly logger: LoggerService
  ) {}

  @EventPattern('order.shipped')
  async handleOrderShipped(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event ${topic} from partition ${partition} at offset ${offset}`, ShippingController.name);
    this.logger.debug(`Event data: ${JSON.stringify(data)}`, ShippingController.name);
    try {
      await this.shippingKafkaService.handleOrderShipped(data);
      await context.getConsumer().commitOffsets([{ topic, partition, offset: (Number(offset) + 1).toString() }]);
    } catch (error) {
      this.logger.error('Failed to handle order.shipped event', error, ShippingController.name);
    }
  }

  @EventPattern('order.delivered')
  async handleOrderDelivered(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event ${topic} from partition ${partition} at offset ${offset}`, ShippingController.name);
    this.logger.debug(`Event data: ${JSON.stringify(data)}`, ShippingController.name);
    try {
      await this.shippingKafkaService.handleOrderDelivered(data);
      await context.getConsumer().commitOffsets([{ topic, partition, offset: (Number(offset) + 1).toString() }]);
    } catch (error) {
      this.logger.error('Failed to handle order.delivered event', error, ShippingController.name);
    }
  }
  
  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received event ${topic} from partition ${partition} at offset ${offset}`, ShippingController.name);
    this.logger.debug(`Event data: ${JSON.stringify(data)}`, ShippingController.name);
    try {
      await this.shippingKafkaService.handleOrderCancelled(data);
      await context.getConsumer().commitOffsets([{ topic, partition, offset: (Number(offset) + 1).toString() }]);
    } catch (error) {
      this.logger.error('Failed to handle order.cancelled event', error, ShippingController.name);
    }
  }

  @Get()
  getHello(): string {
    return this.shippingService.getHello();
  }
}
