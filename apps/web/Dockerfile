FROM node:22-bookworm AS build
WORKDIR /repo
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /repo/apps/web
RUN npm ci --no-audit --no-fund
COPY apps/shared ./../shared
COPY apps/web ./
ARG VITE_API_URL=/api
ARG VITE_SUPPORT_ORIGIN
ARG VITE_SSO_RETURN_ORIGINS
ENV VITE_API_URL=$VITE_API_URL \
  VITE_SUPPORT_ORIGIN=$VITE_SUPPORT_ORIGIN \
  VITE_SSO_RETURN_ORIGINS=$VITE_SSO_RETURN_ORIGINS
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
