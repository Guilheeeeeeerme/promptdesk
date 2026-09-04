FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY prisma ./prisma
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
