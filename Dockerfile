# Single container: builds the web app, then serves it + the agent API on :8787.
# Works on Nebius Serverless Endpoints / AI Cloud or any container host.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
