FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@flow-analytics/api --workspace=@flow-analytics/shared

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@flow-analytics/shared
RUN npm run build --workspace=@flow-analytics/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src/db/migrations ./apps/api/dist/db/migrations
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/node_modules ./node_modules
COPY apps/api/package.json ./apps/api/

CMD ["node", "apps/api/dist/index.js"]
