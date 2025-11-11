FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Etapa de dependências
FROM base AS deps
COPY package.json ./
RUN npm ci

# Etapa de build
FROM base AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend ./ 
RUN npm run build

# Verificar se o build foi criado
RUN ls -la .next || echo "⚠️ Build do Next.js não foi gerado!"

# Etapa final (runner)
FROM base AS runner
WORKDIR /app
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/package.json ./package.json
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/frontend/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["npm", "start"]
