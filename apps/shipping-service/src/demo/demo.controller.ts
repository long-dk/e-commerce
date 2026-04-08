import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ShippingService } from '../shipping.service';
import { CreateShipmentInput, UpdateShipmentInput, ShipmentFilters } from '../shipping.types';

@Controller('demo/shipping')
export class DemoController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  async getAllShipments() {
    return this.shippingService.findAll({}, 20, 0);
  }

  @Get(':id')
  async getShipment(@Param('id') id: string) {
    return this.shippingService.findOne(id);
  }

  @Post()
  async createShipment(@Body() input: CreateShipmentInput) {
    return this.shippingService.create(input);
  }

  @Post(':id/update')
  async updateShipment(@Param('id') id: string, @Body() input: UpdateShipmentInput) {
    return this.shippingService.update(id, input);
  }

  @Post(':orderId/ship')
  async shipOrder(@Param('orderId') orderId: string, @Body() body: { carrier: string; trackingNumber: string }) {
    return this.shippingService.markAsShipped(orderId, body.carrier, body.trackingNumber);
  }

  @Post(':orderId/deliver')
  async deliverOrder(@Param('orderId') orderId: string) {
    return this.shippingService.markAsDelivered(orderId);
  }

  @Get('order/:orderId')
  async getShipmentByOrderId(@Param('orderId') orderId: string) {
    return this.shippingService.findByOrderId(orderId);
  }
}