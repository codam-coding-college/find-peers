FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

ENV PORT=8080
EXPOSE 8080

USER node
ENTRYPOINT [ "npm", "run", "start" ]
