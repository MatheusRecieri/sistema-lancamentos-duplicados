import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

/**
 * Cliente para comunicação com o microserviço Python
 */
class PythonServiceClient {
  constructor(baseURL = PYTHON_SERVICE_URL) {
    this.client = axios.create({
      baseURL,
      // timeout: 5000000,
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
  }

  /**
   * Verifica se o serviço Python está online
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('❌ Serviço Python offline:', error.message);
      return null;
    }
  }

  /**
   * Envia PDF para análise
   * @param {string} filePath - Caminho do arquivo PDF
   * @returns {Promise<Object>} - Resultado da análise
   */
  async analyzeArchive(filePath) {
    try {
      console.log(`🚀 Enviando Arquivo para análise: ${filePath}`);

      // Cria FormData
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      // Envia para o serviço Python
      const response = await this.client.post('/analyze', formData, {
        headers: formData.getHeaders(),
      });

      console.log('✅ Análise concluída pelo serviço Python');
      return response.data;

    } catch (error) {
      console.error('❌ Erro na análise Python:', error.message);

      if (error.response) {
        console.error('Detalhes:', error.response.data);
        throw new Error(error.response.data.detail || 'Erro no serviço Python');
      }

      throw error;
    }
  }

  /**
   * Análise em modo debug (retorna dados brutos)
   * @param {string} filePath - Caminho do arquivo PDF
   * @returns {Promise<Object>} - Dados de debug
   */
  async analyzePDFDebug(filePath) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await this.client.post('/analyze/debug', formData, {
        headers: formData.getHeaders(),
      });

      return response.data;

    } catch (error) {
      console.error('❌ Erro no debug:', error.message);
      throw error;
    }
  }
}

// Exporta instância singleton
export const pythonService = new PythonServiceClient();

// Exporta classe para testes
export { PythonServiceClient };