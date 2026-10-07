# PromptDesk chat-worker — self-contained production image (no shared deps base).
# Build context: repo root. Needs the core schemas + src code from apps/api (see ../api/gen).
# Runs: prisma generate (core = chat-worker schema deps + chat schema), nest build, non-root runtime.
# Ports healthcheck :3001/health per infra chatworker.Dockerfile.

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY apps/chat-worker/package.json apps/chat-worker/package-lock.json ./apps/chat-worker/
RUN cd apps/chat-worker && npm ci --no-audit --no-fund

FROM deps AS build
COPY apps/chat-worker/ ./apps/chat-worker/
# Chat-worker's prisma:generate sources live in apps/api (see packages.json)
COPY apps/api/prisma ./apps/chat-worker/prisma-core
COPY apps/api/prisma-chat ./apps/chat-worker/prisma-chat
RUN set -e; \
    cd apps/chat-worker \
    && npm run prisma:generate \
    && npx nest build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
# prompt-registry.ts resolves ../prompts relative to dist (see src), so dist/, prompts/ + node_modules/
COPY --from=build /repo/apps/chat-worker/node_modules ./node_modules
COPY --from=build /repo/apps/chat-worker/dist ./dist
COPY --from=build /repo/apps/chat-worker/prompts ./prompts
COPY --from=build /repo/apps/chat-worker/package.json ./package.json
RUN set -e; \
    groupadd --system app \
    && useradd --system --gid app --home-dir /app app \
    && chown -R app:app /app
USER app
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 CMD node -e "fetch('http://127.0.0.1:3001/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
