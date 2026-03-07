FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install sqlite3 for database initialization
RUN apk add --no-cache sqlite

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma client and adapter
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@prisma/adapter-libsql ./node_modules/@prisma/adapter-libsql
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Copy migration files
COPY --from=builder /app/prisma/migrations ./prisma/migrations

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
