import { Controller } from "@nestjs/common";
import { InventoryKafkaService } from "./inventory.kafka";
import { LoggerService } from "@app/common";
import { Ctx, EventPattern, KafkaContext, Payload } from "@nestjs/microservices";

@Controller()
export class InventoryController {
  constructor(
    private readonly inventoryKafkaService: InventoryKafkaService,
    private readonly logger: LoggerService,
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic ${topic} partition ${partition} at offset ${offset}`, InventoryController.name);
    this.logger.log(`Received order.created event: ${JSON.stringify(data)}`, InventoryController.name);
    try {
      await this.inventoryKafkaService.handleOrderCreated(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (Number(offset) + 1).toString(),
        },
      ]);
      this.logger.log(`Successfully processed order.created event and committed offset ${offset} for topic ${topic} partition ${partition}`, InventoryController.name); 
    } catch (error) {
      this.logger.error(`Error occurred while processing order.created event`, error, InventoryController.name);
    }
  }
  
  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic ${topic} partition ${partition} at offset ${offset}`, InventoryController.name);
    this.logger.log(`Received order.cancelled event: ${JSON.stringify(data)}`, InventoryController.name);
    try {
      await this.inventoryKafkaService.handleOrderCancelled(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (Number(offset) + 1).toString(),
        },
      ]);
      this.logger.log(`Successfully processed order.cancelled event and committed offset ${offset} for topic ${topic} partition ${partition}`, InventoryController.name);
    } catch (error) {
      this.logger.error(`Error occurred while processing order.cancelled event`, error, InventoryController.name);
    }
  }

  @EventPattern('order.shipped')
  async handleOrderShipped(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic ${topic} partition ${partition} at offset ${offset}`, InventoryController.name);
    this.logger.log(`Received order.shipped event: ${JSON.stringify(data)}`, InventoryController.name);
    try {
      await this.inventoryKafkaService.handleOrderShipped(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (Number(offset) + 1).toString(),
        },
      ]);
      this.logger.log(`Successfully processed order.shipped event and committed offset ${offset} for topic ${topic} partition ${partition}`, InventoryController.name);
    } catch (error) {
      this.logger.error(`Error occurred while processing order.shipped event`, error, InventoryController.name);
    }
  }
  
  @EventPattern('payment.completed')
  async handlePaymentCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic ${topic} partition ${partition} at offset ${offset}`, InventoryController.name);
    this.logger.log(`Received payment.completed event: ${JSON.stringify(data)}`, InventoryController.name);
    try {
      await this.inventoryKafkaService.handlePaymentCompleted(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (Number(offset) + 1).toString(),
        },
      ]);
      this.logger.log(`Successfully processed payment.completed event and committed offset ${offset} for topic ${topic} partition ${partition}`, InventoryController.name);
    } catch (error) {
      this.logger.error(`Error occurred while processing payment.completed event`, error, InventoryController.name);
    }
  }

  @EventPattern('payment.refunded')
  async handlePaymentRefunded(@Payload() data: any, @Ctx() context: KafkaContext) {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    this.logger.log(`Received message from topic ${topic} partition ${partition} at offset ${offset}`, InventoryController.name);
    this.logger.log(`Received payment.refunded event: ${JSON.stringify(data)}`, InventoryController.name);
    try {
      await this.inventoryKafkaService.handlePaymentRefunded(data);
      await context.getConsumer().commitOffsets([
        {
          topic,
          partition,
          offset: (Number(offset) + 1).toString(),
        },
      ]);
      this.logger.log(`Successfully processed payment.refunded event and committed offset ${offset} for topic ${topic} partition ${partition}`, InventoryController.name);
    } catch (error) {
      this.logger.error(`Error occurred while processing payment.refunded event`, error, InventoryController.name);
    }
  }
}