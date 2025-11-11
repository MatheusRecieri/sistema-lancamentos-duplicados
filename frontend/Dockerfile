# ========================================
# ESTÁGIO 1: Imagem Base
# ========================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ========================================
# ESTÁGIO 2: Instalar Dependências
# ========================================
FROM base AS deps
WORKDIR /app

# Copiar package.json da RAIZ
COPY package*.json ./
RUN npm ci

# ========================================
# ESTÁGIO 3: Build do Next.js
# ========================================
FROM base AS builder
WORKDIR /app

# Copiar node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copiar arquivos de configuração da RAIZ
COPY package*.json ./
COPY jsconfig.json ./
COPY postcss.config.js* ./
COPY tailwind.config.js* ./
COPY next.config.js* ./

# Copiar código do frontend
COPY frontend ./frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build do Next.js
RUN npm run build

# Verificar se o build foi criado
RUN ls -la .next && echo "✅ Build do Next.js criado!" || echo "❌ Build falhou!"

# ========================================
# ESTÁGIO 4: Imagem de Produção
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos públicos
COPY --from=builder --chown=nextjs:nodejs frontend/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar build do Next.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]