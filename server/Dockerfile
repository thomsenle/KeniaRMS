FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime sqlite dependencies
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=5000
ENV DATA_DIR=/app/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create directories for persistent volume mounting
RUN mkdir -p /app/data /app/uploads

EXPOSE 5000

USER node

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
