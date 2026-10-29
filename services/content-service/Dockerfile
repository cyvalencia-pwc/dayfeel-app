FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts/clean-build.cjs ./scripts/clean-build.cjs
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8082
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8082') + '/health', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node","dist/server.js"]
