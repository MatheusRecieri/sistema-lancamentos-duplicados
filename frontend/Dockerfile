FROM node:20-alpine

WORKDIR /app

# Copiar package.json da raiz
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar arquivos de configuração
COPY jsconfig.json* ./
COPY next.config.js* ./
COPY postcss.config.js* ./
COPY tailwind.config.js* ./

# Copiar código do frontend
COPY frontend ./frontend

# Build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Fazer build (agora vai funcionar!)
RUN npm run build

# Verificar se criou
RUN ls -la frontend/.next || echo "ERRO: Build não gerou .next"

EXPOSE 3000

# Iniciar Next.js
CMD ["npx", "next", "start", "frontend", "-p", "3000"]