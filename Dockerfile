FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY db ./db
RUN npm run build

FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV PAW_DB_PATH=/app/data/workspace.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY db ./db

RUN mkdir -p /app/data /app/backups \
    && chown -R node:node /app/data /app/backups

VOLUME ["/app/data"]
EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "dist/src/server.js"]
