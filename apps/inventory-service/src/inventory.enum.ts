import { registerEnumType } from '@nestjs/graphql';

export enum InventoryStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED',
  BACKORDERED = 'BACKORDERED'
}

export enum StockMovementType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  RESERVATION = 'RESERVATION',
  RESERVATION_RELEASE = 'RESERVATION_RELEASE',
  INITIAL_STOCK = 'INITIAL_STOCK',
  TRANSFER = 'TRANSFER',
}

registerEnumType(InventoryStatus, {
  name: 'InventoryStatus',
  description: 'Inventory status enumeration',
});

registerEnumType(StockMovementType, {
  name: 'StockMovementType',
  description: 'Stock movement type enumeration',
});