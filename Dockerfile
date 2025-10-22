# Multi-stage Dockerfile for Margin Calculator standalone deployment
#
# This Dockerfile creates a containerized version of the Margin Calculator
# that runs in standalone mode (database-only storage, no file watching).
#
# Usage:
#   docker build -t margin-calculator .
#   docker run -p 3000:3000 margin-calculator
#   docker run -p 3000:3000 -v $(pwd)/data:/app/data margin-calculator

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript and copy static assets
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S margin && \
    adduser -S -u 1001 -G margin margin

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory for potential volume mounting
RUN mkdir -p /app/data /app/.margin && \
    chown -R margin:margin /app

# Switch to non-root user
USER margin

# Expose default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/suppliers', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LOCATION_DIR=/app/.margin

# Use dumb-init with entrypoint script
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Run in standalone mode by default
CMD ["node", "dist/index.js", "ui", "--standalone", "--port", "3000", "--no-open", "--location", "/app/.margin"]
