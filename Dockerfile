# Hugging Face Spaces Dockerfile for Node.js Full-Stack App
FROM node:20-slim

WORKDIR /app

# Copy package manifest and install dependencies
COPY package.json ./
RUN npm install

# Copy application source files
COPY . .

# Build production assets (Vite frontend + bundled Node backend)
RUN npm run build

# Create data directory and grant ownership to the default node user (UID 1000)
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["node", "dist/server.cjs"]


