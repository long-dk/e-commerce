import { Global, Module } from "@nestjs/common";
import { CacheModule as CacheMo } from '@nestjs/cache-manager';
import { getRedisCacheConfig } from './cache.config';
import { CacheService } from "./cache.service";
import { LoggerService } from "@app/common";

@Global()
@Module({
  imports: [
    CacheMo.register(getRedisCacheConfig()),
  ],
  providers: [CacheService, LoggerService],
  exports: [CacheService],
})
export class CacheModule {}