# Products Service

The Products Service manages the e-commerce product catalog using MongoDB. It provides comprehensive product management with search, filtering, and inventory tracking capabilities.

## Features

- **Product Management**: Full CRUD operations for products
- **Advanced Search**: Text search across product names, descriptions, and tags
- **Filtering**: Filter by category, brand, price range, rating, and stock status
- **Inventory Management**: Stock tracking with low stock alerts
- **SEO Optimization**: Meta titles and descriptions for products
- **Discounts**: Percentage-based discounts with expiration dates
- **Shipping**: Shipping cost calculation and delivery estimates
- **GraphQL API**: Complete GraphQL schema for product operations

## Database Schema

The service uses MongoDB with Mongoose ODM. Key fields include:

- Basic Info: name, description, price, category, brand
- Inventory: stock, minStockLevel
- Media: images, thumbnail
- Search: tags, rating, reviewCount
- E-commerce: variants, discounts, shipping
- SEO: seoTitle, seoDescription

## GraphQL API

### Queries

```graphql
# Get paginated products with search and filtering
products(input: SearchProductsInput): ProductsResponseGQL

# Get single product
product(id: String!): ProductGQL

# Get products by IDs (for cart/order operations)
productsByIds(ids: [String!]!): [ProductGQL]

# Get all categories
categories: [String]

# Get all brands
brands: [String]

# Get featured products
featuredProducts(limit: Int): [ProductGQL]

# Search products with full-text search
searchProducts(query: String!, limit: Int): [ProductGQL]

# Get products by category
productsByCategory(category: String!, limit: Int): [ProductGQL]
```

### Mutations

```graphql
# Create new product
createProduct(input: CreateProductInput!): ProductGQL

# Update existing product
updateProduct(id: String!, input: UpdateProductInput!): ProductGQL

# Update product stock
updateProductStock(id: String!, quantity: Int!): ProductGQL

# Delete product
removeProduct(id: String!): Boolean

# Update product rating (called by Reviews Service)
updateProductRating(id: String!, rating: Float!, reviewCount: Int!): ProductGQL
```

## Search & Filtering

The service supports comprehensive search and filtering:

- **Text Search**: Searches across name, description, and tags using MongoDB text indexes
- **Category/Brand Filtering**: Exact match filtering
- **Price Range**: Min/max price filtering
- **Rating Filter**: Minimum rating threshold
- **Stock Filter**: Show only in-stock products
- **Featured Products**: Filter for featured items
- **Sorting**: Sort by price, rating, date, etc.

## Inventory Management

- Real-time stock tracking
- Stock validation on orders (integrated with Orders Service)
- Low stock alerts via configurable thresholds
- Stock updates via Kafka events

## Kafka Integration

The service publishes and subscribes to Kafka events:

**Publishes:**
- `product.created` - When new products are added
- `product.updated` - When products are modified
- `product.deleted` - When products are removed
- `stock.updated` - When inventory levels change

**Subscribes:**
- `order.created` - Updates stock when orders are placed
- `order.cancelled` - Restores stock when orders are cancelled

## Configuration

Environment variables:

```env
# MongoDB
MONGODB_URI=mongodb://ecommerce_user:ecommerce_password@localhost:27017/ecommerce_db?authSource=admin

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=products-service

# Service
PRODUCTS_SERVICE_PORT=3002
```

## Development

### Running the Service

```bash
# Start MongoDB
docker-compose up mongodb -d

# Start the service
npm run start:dev products-service
```

### Testing

```bash
# Run unit tests
npm test -- --testPathPatterns=product.service.spec.ts

# Run e2e tests
npm run test:e2e apps/products-service
```

### GraphQL Playground

Access the GraphQL playground at: `http://localhost:3002/graphql`

## API Examples

### Create Product

```graphql
mutation {
  createProduct(input: {
    name: "Wireless Headphones"
    description: "High-quality wireless headphones with noise cancellation"
    price: 199.99
    category: "Electronics"
    brand: "AudioTech"
    stock: 50
    images: ["https://example.com/headphones.jpg"]
    tags: ["wireless", "noise-cancelling", "bluetooth"]
  }) {
    id
    name
    price
    stock
  }
}
```

### Search Products

```graphql
query {
  products(input: {
    query: "wireless headphones"
    category: "Electronics"
    minPrice: 100
    maxPrice: 300
    minRating: 4
    limit: 20
    sortBy: "rating"
    sortOrder: "desc"
  }) {
    products {
      id
      name
      price
      rating
      brand
      images
    }
    total
    page
    totalPages
  }
}
```

## Performance Optimizations

- **Text Indexes**: MongoDB text indexes for fast search
- **Compound Indexes**: Optimized indexes for filtering combinations
- **Pagination**: Efficient pagination with skip/limit
- **Projection**: Only fetch required fields when possible
- **Caching**: Redis caching for frequently accessed products (future enhancement)

## Real-time Updates

The service provides real-time WebSocket updates for live synchronization:

### WebSocket Gateway
- **Namespace:** `/products`
- **Port:** 4002
- **CORS:** Configured for frontend applications

### Real-time Events
- `productCreated` - New products added
- `productUpdated` - Product modifications
- `productDeleted` - Product removals
- `stockUpdated` - Inventory changes
- `lowStockAlert` - Stock below minimum threshold

### Subscription Features
- Subscribe to specific products
- Subscribe to product categories
- Room-based message targeting
- Connection management

### Client Integration
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4002/products');

// Subscribe to product updates
socket.emit('subscribeToProduct', { productId: 'product-id' });

// Listen for real-time events
socket.on('productUpdate', (data) => {
  console.log('Real-time update:', data);
});
```

See `REALTIME_UPDATES.md` for comprehensive documentation.