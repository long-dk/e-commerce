import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InventoryDemoController } from './inventory-demo.controller';

@Module({
  imports: [HttpModule],
  controllers: [InventoryDemoController],
  providers: [],
})
export class AppModule {}