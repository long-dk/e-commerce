# Auth Service Documentation

## Overview

The Auth Service handles user authentication, JWT token management, and user profile management for the e-commerce platform. It uses PostgreSQL for data storage, GraphQL for API queries/mutations, and Kafka for event publishing.

**Features:**
- Email/password authentication with bcrypt
- **Email verification** for account activation
- JWT token generation with refresh token rotation
- **OAuth2 support** (Google & GitHub)
- Role-based access control
- Kafka event publishing
- Centralized logging

## Architecture

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │ GraphQL
       ▼
┌─────────────────────────────────────────┐
│      Auth Service (NestJS)              │
│  ┌─────────────────────────────────────┐│
│  │  GraphQL Resolver                   ││
│  │  - register, login, refreshToken    ││
│  │  - logout, me, validateToken        ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │  AuthService                        ││
│  │  - Token generation & validation    ││
│  │  - Password hashing                 ││
│  │  - Refresh token management         ││
│  │  - Kafka event publishing           ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │  UserService                        ││
│  │  - User CRUD operations             ││
│  │  - Password validation              ││
│  │  - OAuth user creation              ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
       │          │              │
       ▼          ▼              ▼
    ┌────┐   ┌────────┐    ┌──────────┐
    │ JWT│   │Passport│    │PostgreSQL│
    └────┘   └────────┘    └──────────┘
                │
                ▼
            ┌──────────┐
            │ Kafka    │
            │ Events   │
            └──────────┘
```

## Data Models

### User Entity

```typescript
{
  id: UUID,
  email: string (unique, indexed),
  password: string (hashed),
  firstName: string,
  lastName: string,
  role: 'user' | 'admin' | 'seller',
  phone?: string,
  address?: string,
  isEmailVerified: boolean,
  googleId?: string,
  githubId?: string,
  lastLogin?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### RefreshToken Entity

```typescript
{
  id: UUID,
  userId: UUID,
  token: string (JWT),
  expiresAt: Date,
  isRevoked: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## GraphQL API

### Mutations

#### Register
```graphql
mutation Register($email: String!, $password: String!, $firstName: String!, $lastName: String!) {
  register(email: $email, password: $password, firstName: $firstName, lastName: $lastName) {
    user {
      id
      email
      firstName
      lastName
      role
      createdAt
    }
    tokens {
      accessToken
      refreshToken
      expiresIn
    }
  }
}
```

**Response Example:**
```json
{
  "data": {
    "register": {
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "user",
        "createdAt": "2026-04-02T13:00:00Z"
      },
      "tokens": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "expiresIn": 3600
      }
    }
  }
}
```

#### Login
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    user {
      id
      email
      firstName
      lastName
      role
    }
    tokens {
      accessToken
      refreshToken
      expiresIn
    }
  }
}
```

#### RefreshToken
```graphql
mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    expiresIn
  }
}
```

#### Logout
```graphql
mutation Logout($refreshToken: String!) {
  logout(refreshToken: $refreshToken)
}
```

**Note:** Requires authentication (Bearer token in Authorization header)

#### SendVerificationEmail
```graphql
mutation SendVerificationEmail($email: String!) {
  sendVerificationEmail(email: $email)
}
```

**Response Example:**
```json
{
  "data": {
    "sendVerificationEmail": "Verification email sent successfully"
  }
}
```

**Note:** Sends a new verification email to the specified email address. Can be used to resend verification emails.

#### VerifyEmail
```graphql
mutation VerifyEmail($token: String!) {
  verifyEmail(token: $token) {
    id
    email
    firstName
    lastName
    role
    createdAt
    updatedAt
  }
}
```

**Response Example:**
```json
{
  "data": {
    "verifyEmail": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "createdAt": "2026-04-02T13:00:00Z",
      "updatedAt": "2026-04-02T13:00:00Z"
    }
  }
}
```

**Note:** Verifies the user's email address using the token from the verification email.

### Queries

#### Me (Current User)
```graphql
query Me {
  me {
    id
    email
    firstName
    lastName
    role
    createdAt
    updatedAt
  }
}
```

**Note:** Requires authentication

#### ValidateToken
```graphql
query ValidateToken($token: String!) {
  validateToken(token: $token)
}
```

#### GetGoogleLoginUrl
```graphql
query {
  getGoogleLoginUrl
}
```

Returns the Google OAuth2 consent URL to redirect users to for login.

#### GetGithubLoginUrl
```graphql
query {
  getGithubLoginUrl
}
```

Returns the GitHub OAuth2 authorization URL to redirect users to for login.

## Email Verification

The Auth Service requires email verification for account activation. Users must verify their email address before they can log in with email/password authentication.

### Email Verification Flow

```
1. User registers with email/password
   ↓
2. Auth Service creates user account (isEmailVerified: false)
   ↓
3. Verification email sent automatically
   ↓
4. User clicks verification link in email
   ↓
5. Auth Service verifies token and marks email as verified
   ↓
6. User can now log in with email/password
```

### Email Templates

**Verification Email:**
- Subject: "Verify Your Email Address"
- Contains clickable verification link
- Link expires in 24 hours
- Includes both HTML and plain text versions

**Example Link:**
```
http://localhost:3000/verify-email?token=abc123...
```

### Security Features

- **Token Expiration:** Verification tokens expire in 24 hours
- **One-Time Use:** Tokens are cleared after successful verification
- **Secure Tokens:** 64-character random hex tokens
- **Rate Limiting:** Consider implementing rate limiting for resend requests

### Error Handling

