FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY config ./config
COPY server.js ./
COPY lib ./lib
COPY public ./public

RUN mkdir -p /app/data/logs && chown -R node:node /app

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const { loadConfig } = require('./config'); const config = loadConfig(); fetch('http://127.0.0.1:' + config.server.port + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node

CMD ["npm", "start"]
