import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrometheusMetricsService } from '@app/common';

@Controller('metrics')
export class MetricsController {
  constructor(private prometheusMetrics: PrometheusMetricsService) {}

  /**
   * Prometheus metrics endpoint
   * Exposes all collected metrics in Prometheus text format
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getMetrics(): Promise<string> {
    return await this.prometheusMetrics.getMetrics();
  }
}
