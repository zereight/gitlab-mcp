FROM node:22.21.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm ci --ignore-scripts --omit-dev

FROM node:22.21.1-alpine AS release

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

EXPOSE 3002

ENTRYPOINT ["node", "build/index.js"]
