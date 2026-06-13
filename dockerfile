FROM node:20-alpine AS build

WORKDIR /app
# build deps for the better-sqlite3 native module
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts
# all json: static reads (divisions/roles/tags) + seed data (users/profiles), baked into the image
COPY data ./data

# keep the sqlite database off /app/data so a volume mount there can't shadow the json
ENV DB_PATH=/app/db/app.db
RUN mkdir -p /app/db

CMD ["node", "src/main.js"]
