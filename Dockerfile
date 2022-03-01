FROM node:16-alpine

WORKDIR /app
# RUN chown -R node:node /app

COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
RUN npm run build

EXPOSE 8080

USER node
ENTRYPOINT [ "npm", "run", "start" ]
