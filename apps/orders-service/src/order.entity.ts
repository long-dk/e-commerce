import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PaymentStatus } from '@app/dto';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

@Entity('orders')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  // User relation is optional and handled separately via userId
  @Column('varchar', { length: 255, nullable: true })
  userEmail?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shippingAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING
  })
  @Index()
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  paymentStatus: PaymentStatus;

  @Column('text', { nullable: true })
  notes: string;

  @Column('jsonb', { nullable: true })
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column('jsonb', { nullable: true })
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column('varchar', { length: 50, nullable: true })
  paymentMethod: string;

  @Column('varchar', { length: 100, nullable: true })
  transactionId: string;

  @Column('timestamp', { nullable: true })
  shippedAt: Date;

  @Column('timestamp', { nullable: true })
  deliveredAt: Date;

  @Column('varchar', { length: 100, nullable: true })
  trackingNumber: string;

  @Column('varchar', { length: 50, nullable: true })
  carrier: string;

  @OneToMany(() => OrderItem, orderItem => orderItem.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getSubtotal(): number {
    return this.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  }

  getTotalItems(): number {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }

  canCancel(): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this.status);
  }

  canShip(): boolean {
    return this.status === OrderStatus.PROCESSING && this.paymentStatus === PaymentStatus.COMPLETED;
  }

  canDeliver(): boolean {
    return this.status === OrderStatus.SHIPPED;
  }
}

@Entity('order_items')
@Index(['orderId', 'productId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  orderId: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  @Index()
  productId: string;

  @Column('varchar', { length: 255 })
  productName: string;

  @Column('varchar', { length: 100, nullable: true })
  productSku: string;

  @Column('text', { nullable: true })
  productDescription: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  discount: number;

  @Column('jsonb', { nullable: true })
  productOptions: Record<string, any>;

  @Column('varchar', { length: 500, nullable: true })
  productImage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getTotal(): number {
    return (this.price * this.quantity) - (this.discount || 0);
  }
}