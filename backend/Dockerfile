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

# Copiar package.json da RAIZ (onde estão as dependências)
COPY ../package*.json ./

# Instalar TODAS as dependências (produção + dev para o build do Next.js)
RUN npm ci


# ========================================
# ESTÁGIO 3: Build do Next.js
# ========================================
FROM base AS builder

WORKDIR /app

# Copiar node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copiar arquivos de configuração da raiz
COPY ../package*.json ./
COPY ../jsconfig.json ./
COPY ../next.config.js* ./

# Copiar código do frontend (Next.js precisa disso)
COPY ../frontend ./frontend

# Build do Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# ========================================
# ESTÁGIO 4: Imagem de Produção
# ========================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressuser

# Criar diretórios necessários
RUN mkdir -p uploads logs
RUN chown -R expressuser:nodejs uploads logs

# Copiar dependências de produção
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copiar código do backend
COPY --chown=expressuser:nodejs backend ./backend

# Copiar build do Next.js
COPY --from=builder --chown=expressuser:nodejs /app/.next ./.next
COPY --from=builder --chown=expressuser:nodejs /app/frontend/public ./frontend/public

# Mudar para usuário não-root
USER expressuser

EXPOSE 3000

# Variáveis de ambiente
ENV PORT=3000
ENV PYTHON_SERVICE_URL=http://python-service:5000

# Iniciar servidor
CMD ["node", "backend/server.js"]