FROM node:20-alpine

WORKDIR /app

# Copiar configs da raiz
COPY package*.json ./
COPY jsconfig.json* ./
COPY next.config.mjs* ./
COPY postcss.config.mjs* ./
COPY tailwind.config.mjs* ./

# Copiar código do frontend (para dentro da raiz do container)
COPY ./frontend

# Copiar também as pastas principais para a raiz, pois o Next vai procurá-las aqui
RUN cp -r frontend/app ./ || true
RUN cp -r frontend/pages ./ || true
RUN cp -r frontend/components ./ || true
RUN cp -r frontend/hooks ./ || true
RUN cp -r frontend/services ./ || true
RUN cp -r frontend/styles ./ || true

# Instalar dependências
RUN npm ci

# Fazer build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Expor porta e iniciar o servidor
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
