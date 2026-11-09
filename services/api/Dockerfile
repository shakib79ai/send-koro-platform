# syntax=docker/dockerfile:1
# Multi-stage build: compile TypeScript, then ship only production dependencies + dist.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node package.json ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:3001/health || exit 1
# Apply pending migrations, then start. Run a single replica per service (jobs run in-process).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]
