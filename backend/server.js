import express from "express";
import next from "next";
import cors from "cors";
import dotenv from "dotenv";
import fileRoutes from "./routes/fileRoutes.js"
import path from "path";

dotenv.config();

const PORT = process.env.PORT;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://python-service:5000';

const server = express();

// ========================================
// CORS - Configuração para Docker
// ========================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://frontend:3000',
  'http://backend:4000',
  'http://nginx:80',
  'http://172.23.60.15:3000',
  'http://172.23.60.15:4000',
];

server.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization']
}));


app.prepare().then(() => {

  const server = express();

  // console.log(FRONTEND_URL);

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

  server.use("/files", fileRoutes); //antiga api

  server.all('/{*splat}', (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`🚀 Servidor Next.js/Express rodando em ${FRONTEND_URL}`);
  });


});






// Rotas principais
// app.get("/api/files", fileRoutes);

// app.get("/", (req, res) => {
//   res.send("Servidor ativo e pronto!");
// });

// // app.get("frontend-next")

// app.listen(PORT, () => {
//   console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
// });