**Common Errors:**
- `Invalid verification token` - Token doesn't exist or is malformed
- `Verification token has expired` - Token is older than 24 hours
- `Email is already verified` - User has already verified their email

## OAuth2 Authentication

The Auth Service supports OAuth2 login with Google and GitHub, allowing users to sign up and log in using their existing accounts.

### Google OAuth2 Login

**Flow:**
1. Client queries `getGoogleLoginUrl`
2. Redirect user to the returned Google consent URL
3. User authenticates with Google
4. Google redirects to `/auth/google/callback`
5. Auth Service creates/updates user
6. Front-end receives JWT tokens in redirect

**REST Endpoint:**
```
GET http://localhost:4001/auth/google
```

### GitHub OAuth2 Login

**Flow:**
1. Client queries `getGithubLoginUrl`
2. Redirect user to the returned GitHub authorization URL
3. User authenticates with GitHub
4. GitHub redirects to `/auth/github/callback`
5. Auth Service creates/updates user
6. Front-end receives JWT tokens in redirect

**REST Endpoint:**
```
GET http://localhost:4001/auth/github
```

### Setup Instructions

For complete OAuth2 setup with credentials:
👉 **[OAUTH2_SETUP.md](OAUTH2_SETUP.md)**

This guide covers:
- Setting up Google Cloud Project & OAuth credentials
- Setting up GitHub OAuth Application
- Environment variable configuration
- Testing OAuth flows locally
- Production deployment considerations

## Authentication

### JWT Tokens

**Access Token:**
- Used for API requests
- Expires in 1 hour (configurable via `JWT_EXPIRATION`)
- Include in `Authorization: Bearer <token>` header
- Payload: `{ sub: userId }`

**Refresh Token:**
- Stored in database
- Expires in 7 days
- Used to get new access tokens
- Can be revoked on logout

### Protected Endpoints

Use the `@UseGuards(PassportAuthGuard)` decorator on resolvers/endpoints that require authentication. The JWT strategy automatically validates tokens from the Authorization header.

```typescript
@Query(() => UserGQL)
@UseGuards(PassportAuthGuard)
async me(@CurrentUser('userId') userId: string) {
  // Access granted only if valid JWT provided
}
```

## Kafka Events

### user-registered

Published when a user successfully registers.

**Topic:** `user-registered`

**Event Schema:**
```typescript
{
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  createdAt: Date
}
```

**Usage in Other Services:**
```typescript
async onModuleInit() {
  await this.kafkaService.subscribeToTopic(
    'user-registered',
    async (message) => {
      const event = JSON.parse(message.value.toString());
      // Handle user registration (update search index, create profile, etc.)
    },
  );
}
```

## Environment Variables

```env
# Server
NODE_ENV=development
SERVICE_NAME=auth-service
PORT=4001

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=ecommerce_user
DATABASE_PASSWORD=ecommerce_password
DATABASE_NAME=ecommerce_db

# Kafka
KAFKA_BROKERS=kafka:29092

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_EXPIRATION=3600s

# Email Service (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=E-Commerce
EMAIL_FROM_ADDRESS=noreply@ecommerce.com

# Logging
LOG_LEVEL=debug
```

## Running the Service

### With Docker Compose

```bash
# Start all services (including postgres, kafka, etc.)
docker-compose up -d

# Service will be available at http://localhost:4001/graphql
```

### Local Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Setup environment
cp .env.example .env

# Build
npm run build

# Run auth service in watch mode
npm run start:auth

# Access GraphQL at http://localhost:4001/graphql
```

### Testing GraphQL Mutations

**Using curl:**
```bash
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation Register { register(email: \"test@example.com\", password: \"test123\", firstName: \"Test\", lastName: \"User\") { user { id email } tokens { accessToken } } }"
  }'
```

**Using GraphQL Playground (built-in):**
1. Open http://localhost:4001/graphql
2. Copy and paste mutations/queries from this documentation
3. Execute and view results

## Security Considerations

1. **Password**: Always hashed with bcrypt (10 rounds)
2. **JWT Secret**: Must be changed in production
3. **Refresh Token**: Stored in database, can be revoked
4. **Database**: PostgreSQL with unique constraints on email
5. **HTTPS**: Production should use HTTPS only
6. **CORS**: Configure for your domain

## Error Handling

The service returns GraphQL errors with appropriate messages:

- `Invalid credentials` - Wrong email or password
- `User with this email already exists` - Registration with existing email
- `Refresh token is invalid or expired` - Invalid or expired refresh token
- `Unauthorized` - Missing or invalid JWT token

## Next Steps

1. **Products Service** - Product catalog with MongoDB
2. **Orders Service** - Order processing with PostgreSQL
3. **Payments Service** - Payment transactions
4. **Integrate Auth** - Other services should validate JWT tokens from Auth Service

## File Structure

```
apps/auth-service/src/
├── main.ts                      # Entry point
├── auth-service.module.ts       # Main module
├── auth.service.ts              # Core auth logic
├── auth.resolver.ts             # GraphQL mutations/queries
├── auth.types.ts                # GraphQL type definitions
├── user.service.ts              # User CRUD
├── user.entity.ts               # User database entity
├── refresh-token.entity.ts      # Refresh token entity
├── jwt.strategy.ts              # JWT Passport strategy
├── passport-auth.guard.ts       # JWT authentication guard
└── test/                        # Tests
```

## Development Notes

- Uses NestJS with TypeORM for PostgreSQL
- GraphQL via Apollo Server
- Passport with JWT strategy
- bcrypt for password hashing
- Kafka for event publishing
- Winston logger for centralized logging

---

Last Updated: Phase 3 - April 2, 2026
