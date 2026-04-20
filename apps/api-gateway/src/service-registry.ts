import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service Registry for all microservices
 * Manages URLs and health checks for service discovery
 */
@Injectable()
export class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeServices();
  }

  private initializeServices(): void {
    const services: Record<string, ServiceConfig> = {
      auth: {
        name: 'auth',
        url: this.configService.get('AUTH_SERVICE_API', 'http://localhost:4001/graphql'),
        restBase: this.configService.get('AUTH_SERVICE_REST', 'http://localhost:4001'),
        timeout: 10000,
        retries: 2,
      },
      products: {
        name: 'products',
        url: this.configService.get('PRODUCTS_SERVICE_API', 'http://localhost:4002/graphql'),
        restBase: this.configService.get('PRODUCTS_SERVICE_REST', 'http://localhost:4002'),
        timeout: 10000,
        retries: 2,
      },
      orders: {
        name: 'orders',
        url: this.configService.get('ORDERS_SERVICE_API', 'http://localhost:4003/graphql'),
        restBase: this.configService.get('ORDERS_SERVICE_REST', 'http://localhost:4003'),
        timeout: 10000,
        retries: 2,
      },
      payments: {
        name: 'payments',
        url: this.configService.get('PAYMENTS_SERVICE_API', 'http://localhost:4004/graphql'),
        restBase: this.configService.get('PAYMENTS_SERVICE_REST', 'http://localhost:4004'),
        timeout: 10000,
        retries: 2,
      },
      // inventory: {
      //   name: 'inventory',
      //   url: this.configService.get('INVENTORY_SERVICE_API', 'http://localhost:4005/graphql'),
      //   restBase: this.configService.get('INVENTORY_SERVICE_REST', 'http://localhost:4005'),
      //   timeout: 10000,
      //   retries: 2,
      // },
      // shipping: {
      //   name: 'shipping',
      //   url: this.configService.get('SHIPPING_SERVICE_API', 'http://localhost:4006/graphql'),
      //   restBase: this.configService.get('SHIPPING_SERVICE_REST', 'http://localhost:4006'),
      //   timeout: 10000,
      //   retries: 2,
      // },
      // notifications: {
      //   name: 'notifications',
      //   url: this.configService.get('NOTIFICATIONS_SERVICE_API', 'http://localhost:4007/graphql'),
      //   restBase: this.configService.get('NOTIFICATIONS_SERVICE_REST', 'http://localhost:4007'),
      //   timeout: 10000,
      //   retries: 2,
      // },
    };

    Object.values(services).forEach((config) => {
      this.services.set(config.name, config);
    });
  }

  /**
   * Get service configuration by name
   */
  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * Get GraphQL subgraph configurations for Apollo Federation
   */
  getSubgraphs(): Array<{ name: string; url: string }> {
    return this.getAllServices().map((service) => ({
      name: service.name,
      url: service.url,
    }));
  }

  /**
   * Update service availability status
   */
  setServiceAvailable(name: string, available: boolean): void {
    const service = this.services.get(name);
    if (service) {
      service.available = available;
    }
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(name: string): boolean {
    const service = this.services.get(name);
    return service ? service.available !== false : false;
  }
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  name: string;
  url: string; // GraphQL endpoint
  restBase: string; // REST API base URL
  timeout: number;
  retries: number;
  available?: boolean;
}
