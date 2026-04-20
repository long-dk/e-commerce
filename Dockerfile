# Multi-stage build for NestJS applications
FROM node:20-alpine AS base

FROM base AS builder

WORKDIR /app

ARG SERVICE_NAME

# Copy monorepo files
COPY package.json pnpm-lock.yaml ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

# Copy apps and libs
COPY apps ./apps
COPY libs ./libs

# Install dependencies
RUN corepack enable
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm run build ${SERVICE_NAME}

# Production stage
FROM base AS runner

WORKDIR /app

ARG SERVICE_NAME

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN corepack enable
RUN pnpm install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p /app/logs

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Change ownership to nestjs user
RUN chown -R nestjs:nodejs /app
USER nestjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command - override in docker-compose
CMD ["node", "dist/apps/${SERVICE_NAME}/main"]
