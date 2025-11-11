# Estágio 1: Base
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Estágio 2: Dependências
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Estágio 3: Build
FROM base AS builder
WORKDIR /app

# Copiar node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copiar configurações
COPY package*.json ./
COPY jsconfig.json ./
COPY next.config.mjs ./

# Copiar código do frontend
COPY frontend ./frontend

# Configurar ambiente
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Fazer build (a partir da raiz, apontando para frontend)
RUN npm run build

# Verificar o que foi gerado
RUN ls -la frontend/.next || echo "❌ .next não encontrado"

# Estágio 4: Produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar build (todos os caminhos relativos a /app do builder)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next ./frontend/.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/frontend ./frontend

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Iniciar Next.js apontando para a pasta frontend
CMD ["npx", "next", "start", "frontend", "-p", "3000"]