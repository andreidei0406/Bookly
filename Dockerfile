# ===========================================================================
# Bookly — Unified Multi-Stage Dockerfile
# Builds both Angular frontend and Express API into a single container
# ===========================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build Angular frontend
# ---------------------------------------------------------------------------
FROM node:24-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --configuration=production

# ---------------------------------------------------------------------------
# Stage 2: Install API production dependencies
# ---------------------------------------------------------------------------
FROM node:24-alpine AS api-deps
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: Generate Prisma client
# ---------------------------------------------------------------------------
FROM node:24-alpine AS api-build
WORKDIR /app
COPY api/package*.json ./
RUN npm ci
COPY api/src/prisma/schema.prisma src/prisma/
RUN npx prisma generate --schema=src/prisma/schema.prisma

# ---------------------------------------------------------------------------
# Stage 4: Production runtime (API + Frontend)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

# Copy production node_modules and Prisma engine
COPY --from=api-deps /app/node_modules ./node_modules
COPY --from=api-build /app/node_modules/.prisma ./node_modules/.prisma

# Copy API source code
COPY api/ ./

# Copy Angular build output into /app/public
COPY --from=frontend-build /frontend/dist/frontend/browser ./public

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "--experimental-strip-types", "-e", "fetch('http://localhost:' + (process.env.PORT || '3000') + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "--experimental-strip-types", "src/server.js"]
