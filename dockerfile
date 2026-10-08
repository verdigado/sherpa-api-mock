FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY fixtures ./fixtures

CMD ["node", "src/main.ts"]
