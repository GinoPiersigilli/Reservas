# Etapa 1: Build estático con Vite
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL=/api
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Etapa 2: Servidor web Nginx para archivos estáticos y proxy /api (usuario sin privilegios)
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

USER root
RUN apk upgrade --no-cache
USER 101

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
