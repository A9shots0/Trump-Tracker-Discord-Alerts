# Base stage for both development and production
FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install -g typescript ts-node-dev
RUN npm install
# Don't copy source files - they will be mounted via docker-compose watch
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
RUN npm install --production
COPY . .
RUN npm run build
CMD ["npm", "start"] 