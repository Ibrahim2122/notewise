# ──────────────────────────────────────────
# Stage 1: deps — install dependencies
# ──────────────────────────────────────────
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

RUN pnpm rebuild sharp

COPY . .

RUN --mount=type=secret,id=envfile,target=/app/.env.local pnpm build

EXPOSE 80

CMD [ "pnpm", "start", "-p", "80" ]