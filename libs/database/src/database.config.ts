import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getPostgresConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'ecommerce_user',
  password: process.env.DATABASE_PASSWORD || 'ecommerce_password',
  database: process.env.DATABASE_NAME || 'ecommerce_db',
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: false,
});

export const getMongoConfig = () => ({
  uri:
    process.env.MONGODB_URI ||
    'mongodb://ecommerce_user:ecommerce_password@localhost:27017/ecommerce_db?authSource=admin',
});
