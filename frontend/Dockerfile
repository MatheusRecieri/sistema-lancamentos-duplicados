FROM node:20-alpine

WORKDIR /app

# Copiar package.json da raiz
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar arquivos de configuração e o código
COPY jsconfig.json* ./
COPY next.config.mjs* ./
COPY postcss.config.mjs* ./
COPY tailwind.config.mjs* ./
COPY frontend ./frontend

# Entrar na pasta frontend
WORKDIR /app/frontend

# Fazer build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Expor porta e iniciar o servidor
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
