# ==============================================================================
# Multi-Stage Production Dockerfile for Smart Helmet Tactical Mesh Frontend
# ==============================================================================

# Stage 1: Build React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# Copy full frontend source code
COPY . .

# Build production assets with Vite
RUN npm run build

# Stage 2: Serve with Lightweight Production Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard web port
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
