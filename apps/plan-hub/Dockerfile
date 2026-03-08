FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/plan-hub/package.json apps/plan-hub/
COPY packages/ui/package.json packages/ui/
COPY packages/editor/package.json packages/editor/
COPY packages/shared/package.json packages/shared/
RUN bun install
COPY packages/ packages/
COPY apps/plan-hub/ apps/plan-hub/
RUN bun run --cwd apps/plan-hub build:dashboard

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/apps/plan-hub/src/ ./src/
COPY --from=builder /app/apps/plan-hub/dist/ ./dist/
EXPOSE 19434
VOLUME /data
ENV HUB_DB_PATH=/data/hub.sqlite
CMD ["bun", "run", "src/index.ts"]
