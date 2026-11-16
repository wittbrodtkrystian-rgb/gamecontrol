# Podgląd aplikacji (tryb DEMO) — nie jest to konfiguracja produkcyjna.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL="postgresql://x:x@localhost:5432/x?schema=public" APP_URL="http://localhost" CRON_SECRET="build-only-secret-build-only-secret"
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
