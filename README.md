# E-Commerce Microservices Platform

A production-ready, scalable e-commerce microservices platform built with **NestJS**, **GraphQL**, **Kafka**, and the **ELK Stack** for centralized logging.

## 🎯 Project Overview

This platform provides a complete e-commerce solution with:
- **7 Independent Microservices** with individual GraphQL APIs
- **Async Event-Driven Architecture** using Kafka
- **Centralized Logging** with Elasticsearch, Logstash, and Kibana
- **PostgreSQL + MongoDB** for flexible data storage
- **JWT + OAuth2** authentication
- **Containerized Deployment** with Docker Compose and Kubernetes-ready

## 🏗️ Architecture

### Microservices

| Service | Database | Purpose | Status |
|---------|----------|---------|--------|
| **Auth** | PostgreSQL | User authentication, JWT tokens | ✅ Complete |
| **Products** | MongoDB | Product catalog, search, filtering | ✅ Complete |
| **Orders** | PostgreSQL | Order management, processing | ✅ Complete |
| **Payments** | PostgreSQL | Payment processing, transactions | ✅ Complete |
| **Inventory** | PostgreSQL | Stock management, reservations | ✅ Complete |
| **Shipping** | PostgreSQL | Shipment tracking, logistics | ✅ Complete |
| **Notifications** | PostgreSQL | Email, SMS, push notifications | ✅ Complete |

### Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│               E-Commerce Microservices                       │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │Kafka    │   │PostgreSQL│   │ MongoDB  │
    │(Events) │   │(Txns+Logs)   │(Catalog) │
    └─────────┘   └──────────┘   └──────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │     ELK Stack (Centralized Logs)    │
    │  ┌──────────┬──────────────────────┐
    │  │Logstash  │ Elasticsearch │Kibana│
    │  └──────────┴──────────────────────┘
    └─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- npm 9+

### Start All Services

