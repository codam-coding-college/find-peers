FROM node:16

WORKDIR /app
# RUN chown -R node:node /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

ENV PORT=8080
EXPOSE 8080

USER node
ENTRYPOINT [ "npm", "run", "start" ]
