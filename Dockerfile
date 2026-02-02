# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma: schema + generate client for runtime
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built app from builder
COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

# No env vars hardcoded; pass at runtime (docker run -e or compose)
CMD ["node", "dist/main.js"]
