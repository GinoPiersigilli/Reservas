# Etapa 1: Instalación de dependencias de producción
FROM node:25-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: Imagen final de producción (sin código de test ni seeders, usuario no root)
FROM node:25-alpine AS production

RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json index.js .sequelizerc ./
COPY --chown=node:node src ./src
COPY --chown=node:node db/config.cjs ./db/config.cjs
COPY --chown=node:node db/migrations ./db/migrations
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh

RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "index.js"]
