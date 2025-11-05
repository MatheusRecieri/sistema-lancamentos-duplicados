import express from "express";
import next from "next";
import cors from "cors";
import dotenv from "dotenv";
import fileRoutes from "./routes/fileRoutes.js"
import path from "path";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'development';
const app = next({ dev, dir: './frontend' });
const handle = app.getRequestHandler();


app.prepare().then(() => {

  const server = express();

  server.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

  server.use(express.json());

  // Middleware de log ANTES das rotas
  server.use((req, res, next) => {
    // console.log(`📨 ${req.method} ${req.path}`);
    next();
  });

  // CORREÇÃO: era app.search, agora é app.use
  server.use("/uploads", express.static(path.resolve("uploads")));

  //rota de upload de arquivos
  server.use("/files", fileRoutes);

  //request para todas as rotas
  server.all('/{*splat}', (req, res) => {
    return handle(req, res);
  });

  //portas 
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`🚀 Servidor Next.js/Express rodando em ${FRONTEND_URL}`);
  });


});