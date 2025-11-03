FROM node:18-alpine

# Install build dependencies and fix distutils in one layer
RUN apk add --no-cache python3 make g++ py3-setuptools py3-pip && \
    ln -sf /usr/lib/python3.12/site-packages/setuptools/_distutils /usr/lib/python3.12/distutils || echo "distutils workaround attempted"

WORKDIR /app
RUN mkdir -p /app/database

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies and build in fewer layers
RUN npm ci --ignore-scripts && \
    npm install --save-dev @types/oauth @types/passport-oauth2 @types/connect-sqlite3 && \
    npm rebuild

# Copy source files
COPY . .

# Build application and clean up in one layer
RUN npx prisma generate && \
    npx prisma migrate deploy && \
    npx prisma db push && \
    npm run build && \
    npm prune --omit=dev && \
    rm -rf src

# Move views to built location
RUN mv views build/

# Runtime configuration
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=10s --start-period=5s --retries=1 CMD wget -q -O - http://localhost:8080/robots.txt

ENTRYPOINT [ "npm", "start" ]
