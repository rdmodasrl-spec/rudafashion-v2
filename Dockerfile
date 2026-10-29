FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate && npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./

USER node
EXPOSE 8080
CMD ["npm", "start"]
