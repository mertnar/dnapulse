# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY services/decision/package.json services/decision/package-lock.json ./
RUN npm ci

# Copy source code
COPY services/decision/tsconfig.json ./
COPY services/decision/src ./src

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY services/decision/package.json services/decision/package-lock.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /build/dist ./dist

CMD ["node", "dist/index.js"]
