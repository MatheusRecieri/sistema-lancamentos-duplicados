import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fileRoutes from "./src/routes/fileRoutes.js";
import path from "path";

dotenv.config();

const PORT = process.env.PORT || 4000;
const server = express();

server.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

server.use(express.json());

server.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

server.use("/uploads", express.static(path.resolve("uploads")));
server.use("/api/files", fileRoutes);

server.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend-api' });
});

server.use((err, req, res, next) => {
  console.error('❌ Erro:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

server.listen(PORT, (err) => {
  if (err) throw err;
  console.log(`🚀 Backend API rodando na porta ${PORT}`);
});