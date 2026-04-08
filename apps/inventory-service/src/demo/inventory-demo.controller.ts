import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface DemoSetupResult {
  productId: string;
  success: boolean;
  inventoryId?: string | null;
  error?: string | null;
}

interface DemoScenarioResult {
  name: string;
  description: string;
  success: boolean;
  result: any;
}

@Controller()
export class InventoryDemoController {
  constructor(private readonly httpService: HttpService) {}

  private readonly inventoryServiceUrl = 'http://localhost:3004/graphql';

  @Get()
  getDemoInfo() {
    return {
      service: 'Inventory Service Demo',
      description: 'Demo application for testing inventory management functionality',
      endpoints: {
        'GET /': 'This information',
        'GET /inventory': 'List all inventory items',
        'GET /inventory/:id': 'Get specific inventory item',
        'POST /inventory': 'Create new inventory item',
        'PUT /inventory/:id': 'Update inventory item',
        'DELETE /inventory/:id': 'Delete inventory item',
        'POST /inventory/:id/adjust': 'Adjust stock quantity',
        'POST /inventory/:id/reserve': 'Reserve stock',
        'POST /inventory/:id/release': 'Release reserved stock',
        'GET /inventory/summary': 'Get inventory summary',
        'GET /stock-movements': 'Get stock movement history',
        'POST /inventory/check-stock': 'Check stock availability',
        'GET /demo/setup': 'Setup demo inventory data',
        'GET /demo/test-scenarios': 'Run test scenarios',
      },
      websocket: {
        url: 'ws://localhost:3004/inventory',
        events: [
          'subscribeToInventory',
          'subscribeToAlerts',
          'inventoryCreated',
          'inventoryUpdated',
          'inventoryDeleted',
          'lowStockAlert',
          'outOfStockAlert',
          'reorderAlert',
        ],
      },
      graphql: {
        url: 'http://localhost:3004/graphql',
        playground: 'http://localhost:3004/graphql',
      },
    };
  }

