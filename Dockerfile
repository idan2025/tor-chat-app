# Multi-stage build for TOR Chat Backend
FROM node:18-alpine AS builder

# Install build dependencies for native modules (bcrypt, etc)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies (allow scripts to build native modules)
RUN npm install --workspace=@tor-chat/backend

# Copy source code
COPY packages/backend ./packages/backend

# Build backend
WORKDIR /app/packages/backend
RUN npm run build

# Production stage
FROM node:18-alpine

# Install TOR and build dependencies for native modules
RUN apk add --no-cache tor python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Copy node_modules from builder (includes compiled native modules)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules

# Copy built files from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Create TOR directories
RUN mkdir -p /var/lib/tor/hidden_service && \
    chown -R node:node /var/lib/tor

# Create logs directory
RUN mkdir -p /app/packages/backend/logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

WORKDIR /app/packages/backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
