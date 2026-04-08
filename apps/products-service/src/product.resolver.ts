import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ProductService } from './product.service';
import {
  ProductGQL,
  ProductResponseGQL,
  ProductsResponseGQL,
  CreateProductInput,
  UpdateProductInput,
  SearchProductsInput,
} from '@app/graphql';

@Resolver(() => ProductGQL)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Mutation(() => ProductGQL)
  async createProduct(@Args('input') createProductInput: CreateProductInput) {
    return this.productService.create(createProductInput);
  }

  @Query(() => ProductsResponseGQL)
  async products(@Args('input') searchInput: SearchProductsInput) {
    return this.productService.findAll(searchInput);
  }

  @Query(() => ProductGQL, { nullable: true })
  async product(@Args('id') id: string) {
    return this.productService.findOne(id);
  }

  @Query(() => [ProductGQL])
  async productsByIds(@Args('ids', { type: () => [String] }) ids: string[]) {
    return this.productService.findByIds(ids);
  }

  @Mutation(() => ProductGQL)
  async updateProduct(
    @Args('id') id: string,
    @Args('input') updateProductInput: UpdateProductInput,
  ) {
    return this.productService.update(id, updateProductInput);
  }

  @Mutation(() => ProductGQL)
  async updateProductStock(
    @Args('id') id: string,
    @Args('quantity') quantity: number,
  ) {
    return this.productService.updateStock(id, quantity);
  }

  @Mutation(() => Boolean)
  async removeProduct(@Args('id') id: string) {
    await this.productService.remove(id);
    return true;
  }

  @Query(() => [String])
  async categories() {
    return this.productService.getCategories();
  }

  @Query(() => [String])
  async brands() {
    return this.productService.getBrands();
  }

  @Query(() => [ProductGQL])
  async featuredProducts(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.productService.getFeaturedProducts(limit);
  }

  @Query(() => [ProductGQL])
  async searchProducts(
    @Args('query') query: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.productService.searchProducts(query, limit);
  }

  @Query(() => [ProductGQL])
  async productsByCategory(
    @Args('category') category: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.productService.getProductsByCategory(category, limit);
  }

  @Mutation(() => ProductGQL)
  async updateProductRating(
    @Args('id') id: string,
    @Args('rating') rating: number,
    @Args('reviewCount') reviewCount: number,
  ) {
    return this.productService.updateRating(id, rating, reviewCount);
  }
}