```bash
# Clone and install
git clone <repo>
cd e-commerce
npm install --legacy-peer-deps

# Build
npm run build

# Start all services (Docker Compose)
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| Auth Service | http://localhost:4001/graphql | GraphQL API |
| Products Service | http://localhost:4002/graphql | GraphQL API |
| Orders Service | http://localhost:4003/graphql | GraphQL API |
| Payments Service | http://localhost:4004/graphql | GraphQL API |
| Inventory Service | http://localhost:4005/graphql | GraphQL API |
| Shipping Service | http://localhost:4006/graphql | GraphQL API |
| Notifications Service | http://localhost:4007/graphql | GraphQL API |
| Kibana | http://localhost:5601 | Log Visualization |
| PostgreSQL | localhost:5432 | Relational Database |
| MongoDB | localhost:27017 | Document Database |
| Kafka | localhost:9092 | Message Broker |

## 📚 Services Documentation

### Auth Service ✅ [Complete]

**File:** [AUTH_SERVICE.md](AUTH_SERVICE.md)

**Features:**
- User registration with email/password
- JWT token generation with refresh token rotation
- Password hashing with bcrypt
- GraphQL mutations: `register`, `login`, `refreshToken`, `logout`
- GraphQL queries: `me`, `validateToken`
- Kafka event publishing on user registration
- Role-based access control (user, admin, seller)
- OAuth2 ready (Google, GitHub fields prepared)

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Passport.js with JWT strategy
- Kafka event publishing

### Products Service ✅ [Complete]

**File:** [PRODUCTS_SERVICE.md](apps/products-service/PRODUCTS_SERVICE.md)

**Features:**
- Product CRUD operations (create, read, update, delete)
- Full-text search with MongoDB text indexes
- Product filtering (category, price range, ratings, availability)
- Pagination and sorting
- Inventory tracking integration via Kafka events
- Real-time updates via WebSocket for stock changes
- Product schema with categories, tags, and supplier info
- Kafka subscriber for order events (stock adjustments)
- Demo endpoints for testing real-time features

**Tech Stack:**
- NestJS + Mongoose
- MongoDB
- GraphQL + Apollo Server
- Kafka event consumption
- WebSocket Gateway for real-time updates

### Orders Service ✅ [Complete]

**File:** [ORDERS_SERVICE_DEMO.md](apps/orders-service/ORDERS_SERVICE_DEMO.md)

**Features:**
- Order creation and management
- Order status tracking (pending, confirmed, shipped, delivered, cancelled)
- Order history retrieval with pagination
- Cancel order functionality with stock release
- Order confirmation with payment integration
- Kafka event publishing for order lifecycle
- User order history and current orders
- Order entity with items, totals, and discount handling
- GraphQL mutations: `createOrder`, `confirmOrder`, `cancelOrder`
- GraphQL queries: `orders`, `order`, `userOrders`

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Kafka event publishing
- Current user guard for authentication

### Payments Service ✅ [Complete]

**File:** [PAYMENTS_SERVICE_DEMO.md](apps/payments-service/PAYMENTS_SERVICE_DEMO.md)

**Features:**
- Payment processing with transaction tracking
- Payment status management (pending, completed, failed, refunded)
- Refund processing with Kafka events
- Order payment integration
- Payment history and retrieval
- Kafka event publishing for payment lifecycle
- WebSocket notifications for payment updates
- Payment entity with amount, method, and reference
- GraphQL mutations: `processPayment`, `refundPayment`
- GraphQL queries: `payments`, `payment`, `orderPayments`

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Kafka event publishing
- Current user guard for authentication

### Inventory Service ✅ [Complete]

**Features:**
- Stock management with reservations and releases
- Inventory CRUD operations
- Stock adjustments (in/out movements)
- Bulk stock checking for orders
- Low stock alerts and reorder notifications
- Inventory history and movement tracking
- Kafka event handling for order lifecycle
- WebSocket real-time alerts for stock changes
- Demo endpoints for testing inventory scenarios
- Inventory entity with product ID, quantity, and location

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Kafka event consumption and publishing
- WebSocket Gateway for alerts
- HttpModule for external API calls

### Shipping Service ✅ [Complete]

**Features:**
- Shipment creation and tracking
- Shipment status updates (pending, shipped, delivered)
- Shipment history and retrieval
- Integration with inventory for stock reduction
- Kafka event publishing for shipment updates
- Shipment entity with tracking numbers and carrier info

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Kafka event publishing

### Notifications Service ✅ [Complete]

**Features:**
- Multi-channel notifications (email, SMS, push, in-app)
- Notification creation and management
- Notification history and status tracking
- Kafka event subscribers for various events (user registration, orders, payments)
- Email service integration with templates
- WebSocket real-time notification delivery
- Notification entity with user ID, channel, and payload
- GraphQL mutations: `sendNotification`, `markAsRead`
- GraphQL queries: `notifications`, `notification`, `notificationSummary`

**Tech Stack:**
- NestJS + TypeORM
- PostgreSQL
- GraphQL + Apollo Server
- Kafka event consumption
- WebSocket Gateway for real-time delivery
- Nodemailer for email sending

### Phase 9: Analytics + Observability (Roadmap)

**Goal:** Build advanced operations dashboards, analytics, and monitoring across the platform.

**Features:**
- KPI reporting (revenue, AOV, conversion, churn)
- Real-time and historical dashboards (orders, payments, inventory)
- Anomaly alerts (order spikes, payment failures, stockouts)
- ETL ingestion to analytics store (ClickHouse/TimescaleDB/Elasticsearch)
- Export charts and CSV/JSON reports for management
- Data science hooks (recommendation, forecasting, CLV signals)
- Complete audit logs for compliance and security
- Prometheus/Grafana (metrics), Jaeger/OTEL (traces)
- Phase 10: Execution sprint for transforming analytics into productized features (recommendation engine, dynamic promotions, predictive replenishment)

**Tech Stack:**
- Kafka streams for analytics events
- Reinforced data store for time-series metrics
- Prometheus + Grafana monitoring and alerting
- Elasticsearch analytics + Kibana dashboards
- Redis caching for hot metrics

### PostgreSQL
- **users** - User accounts with OAuth support
- **refresh_tokens** - Token revocation tracking
- **orders** - Order records
- **payments** - Transaction history
- **inventory** - Stock levels
- **shipments** - Shipping records

### MongoDB
- **products** - Product catalog
- **categories** - Product categories
- **reviews** - Product reviews

## 🔐 Authentication

### JWT Flow

```
1. User registers/logs in
   ↓
