# Stage 1: Build the React frontend
FROM node:24-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:24-alpine AS production
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install server dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy server code
COPY server/ ./

# Copy built frontend assets from client-builder into client/dist for Express to serve
COPY --from=client-builder /app/client/dist /app/client/dist

# Create persistent data directory for SQLite
RUN mkdir -p /app/server/data

# Expose app port
EXPOSE 5000

# Start server with native SQLite support
CMD ["node", "--no-warnings", "--experimental-sqlite", "index.js"]
