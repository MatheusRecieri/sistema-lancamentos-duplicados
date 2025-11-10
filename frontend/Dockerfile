FROM node:20-alpine

WORKDIR /app/frontend

# Copiar arquivos do frontend
COPY frontend/package*.json ./
RUN npm ci

# Copiar todos os arquivos do frontend
COPY frontend/ .

# Copiar configs da raiz (para o build funcionar corretamente)
COPY ../jsconfig.json /app/jsconfig.json
COPY ../next.config.mjs /app/next.config.mjs
COPY ../postcss.config.mjs /app/postcss.config.mjs
COPY ../tailwind.config.mjs /app/tailwind.config.mjs

# Fazer build de produção
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Expor porta e iniciar o servidor
EXPOSE 3000
CMD ["npm", "run", "start"]
