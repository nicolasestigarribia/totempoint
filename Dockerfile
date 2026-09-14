# --- build stage ---
FROM oven/bun:1.4 AS build
WORKDIR /app

# install deps (uses bun.lock)
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# build app with node-server nitro preset
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

# --- runtime stage ---
FROM node:22-slim AS runtime
WORKDIR /app

# nitro node-server output is standalone (deps bundled)
COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
