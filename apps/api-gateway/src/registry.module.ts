import { Global, Module } from "@nestjs/common";
import { ServiceRegistry } from "./service-registry";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [ServiceRegistry, ConfigService],
  exports: [ServiceRegistry, ConfigService],
})
export class RegistryModule {}