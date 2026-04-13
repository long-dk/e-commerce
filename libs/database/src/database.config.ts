import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Generic PostgreSQL configuration factory
 * @param databaseName - Name of the database
 */
const getPostgresBaseConfig = (databaseName: string): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'ecommerce_user',
  password: process.env.DATABASE_PASSWORD || 'ecommerce_password',
  database: databaseName,
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: false,
});

/**
 * Generic MongoDB configuration factory
 * @param databaseName - Name of the database
 */
const getMongoBaseConfig = (databaseName: string) => {
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const username = process.env.MONGODB_USER || 'ecommerce_user';
  const password = process.env.MONGODB_PASSWORD || 'ecommerce_password';
  
  return {
    uri: `mongodb://${username}:${password}@${host}:${port}/${databaseName}?authSource=admin`,
  };
};

/**
 * Backward compatible generic configs
 */
export const getPostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(process.env.DATABASE_NAME || 'ecommerce_db');

export const getMongoConfig = () =>
  getMongoBaseConfig(process.env.MONGODB_DATABASE || 'ecommerce_db');

/**
 * Auth Service - PostgreSQL
 * Stores: Users, Refresh Tokens, OAuth Credentials
 */
export const getAuthServicePostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(
    process.env.AUTH_SERVICE_DATABASE_NAME || 'auth_db'
  );

/**
 * Products Service - MongoDB
 * Stores: Products, Categories, Pricing
 */
export const getProductsServiceMongoConfig = () =>
  getMongoBaseConfig(
    process.env.PRODUCTS_SERVICE_DATABASE_NAME || 'products_db'
  );

/**
 * Inventory Service - MongoDB
 * Stores: Stock Levels, Stock Movements, Alerts
 */
export const getInventoryServiceMongoConfig = () =>
  getMongoBaseConfig(
    process.env.INVENTORY_SERVICE_DATABASE_NAME || 'inventory_db'
  );

/**
 * Orders Service - PostgreSQL
 * Stores: Orders, Order Items, Order History
 */
export const getOrdersServicePostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(
    process.env.ORDERS_SERVICE_DATABASE_NAME || 'orders_db'
  );

/**
 * Payments Service - PostgreSQL
 * Stores: Payments, Payment Methods, Transactions
 */
export const getPaymentsServicePostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(
    process.env.PAYMENTS_SERVICE_DATABASE_NAME || 'payments_db'
  );

/**
 * Shipping Service - PostgreSQL
 * Stores: Shipments, Tracking, Delivery History
 */
export const getShippingServicePostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(
    process.env.SHIPPING_SERVICE_DATABASE_NAME || 'shipping_db'
  );

/**
 * Notifications Service - PostgreSQL
 * Stores: Notifications, Email History, Delivery Status
 */
export const getNotificationsServicePostgresConfig = (): TypeOrmModuleOptions =>
  getPostgresBaseConfig(
    process.env.NOTIFICATIONS_SERVICE_DATABASE_NAME || 'notifications_db'
  );
