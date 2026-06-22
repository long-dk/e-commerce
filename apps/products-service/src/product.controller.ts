import { Controller, Get } from '@nestjs/common';
import { ProductService } from './product.service';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { LoggerService } from '@app/common';
import { log } from 'console';

@Controller()
export class ProductController {
  constructor(
    private readonly productService: ProductService,
  ) {}
}
