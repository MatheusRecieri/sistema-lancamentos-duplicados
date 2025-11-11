# ========================================
# Backend Express (SEM Next.js)
# ========================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ========================================
# Instalar Dependências de Produção
# ========================================
FROM base AS deps
WORKDIR /app

COPY package*.json ./

# Instalar apenas dependências de produção
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

# Criar diretórios necessários
RUN mkdir -p uploads logs
RUN chown -R expressuser:nodejs uploads logs

# Copiar dependências de produção
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copiar APENAS o código do backend
COPY --chown=expressuser:nodejs backend ./backend

# Mudar para usuário não-root
USER expressuser

EXPOSE 4000

ENV PORT=4000
ENV PYTHON_SERVICE_URL=http://python-service:5000

# ⚠️ IMPORTANTE: Iniciar APENAS o servidor Express
CMD ["node", "backend/server.js"]