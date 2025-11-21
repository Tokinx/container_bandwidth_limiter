# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY frontend/ ./

# Build frontend
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

# Copy package files
COPY backend/package.json ./
COPY package.json ../package.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY backend/ ./

# Build backend
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY package.json ./
RUN npm install --production --legacy-peer-deps && \
    npm cache clean --force

# Copy built backend
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./dist/frontend/dist

# Create necessary directories
RUN mkdir -p /data /logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/verify', (r) => {process.exit(r.statusCode === 401 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
