# PromptDesk API — self-contained production image (no shared deps base).
# Build context: repo root (deploy/ + apps/), from apps/api's own lockfile.
# Runs: prisma generate (both schemas), nest build, non-root runtime.
# Migrations are NOT done here — deploy/migrate.sh runs in the one-shot
# `migrate` compose service (same image); never on container start.
# Gate endpoints: /version (deploy probe), /auth/me (401 = auth alive).

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN cd apps/api && npm ci --no-audit --no-fund

FROM deps AS build
COPY apps/api/ ./apps/api/
COPY deploy/ ./deploy/
# Generators write clients into apps/api/node_modules (see schema.prisma output)
RUN set -e; \
    cd apps/api \
    && npx prisma generate --schema prisma/schema.prisma \
    && npx prisma generate --schema prisma-chat/schema.prisma \
    && npx nest build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma-chat ./prisma-chat
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/deploy/migrate.sh /app/deploy/migrate.sh
RUN set -e; \
    groupadd --system app \
    && useradd --system --gid app --home-dir /app app \
    && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/version').then((r) => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
