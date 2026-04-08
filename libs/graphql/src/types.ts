import { ObjectType, Field, ID, InputType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class BaseResponse {
  @Field(() => ID)
  id: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

// Product GraphQL Types
@ObjectType()
export class ProductGQL {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field(() => Float, { nullable: true })
  originalPrice?: number;

  @Field()
  category: string;

  @Field({ nullable: true })
  subcategory?: string;

  @Field()
  brand: string;

  @Field(() => Int)
  stock: number;

  @Field(() => Int, { nullable: true })
  minStockLevel?: number;

  @Field(() => [String])
  images: string[];

  @Field({ nullable: true })
  thumbnail?: string;

  @Field(() => [String])
  tags: string[];

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => Int, { nullable: true })
  reviewCount?: number;

  @Field({ nullable: true })
  specifications?: string;

  @Field({ nullable: true })
  dimensions?: string;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field({ nullable: true })
  seoTitle?: string;

  @Field({ nullable: true })
  seoDescription?: string;

  @Field(() => [String], { nullable: true })
  variants?: string[];

  @Field(() => Float, { nullable: true })
  discountPercentage?: number;

  @Field({ nullable: true })
  discountExpiresAt?: Date;

  @Field()
  isActive: boolean;

  @Field()
  isFeatured: boolean;

  @Field(() => Float, { nullable: true })
  shippingCost?: number;

  @Field({ nullable: true })
  estimatedDelivery?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ProductResponseGQL {
  @Field(() => ProductGQL)
  product: ProductGQL;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class ProductsResponseGQL {
  @Field(() => [ProductGQL])
  products: ProductGQL[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field({ nullable: true })
  message?: string;
}

// Input Types
@InputType()
export class CreateProductInput {
  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field(() => Float, { nullable: true })
  originalPrice?: number;

  @Field()
  category: string;

  @Field({ nullable: true })
  subcategory?: string;

  @Field()
  brand: string;

  @Field(() => Int)
  stock: number;

  @Field(() => Int, { nullable: true })
  minStockLevel?: number;

  @Field(() => [String])
  images: string[];

  @Field({ nullable: true })
  thumbnail?: string;

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  specifications?: string;

  @Field({ nullable: true })
  dimensions?: string;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field({ nullable: true })
  seoTitle?: string;

  @Field({ nullable: true })
  seoDescription?: string;

  @Field(() => [String], { nullable: true })
  variants?: string[];

  @Field(() => Float, { nullable: true })
  discountPercentage?: number;

  @Field({ nullable: true })
  discountExpiresAt?: Date;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isFeatured?: boolean;

  @Field(() => Float, { nullable: true })
  shippingCost?: number;

  @Field({ nullable: true })
  estimatedDelivery?: string;
}

@InputType()
export class UpdateProductInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  originalPrice?: number;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  subcategory?: string;

  @Field({ nullable: true })
  brand?: string;

  @Field(() => Int, { nullable: true })
  stock?: number;

  @Field(() => Int, { nullable: true })
  minStockLevel?: number;

  @Field(() => [String], { nullable: true })
  images?: string[];

  @Field({ nullable: true })
  thumbnail?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  specifications?: string;

  @Field({ nullable: true })
  dimensions?: string;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field({ nullable: true })
  seoTitle?: string;

  @Field({ nullable: true })
  seoDescription?: string;

  @Field(() => [String], { nullable: true })
  variants?: string[];

  @Field(() => Float, { nullable: true })
  discountPercentage?: number;

  @Field({ nullable: true })
  discountExpiresAt?: Date;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isFeatured?: boolean;

  @Field(() => Float, { nullable: true })
  shippingCost?: number;

  @Field({ nullable: true })
  estimatedDelivery?: string;
}

@InputType()
export class SearchProductsInput {
  @Field({ nullable: true })
  query?: string;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  brand?: string;

  @Field(() => Float, { nullable: true })
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  maxPrice?: number;

  @Field(() => Float, { nullable: true })
  minRating?: number;

  @Field({ nullable: true })
  sortBy?: string;

  @Field({ nullable: true })
  sortOrder?: string;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field({ nullable: true })
  inStock?: boolean;

  @Field({ nullable: true })
  isFeatured?: boolean;
}
