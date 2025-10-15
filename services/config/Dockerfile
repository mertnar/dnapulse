# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY services/config/package.json services/config/package-lock.json ./
RUN npm ci

# Copy source code
COPY services/config/tsconfig.json ./
COPY services/config/src ./src

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY services/config/package.json services/config/package-lock.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /build/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S config -u 1001

USER config

EXPOSE 8080
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://0.0.0.0:8080/health || exit 1

CMD ["node", "dist/index.js"]