  @Get('inventory')
  async getInventory() {
    try {
      const query = `
        query {
          inventoryList(limit: 20) {
            inventory {
              _id
              productId
              sku
              productName
              quantity
              availableQuantity
              reservedQuantity
              status
              reorderPoint
              unitCost
              totalValue
              isActive
              needsReorder
              isOverstocked
              isUnderstocked
            }
            totalCount
            hasMore
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, { query })
      );

      return {
        success: true,
        data: response.data.data?.inventoryList || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Get('inventory/:id')
  async getInventoryById(@Param('id') id: string) {
    try {
      const query = `
        query GetInventory($id: ID!) {
          inventory(id: $id) {
            _id
            productId
            sku
            productName
            quantity
            availableQuantity
            reservedQuantity
            status
            reorderPoint
            maxStock
            minStock
            unitCost
            totalValue
            location
            warehouse
            categories
            tags
            isActive
            trackInventory
            needsReorder
            isOverstocked
            isUnderstocked
            createdAt
            updatedAt
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query,
          variables: { id }
        })
      );

      return {
        success: true,
        data: response.data.data?.inventory || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Post('inventory')
  async createInventory(@Body() data: any) {
    try {
      const mutation = `
        mutation CreateInventory($input: CreateInventoryInput!) {
          createInventory(input: $input) {
            _id
            productId
            sku
            productName
            quantity
            availableQuantity
            status
            reorderPoint
            unitCost
            totalValue
            isActive
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { input: data }
        })
      );

      return {
        success: true,
        data: response.data.data?.createInventory || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Put('inventory/:id')
  async updateInventory(@Param('id') id: string, @Body() data: any) {
    try {
      const mutation = `
        mutation UpdateInventory($input: UpdateInventoryInput!) {
          updateInventory(input: $input) {
            _id
            productId
            sku
            productName
            quantity
            availableQuantity
            status
            reorderPoint
            unitCost
            totalValue
            isActive
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { input: { id, ...data } }
        })
      );

      return {
        success: true,
        data: response.data.data?.updateInventory || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Delete('inventory/:id')
  async deleteInventory(@Param('id') id: string) {
    try {
      const mutation = `
        mutation DeleteInventory($id: ID!) {
          deleteInventory(id: $id)
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { id }
        })
      );

      return {
        success: true,
        deleted: response.data.data?.deleteInventory || false,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Post('inventory/:id/adjust')
  async adjustStock(@Param('id') id: string, @Body() data: any) {
    try {
      const mutation = `
        mutation AdjustStock($input: StockAdjustmentInput!) {
          adjustStock(input: $input) {
            _id
            productId
            quantity
            availableQuantity
            status
            lastStockUpdate
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { input: { inventoryId: id, ...data } }
        })
      );

      return {
        success: true,
        data: response.data.data?.adjustStock || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Post('inventory/:id/reserve')
  async reserveStock(@Param('id') id: string, @Body() data: any) {
    try {
      const mutation = `
        mutation ReserveStock($input: ReserveStockInput!) {
          reserveStock(input: $input) {
            _id
            productId
            quantity
            reservedQuantity
            availableQuantity
            status
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { input: { inventoryId: id, ...data } }
        })
      );

      return {
        success: true,
        data: response.data.data?.reserveStock || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Post('inventory/:id/release')
  async releaseStock(@Param('id') id: string, @Body() data: any) {
    try {
      const mutation = `
        mutation ReleaseStock($input: ReleaseStockInput!) {
          releaseStock(input: $input) {
            _id
            productId
            quantity
            reservedQuantity
            availableQuantity
            status
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query: mutation,
          variables: { input: { inventoryId: id, ...data } }
        })
      );

      return {
        success: true,
        data: response.data.data?.releaseStock || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Get('inventory/summary')
  async getInventorySummary() {
    try {
      const query = `
        query {
          inventorySummary {
            totalProducts
            inStock
            lowStock
            outOfStock
            discontinued
            totalValue
            needsReorder
            overstocked
            understocked
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, { query })
      );

      return {
        success: true,
        data: response.data.data?.inventorySummary || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Get('stock-movements')
  async getStockMovements() {
    try {
      const query = `
        query {
          stockMovements(limit: 20) {
            movements {
              _id
              productId
              movementType
              quantity
              previousQuantity
              newQuantity
              quantityChange
              isInbound
              isOutbound
              movementDescription
              reason
              performedBy
              createdAt
            }
            totalCount
            hasMore
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, { query })
      );

      return {
        success: true,
        data: response.data.data?.stockMovements || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Post('inventory/check-stock')
  async checkStock(@Body() data: { productId: string; quantity: number }) {
    try {
      const query = `
        query CheckStock($productId: String!, $quantity: Float!) {
          checkStock(productId: $productId, quantity: $quantity) {
            productId
            inventoryId
            requestedQuantity
            availableQuantity
            canFulfill
            status
            message
          }
        }
      `;

      const response = await firstValueFrom(
        this.httpService.post<any>(this.inventoryServiceUrl, {
          query,
          variables: data
        })
      );

      return {
        success: true,
        data: response.data.data?.checkStock || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  @Get('demo/setup')
  async setupDemoData() {
    const demoProducts = [
      {
        productId: 'demo-laptop-001',
        sku: 'LT-001',
        productName: 'Gaming Laptop Pro',
        quantity: 50,
        reorderPoint: 10,
        maxStock: 100,
        minStock: 5,
        unitCost: 1200.00,
        location: 'Warehouse A',
        warehouse: 'Main Warehouse',
        categories: ['Electronics', 'Computers'],
        tags: ['gaming', 'laptop', 'high-end'],
        supplierInfo: 'TechCorp Inc.',
      },
      {
        productId: 'demo-phone-001',
        sku: 'PH-001',
        productName: 'Smartphone Ultra',
        quantity: 8,
        reorderPoint: 15,
        maxStock: 200,
        minStock: 10,
        unitCost: 800.00,
        location: 'Warehouse A',
        warehouse: 'Main Warehouse',
        categories: ['Electronics', 'Mobile'],
        tags: ['smartphone', 'android', '5g'],
        supplierInfo: 'MobileTech Ltd.',
      },
      {
        productId: 'demo-headphones-001',
        sku: 'HP-001',
        productName: 'Wireless Headphones',
        quantity: 25,
        reorderPoint: 20,
        maxStock: 150,
        minStock: 15,
        unitCost: 150.00,
        location: 'Warehouse B',
        warehouse: 'Secondary Warehouse',
        categories: ['Electronics', 'Audio'],
        tags: ['wireless', 'bluetooth', 'noise-cancelling'],
        supplierInfo: 'AudioWorld Corp.',
      },
      {
        productId: 'demo-mouse-001',
        sku: 'MS-001',
        productName: 'Gaming Mouse RGB',
        quantity: 3,
        reorderPoint: 12,
        maxStock: 80,
        minStock: 8,
        unitCost: 80.00,
        location: 'Warehouse B',
        warehouse: 'Secondary Warehouse',
        categories: ['Electronics', 'Accessories'],
        tags: ['gaming', 'rgb', 'wireless'],
        supplierInfo: 'PeripheralPro Inc.',
      },
    ];

    const results: DemoSetupResult[] = [];

    for (const product of demoProducts) {
      try {
        const result = await this.createInventory(product);
        results.push({
          productId: product.productId,
          success: result.success,
          inventoryId: result.success ? result.data?._id : null,
          error: result.success ? null : result.error,
        });
      } catch (error) {
        results.push({
          productId: product.productId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      message: 'Demo inventory setup completed',
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    };
  }

  @Get('demo/test-scenarios')
  async runTestScenarios() {
    const scenarios = [
      {
        name: 'Stock Adjustment Test',
        description: 'Test stock increase and decrease operations',
        action: async () => {
          // First get an inventory item
          const inventory = await this.getInventory();
          if (!inventory.success || !inventory.data.inventory.length) {
            return { success: false, error: 'No inventory items found' };
          }

          const item = inventory.data.inventory[0];
          const originalQuantity = item.quantity;

          // Increase stock
          const increaseResult = await this.adjustStock(item._id, {
            quantity: 10,
            movementType: 'STOCK_IN',
            reason: 'Demo stock increase',
            performedBy: 'demo-system',
          });

          if (!increaseResult.success) {
            return { success: false, error: 'Failed to increase stock' };
          }

          // Decrease stock
          const decreaseResult = await this.adjustStock(item._id, {
            quantity: -5,
            movementType: 'STOCK_OUT',
            reason: 'Demo stock decrease',
            performedBy: 'demo-system',
          });

          return {
            success: true,
            originalQuantity,
            afterIncrease: increaseResult.data.quantity,
            afterDecrease: decreaseResult.data.quantity,
          };
        },
      },
      {
        name: 'Stock Reservation Test',
        description: 'Test stock reservation and release operations',
        action: async () => {
          const inventory = await this.getInventory();
          if (!inventory.success || !inventory.data.inventory.length) {
            return { success: false, error: 'No inventory items found' };
          }

          const item = inventory.data.inventory[0];

          // Reserve stock
          const reserveResult = await this.reserveStock(item._id, {
            quantity: 2,
            reference: 'demo-order-001',
            referenceType: 'order',
          });

          if (!reserveResult.success) {
            return { success: false, error: 'Failed to reserve stock' };
          }

          // Release stock
          const releaseResult = await this.releaseStock(item._id, {
            quantity: 2,
            reference: 'demo-order-001',
          });

          return {
            success: true,
            originalReserved: item.reservedQuantity,
            afterReserve: reserveResult.data.reservedQuantity,
            afterRelease: releaseResult.data.reservedQuantity,
          };
        },
      },
      {
        name: 'Stock Check Test',
        description: 'Test stock availability checking',
        action: async () => {
          const inventory = await this.getInventory();
          if (!inventory.success || !inventory.data.inventory.length) {
            return { success: false, error: 'No inventory items found' };
          }

          const item = inventory.data.inventory[0];

          // Check stock for different quantities
          const check1 = await this.checkStock({
            productId: item.productId,
            quantity: 1,
          });

          const check2 = await this.checkStock({
            productId: item.productId,
            quantity: item.availableQuantity + 10, // More than available
          });

          return {
            success: true,
            productId: item.productId,
            availableQuantity: item.availableQuantity,
            checkSmallQuantity: check1.success ? check1.data : null,
            checkLargeQuantity: check2.success ? check2.data : null,
          };
        },
      },
    ];

    const results: DemoScenarioResult[] = [];

    for (const scenario of scenarios) {
      try {
        console.log(`Running scenario: ${scenario.name}`);
        const result = await scenario.action();
        results.push({
          name: scenario.name,
          description: scenario.description,
          success: result.success,
          result: result.success ? result : { error: result.error },
        });
      } catch (error) {
        results.push({
          name: scenario.name,
          description: scenario.description,
          success: false,
          result: { error: error.message },
        });
      }
    }

    return {
      message: 'Test scenarios completed',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    };
  }
}