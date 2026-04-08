import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, index: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  originalPrice?: number;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ index: true })
  subcategory?: string;

  @Prop({ required: true, index: true })
  brand: string;

  @Prop({ required: true, min: 0 })
  stock: number;

  @Prop({ default: 0, min: 0 })
  minStockLevel?: number;

  @Prop([String])
  images: string[];

  @Prop()
  thumbnail?: string;

  @Prop([String])
  tags: string[];

  @Prop({ min: 0, max: 5, default: 0 })
  rating?: number;

  @Prop({ default: 0, min: 0 })
  reviewCount?: number;

  @Prop()
  specifications?: string;

  @Prop()
  dimensions?: string;

  @Prop({ min: 0 })
  weight?: number;

  @Prop()
  seoTitle?: string;

  @Prop()
  seoDescription?: string;

  @Prop([String])
  variants?: string[];

  @Prop({ min: 0, max: 100 })
  discountPercentage?: number;

  @Prop()
  discountExpiresAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ min: 0 })
  shippingCost?: number;

  @Prop()
  estimatedDelivery?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Add text indexes for search
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ createdAt: -1 });
