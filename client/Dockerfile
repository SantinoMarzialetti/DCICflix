# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage - serve with nginx
FROM node:18-alpine

WORKDIR /app

# Install http-server to serve the built app
RUN npm install -g http-server

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8080', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["http-server", "dist", "-p", "8080", "-c-1"]
