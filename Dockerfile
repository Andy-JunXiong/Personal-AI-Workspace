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

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["npm", "start"]
