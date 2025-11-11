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
COPY package*.json ./
RUN npm ci

# ========================================
# ESTÁGIO 3: Build do Next.js
# ========================================
FROM base AS builder
WORKDIR /app

# Copiar node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copiar arquivos de configuração
COPY package*.json ./
COPY jsconfig.json* ./
COPY postcss.config.js* ./
COPY next.config.mjs ./

# Copiar código do frontend
COPY frontend ./frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build do Next.js
RUN npm run build

# Verificar se o build foi criado
RUN ls -la .next && echo "✅ Build do Next.js criado!"

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

# Copiar dependências de produção
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copiar código do frontend
COPY --from=builder /app/frontend ./frontend

# Copiar build do Next.js
COPY --from=builder /app/.next ./frontend/.next

# Ajustar permissões
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usar next start
CMD ["npx", "next", "start", "./frontend", "-p", "3000"]