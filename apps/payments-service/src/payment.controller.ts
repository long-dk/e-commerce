import { Controller, Get } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { LoggerService } from '@app/common';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly logger: LoggerService
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic: ${topic}, partition: ${partition}, offset: ${offset}`, PaymentController.name);
    this.logger.log(`Message data: ${JSON.stringify(data)}`, PaymentController.name);
    try {
      await this.paymentService.handleOrderCreated(data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(),
      }]);
      this.logger.log(`Message processed and offset committed successfully`, PaymentController.name);
    } catch (error) {
      this.logger.error('Error occurred while handling order created event', error, PaymentController.name);
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic: ${topic}, partition: ${partition}, offset: ${offset}`, PaymentController.name);
    this.logger.log(`Message data: ${JSON.stringify(data)}`, PaymentController.name);
    try {
      await this.paymentService.handleOrderCancelled(data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(),
      }]);
      this.logger.log(`Message processed and offset committed successfully`, PaymentController.name);
    } catch (error) {
      this.logger.error('Error occurred while handling order cancelled event', error, PaymentController.name);
    }
  }

  @Get()
  getHello(): string {
    return this.paymentService.getHello();
  }
}
