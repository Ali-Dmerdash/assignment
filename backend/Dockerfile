# Dev image — runs the source with tsx watch (no compile step)
FROM node:22-alpine
RUN corepack enable
# bcrypt compiles a native binding — alpine needs these to build it
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json ./
RUN pnpm install
RUN pnpm rebuild bcrypt

COPY . .

EXPOSE 5000
CMD ["pnpm", "dev"]
