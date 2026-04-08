import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth.module';
import { LoggerService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  const logger = app.get(LoggerService);

  const port = process.env.AUTH_SERVICE_PORT || 4001;

  await app.listen(port);
  logger.log(`Auth Service is running on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Auth Service:', error);
  process.exit(1);
});
