# Single-container image: builds the core package and the web bundle, then runs
# the Fastify server, which also serves the built SPA and keeps data in SQLite.
FROM node:24-alpine

WORKDIR /app

# Install dependencies from the workspace lockfile. Only the manifests are
# copied first so this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN npm ci

# Copy sources, then build core (packages/core/dist) and web (web/dist).
COPY packages/core packages/core
COPY web web
COPY server server
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_ROOT=/app/web/dist
ENV DB_PATH=/data/cricket.db

EXPOSE 3000
CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
