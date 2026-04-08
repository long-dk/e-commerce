import { Controller, Get } from '@nestjs/common';
import { ProductService } from './product.service';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { LoggerService } from '@app/common';
import { log } from 'console';

@Controller()
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly logger: LoggerService
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic: ${topic}, partition: ${partition}, offset: ${offset}`, ProductController.name);
    this.logger.log(`Message data: ${JSON.stringify(data)}`, ProductController.name);
    try {
      await this.productService.handleOrderCreated(data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(),
      }]);
      this.logger.log(`Message processed and offset committed successfully`, ProductController.name);
    } catch (error) {
      this.logger.error(`Error occurred while handling order created event`, error, ProductController.name);
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic: ${topic}, partition: ${partition}, offset: ${offset}`, ProductController.name);
    this.logger.log(`Message data: ${JSON.stringify(data)}`, ProductController.name);
    try {
      await this.productService.handleOrderCancelled(data);
      await context.getConsumer().commitOffsets([{
        topic,
        partition,
        offset: (Number(offset) + 1).toString(),
      }]);
      this.logger.log(`Message processed and offset committed successfully`, ProductController.name);
    } catch (error) {
      this.logger.error(`Error occurred while handling order cancelled event`, error, ProductController.name);
    }
  }

  @Get()
  getHello(): string {
    return this.productService.getHello();
  }
}
