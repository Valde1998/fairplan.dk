FROM node:22-bookworm-slim

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund
COPY --chown=node:node frontend/ ./

# Next.js gemmer API-adressen i sin produktionsbygning.
ENV API_URL=http://backend:5002 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN npm run build

EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3001"]
