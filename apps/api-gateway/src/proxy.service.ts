import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ServiceRegistry } from './service-registry';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { LoggerService } from '@app/common';

@Injectable()
export class ProxyService {
  constructor(
    private httpService: HttpService,
    private serviceRegistry: ServiceRegistry,
    private readonly logger: LoggerService
  ) {}

  /**
   * Forward request to backend service
   */
  async forward(
    service: string,
    path: string,
    method: string,
    data?: any,
    headers?: Record<string, any>,
  ): Promise<any> {
    const serviceConfig = this.serviceRegistry.getService(service);

    if (!serviceConfig) {
      throw new HttpException(
        `Service "${service}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const url = `${serviceConfig.restBase}${path}`;
    const forwardHeaders = {
      ...headers,
      'X-Forwarded-By': 'api-gateway',
      'X-Forwarded-For': headers?.['x-forwarded-for'] || headers?.['x-real-ip'] || 'unknown',
    };

    try {
      this.logger.log(`Forwarding ${method} ${url}`);

      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method: method.toLowerCase() as any,
          data,
          headers: forwardHeaders,
          timeout: serviceConfig.timeout,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Proxy error for ${service}:${path}`, error);

      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.BAD_GATEWAY;
        const message = error.response?.data?.message || error.message;
        throw new HttpException(message, status);
      }

      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Check service health
   */
  async checkHealth(service: string): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const serviceConfig = this.serviceRegistry.getService(service);

    if (!serviceConfig) {
      return { status: 'unhealthy', latency: 0 };
    }

    const startTime = Date.now();
    try {
      await firstValueFrom(
        this.httpService.get(`${serviceConfig.restBase}/health`, {
          timeout: 5000,
        }),
      );

      const latency = Date.now() - startTime;
      this.serviceRegistry.setServiceAvailable(service, true);
      return { status: 'healthy', latency };
    } catch (error) {
      this.serviceRegistry.setServiceAvailable(service, false);
      return { status: 'unhealthy', latency: Date.now() - startTime };
    }
  }
}
