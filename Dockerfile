FROM node:16

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build

ENV PORT=8080
EXPOSE 8080

USER node
ENTRYPOINT [ "npm", "run", "start" ]
