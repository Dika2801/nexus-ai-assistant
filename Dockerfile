# Multi-stage Dockerfile for Zero-Cost Hugging Face Spaces / Container Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci || npm install

# Copy application source
COPY . .

# Build Vite frontend and bundled Node/Express backend (dist/server.cjs)
RUN npm run build

# Production runtime container
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

# Create app directory with user permissions for Hugging Face Space (user 1000)
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production assets from builder
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

USER node

EXPOSE 7860

CMD ["node", "dist/server.cjs"]
