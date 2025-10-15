FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY services/categorization/package.json services/categorization/package-lock.json ./
RUN npm ci

# Copy source code
COPY services/categorization/src ./src
COPY services/categorization/tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies
COPY services/categorization/package.json services/categorization/package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S categorization -u 1001
USER categorization

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