2. Auth Service returns access + refresh tokens
   ↓
3. Client sends requests with Bearer token
   ↓
4. Service validates with JWT strategy
```

### Protected Endpoints

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

## 📡 Kafka Event Architecture

### Event Flow

```
User Registration
    ↓
Auth Service publishes "user-registered"
    ↓
Subscribers:
- Notifications Service (welcome email)
- Products Service (user preferences)
- Inventory Service (cart initialization)
```

## 🪵 Centralized Logging (ELK Stack)

- **Winston Logger** - Application logs
- **Logstash** - Log aggregation
- **Elasticsearch** - Log storage
- **Kibana** - Log visualization (http://localhost:5601)

## 🛠️ Project Structure

```
.
├── apps/
│   ├── auth-service/              ✅ Complete
│   ├── products-service/          🔄 Phase 4
│   ├── orders-service/            📅 Phase 5
│   ├── payments-service/          📅 Phase 6
│   ├── inventory-service/         📅 Phase 7
│   ├── shipping-service/          📅 Phase 7
│   └── notifications-service/     📅 Phase 8
├── libs/
│   ├── common/                    ✅ Complete
│   ├── dto/                       ✅ Complete
│   ├── database/                  ✅ Complete
│   ├── kafka/                     ✅ Complete
│   └── graphql/                   ✅ Complete
├── docker-compose.yml             ✅ Complete
├── Dockerfile                     ✅ Complete
└── logstash.conf                  ✅ Complete
```

## 🚧 Development

### Run Local Services

```bash
# Start database/kafka
docker-compose up postgres mongodb kafka zookeeper elasticsearch logstash kibana

# Install and build
npm install --legacy-peer-deps
npm run build

# Run specific service in watch mode
npm run start:auth
```

### Build

```bash
# Build all services
npm run build

# Build specific service
npm run build auth-service
```

## ✅ Completed Phases

- **Phase 1**: NestJS monorepo scaffolding
- **Phase 2**: Shared libraries implementation
- **Phase 3**: Auth Service complete

## 📅 Upcoming Phases

- **Phase 4**: Products Service
- **Phase 5**: Orders Service
- **Phase 6**: Payments Service
- **Phase 7**: Inventory & Shipping Services
- **Phase 8**: Kibana dashboards
- **Phase 9**: Kubernetes manifests
- **Phase 10**: Tests & documentation

## 🐳 Docker Compose Services

```
Microservices (7):
- auth-service (4001)
- products-service (4002)
- orders-service (4003)
- payments-service (4004)
- inventory-service (4005)
- shipping-service (4006)
- notifications-service (4007)

Infrastructure (7):
- postgres (5432)
- mongodb (27017)
- kafka (9092)
- zookeeper (2181)
- elasticsearch (9200)
- logstash (5000)
- kibana (5601)
```

## 📖 Documentation

- [Auth Service Documentation](AUTH_SERVICE.md) - Authentication & JWT
- [API Documentation](docs/API.md) - (coming soon)
- [Deployment Guide](docs/DEPLOYMENT.md) - (coming soon)

## 🐛 Troubleshooting

### Services won't connect to Kafka
```bash
docker-compose logs kafka
# Verify: KAFKA_BROKERS=kafka:29092
```

### PostgreSQL connection fails
```bash
# Verify: DATABASE_HOST=postgres (not localhost)
docker-compose exec postgres psql -U ecommerce_user -d ecommerce_db
```

### Logs not in Kibana
```bash
docker-compose logs logstash
curl http://localhost:9200/_cat/indices
```

## 📝 Environment Variables

See [.env.example](.env.example):

```env
NODE_ENV=development
PORT=4001
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=ecommerce_user
DATABASE_PASSWORD=ecommerce_password
DATABASE_NAME=ecommerce_db
KAFKA_BROKERS=kafka:29092
JWT_SECRET=your-secret-key
LOG_LEVEL=debug
```

## 📄 License

MIT

---

**Last Updated:** April 2, 2026 - Phase 3 Complete (Auth Service)

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
