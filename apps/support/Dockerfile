FROM node:22-bookworm AS build
WORKDIR /repo
COPY apps/support/package.json apps/support/package-lock.json ./apps/support/
WORKDIR /repo/apps/support
RUN npm ci --no-audit --no-fund
COPY apps/shared ./../shared
COPY apps/support ./
ARG VITE_API_URL=/api
ARG VITE_MAIN_ORIGIN
ENV VITE_API_URL=$VITE_API_URL \
  VITE_MAIN_ORIGIN=$VITE_MAIN_ORIGIN
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/support/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/support/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
