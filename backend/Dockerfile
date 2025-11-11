# Etapa de build
FROM node:18 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Se o backend não tem build (só Node/Express), pode pular o build
# RUN npm run build  # só se existir

# Etapa final
FROM node:18-alpine

WORKDIR /frontend
COPY --from=builder /frontend ./

USER node

CMD ["node", "server.js"]