# ========================================
# Backend Express (sem Next.js)
# ========================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ========================================
# Instalar Dependências
# ========================================
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ========================================
# Imagem de Produção
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressuser

# Criar diretórios
RUN mkdir -p uploads logs
RUN chown -R expressuser:nodejs uploads logs

# Copiar dependências
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copiar código do backend
COPY --chown=expressuser:nodejs backend ./backend

USER expressuser

EXPOSE 4000

ENV PORT=4000

# Iniciar servidor Express
CMD ["node", "backend/server.js"]