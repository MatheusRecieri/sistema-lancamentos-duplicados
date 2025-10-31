import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;

/**
 * Cliente para comunicação com o microserviço Python
 */
class PythonServiceClient {
  constructor(baseURL = PYTHON_SERVICE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 60000, // 60 segundos
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
      console.log('URL do Serviço Python:', this.client.defaults.baseURL);
      const response = await this.client.get('/health');
      console.log('Health Check Resultado:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro no Health Check:', {
        message: error.message,
        url: this.client.defaults.baseURL,
        config: error.config
      });
      return null;
    }
  }

  /**
   * Envia PDF para análise
   * @param {string} filePath - Caminho do arquivo PDF
   * @returns {Promise<Object>} - Resultado da análise
   */
  async analyzePDF(filePath) {
    try {
      console.log(`🚀 Enviando PDF para análise: ${filePath}`);

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