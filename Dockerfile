FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS build
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM base AS release
WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist/index.js index.js

ENV NODE_ENV=production
USER bun
EXPOSE 3000

CMD ["bun", "index.js"]
