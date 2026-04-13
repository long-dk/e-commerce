import { Controller, Get, Param } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ServiceRegistry } from './service-registry';

@Controller('health')
export class HealthController {
  constructor(
    private proxyService: ProxyService,
    private serviceRegistry: ServiceRegistry,
  ) {}

  /**
   * Check gateway health
   */
  @Get()
  async getGatewayHealth(): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    };
  }

  /**
   * Check all services health
   */
  @Get('services')
  async getServicesHealth(): Promise<any> {
    const services = this.serviceRegistry.getAllServices();
    const healthChecks = await Promise.allSettled(
      services.map((service) => this.proxyService.checkHealth(service.name)),
    );

    const results = services.reduce(
      (acc, service, index) => {
        const result = healthChecks[index];
        acc[service.name] = {
          available: this.serviceRegistry.isServiceAvailable(service.name),
          status:
            result.status === 'fulfilled'
              ? result.value.status
              : 'unreachable',
          latency:
            result.status === 'fulfilled' ? result.value.latency : null,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      status: 'healthy',
      timestamp: new Date(),
      services: results,
    };
  }

  /**
   * Check specific service health
   */
  @Get('services/:service')
  async getServiceHealth(@Param('service') service: string): Promise<any> {
    const health = await this.proxyService.checkHealth(service);
    return {
      service,
      ...health,
      timestamp: new Date(),
    };
  }
}
