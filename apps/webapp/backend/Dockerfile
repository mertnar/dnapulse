# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only + zip utility for packaging downloads
RUN apk add --no-cache zip && npm ci --only=production

# Copy built files from builder
COPY --from=builder /build/dist ./dist

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/server.js"]
