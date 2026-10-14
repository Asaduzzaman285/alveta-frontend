FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Dev-only stage — selected by docker-compose.yml's `target: dev`, never by production
# (docker-compose.prod.yml / .aws.yml name no target, so they still get the LAST stage,
# `runner`; this stage must therefore stay ABOVE it).
#
# Why it's needed: the dev compose service bind-mounts ./frontend over /app for live
# reload, which shadows everything `runner` copies in — including the standalone
# build's own /app/server.js, so `runner`'s `CMD ["node", "server.js"]` died with
# MODULE_NOT_FOUND on every start. Dev wants `next dev` against the mounted source
# anyway, and this stage also gives that service's anonymous /app/node_modules volume
# a real directory to seed itself from (the `runner` stage has none — a standalone
# build bundles its deps inside .next/standalone instead).
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
