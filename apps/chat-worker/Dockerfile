FROM node:22-bookworm AS build
WORKDIR /build/apps/chat-worker
COPY apps/chat-worker/package.json apps/chat-worker/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/chat-worker ./
COPY apps/api/prisma ./prisma-core
COPY apps/api/prisma-chat ./prisma-chat
RUN npm run prisma:generate \
  && npm run build

FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /build/apps/chat-worker/node_modules ./node_modules
COPY --from=build /build/apps/chat-worker/dist ./dist
COPY --from=build /build/apps/chat-worker/prompts ./prompts
COPY --from=build /build/apps/chat-worker/prisma-core ./prisma-core
COPY --from=build /build/apps/chat-worker/prisma-chat ./prisma-chat
EXPOSE 3001
CMD ["node", "dist/main.js"]
