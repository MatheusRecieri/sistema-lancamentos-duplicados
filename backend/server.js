
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fileRoutes from "./src/routes/fileRoutes.js";  // ⚠️ Ajuste o path se necessário
import path from "path";

dotenv.config();

const PORT = process.env.PORT || 4000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://python-service:5000';

const server = express();

// ========================================
// CORS - Configuração para Docker
// ========================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://frontend:3000',
  'http://invoice-frontend:3000',
].filter(Boolean);

server.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`⚠️ Origin bloqueada: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

server.use(express.json());

// ========================================
// Middleware de Log
// ========================================
server.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// ========================================
// Servir arquivos estáticos
// ========================================
server.use("/uploads", express.static(path.resolve("uploads")));

// ========================================
// Rotas da API
// ========================================
server.use("/api/files", fileRoutes);

// Health check
server.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    port: PORT,
    pythonService: PYTHON_SERVICE_URL
  });
});

// Rota de teste
server.get('/api/test', (req, res) => {
  res.json({ message: '✅ Backend funcionando!' });
});

// ========================================
// Iniciar Servidor
// ========================================
server.listen(PORT, '0.0.0.0', (err) => {
  if (err) throw err;
  console.log(`
========================================
🚀 Backend Express rodando!
========================================
📍 Porta: ${PORT}
🐍 Python Service: ${PYTHON_SERVICE_URL}
🌐 CORS: ${allowedOrigins.join(', ')}
========================================
  `);
});

export default server;