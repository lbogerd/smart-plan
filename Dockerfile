FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PLAN_DATA_DIR=/app/data
COPY --from=build /app/.output ./.output
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
