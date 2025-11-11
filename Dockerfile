# ========================================
# ESTÁGIO 1: Imagem Base
# ========================================
FROM node:20-alpine AS base

# Instalar dependências necessárias
RUN apk add --no-cache libc6-compat

WORKDIR /app


# ========================================
# ESTÁGIO 2: Instalar Dependências
# ========================================
FROM base AS deps

WORKDIR /app

# Copiar package.json da RAIZ (onde estão as dependências)
COPY package*.json ./

<<<<<<< HEAD
=======
# Instalar todas as dependências (incluindo devDependencies para o build)
>>>>>>> 75c838f9afb186244d4ba6faebd616cf29626514
RUN npm ci


# ========================================
# ESTÁGIO 3: Build da Aplicação
# ========================================
FROM base AS builder

WORKDIR /app

# Copiar node_modules instalados
COPY --from=deps /app/node_modules ./node_modules

# Copiar arquivos de configuração da RAIZ
COPY package*.json ./
COPY jsconfig.json ./
COPY postcss.config.js* ./
COPY tailwind.config.js* ./

# ⚠️ IMPORTANTE: Se você tiver next.config.js na raiz, copie também
COPY next.config.js* ./

# Copiar TODO o código do frontend
COPY frontend ./frontend

# Definir variáveis de ambiente para o build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Fazer o build do Next.js
# O Next.js vai procurar o app em frontend/
RUN npm run build

# Verificar se o build foi criado
RUN ls -la .next || echo "⚠️ Diretório .next não encontrado!"


# ========================================
# ESTÁGIO 4: Imagem de Produção
# ========================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Criar diretórios necessários
RUN mkdir -p .next
RUN chown nextjs:nodejs .next

# Copiar arquivos públicos (se existirem)
COPY --from=builder --chown=nextjs:nodejs /app/frontend 

# Copiar arquivos de build do Next.js
# Next.js em modo standalone cria tudo em .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Mudar para usuário não-root
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Comando para iniciar
CMD ["node", "server.js"]