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
# ESTÁGIO 3: Build do Next.js (Frontend)
# ========================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY jsconfig.json ./
COPY postcss.config.js* ./
COPY tailwind.config.js* ./
COPY next.config.js* ./
COPY frontend ./frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build
RUN ls -la .next || echo "⚠️ Diretório .next não encontrado!"

# ========================================
# ESTÁGIO 4: Imagem de Produção (Backend + Frontend)
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Criar diretórios
RUN mkdir -p .next uploads logs
RUN chown -R appuser:nodejs .next uploads logs

# Copiar dependências
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copiar backend (Express)
COPY --chown=appuser:nodejs backend ./backend

# Copiar build do Next.js
COPY --from=builder --chown=appuser:nodejs /app/.next ./.next
COPY --from=builder --chown=appuser:nodejs /app/frontend/ ./frontend

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV PYTHON_SERVICE_URL=http://python-service:5000
ENV HOSTNAME="0.0.0.0"

# Iniciar servidor Express (que serve o Next.js)
CMD ["node", "backend/server.js"]