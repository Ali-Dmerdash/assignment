# ---- Build stage ----
FROM node:22-alpine AS build
RUN corepack enable
# bcrypt compiles native bindings — alpine needs these to build it
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .
RUN pnpm build

# drop dev dependencies but keep the compiled native modules
RUN pnpm prune --prod

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE 5000
CMD ["node", "dist/server.js"]