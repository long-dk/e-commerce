import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProxyService } from './proxy.service';
import { ServiceRegistry } from './service-registry';
import { Request } from 'express';

@Controller('api/v1')
@UseGuards(ThrottlerGuard)
export class GatewayController {
  constructor(
    private proxyService: ProxyService,
    private serviceRegistry: ServiceRegistry,
  ) {}

  /**
   * Generic proxy endpoint: /api/v1/:service/:path
   * Routes: GET, POST, PUT, DELETE
   */
  @Get(':service/*')
  async getProxy(
    @Param('service') service: string,
    @Req() req: Request,
    @Headers() headers: Record<string, any>,
  ): Promise<any> {
    const path = `/${req.params[0]}`;
    return this.proxyService.forward(service, path, 'GET', undefined, headers);
  }

  @Post(':service/*')
  @HttpCode(HttpStatus.CREATED)
  async postProxy(
    @Param('service') service: string,
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, any>,
  ): Promise<any> {
    const path = `/${req.params[0]}`;
    return this.proxyService.forward(service, path, 'POST', body, headers);
  }

  @Put(':service/*')
  async putProxy(
    @Param('service') service: string,
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, any>,
  ): Promise<any> {
    const path = `/${req.params[0]}`;
    return this.proxyService.forward(service, path, 'PUT', body, headers);
  }

  @Delete(':service/*')
  async deleteProxy(
    @Param('service') service: string,
    @Req() req: Request,
    @Headers() headers: Record<string, any>,
  ): Promise<any> {
    const path = `/${req.params[0]}`;
    return this.proxyService.forward(service, path, 'DELETE', undefined, headers);
  }

  /**
   * List all registered services
   */
  @Get('services', { path: 'services' })
  getServices(): any[] {
    return this.serviceRegistry.getAllServices().map((service) => ({
      name: service.name,
      graphql: service.url,
      rest: service.restBase,
      available: this.serviceRegistry.isServiceAvailable(service.name),
    }));
  }
}
