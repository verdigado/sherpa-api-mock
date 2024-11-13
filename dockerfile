FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install --only=production --silent

COPY src ./src
COPY data ./data

CMD ["node", "src/main.js"]
