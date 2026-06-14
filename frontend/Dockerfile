# Dev image — runs the Vite dev server (HMR). Source is bind-mounted by compose.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .

EXPOSE 3000
# --host so it's reachable from outside the container
CMD ["pnpm", "dev", "--host"]
