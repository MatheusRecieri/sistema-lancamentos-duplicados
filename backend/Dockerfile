FROM node:20-alpine

WORKDIR /app

# Copiar package.json da RAIZ
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production

# Copiar código do backend
COPY backend ./backend

# Criar diretórios necessários
RUN mkdir -p uploads logs

EXPOSE 4000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=4000

# Iniciar servidor API
CMD ["node", "backend/server.js"]

RUN npm install cors 