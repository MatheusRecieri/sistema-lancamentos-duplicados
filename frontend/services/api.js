const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const fileService = {
  /**
   * Upload de arquivo com progresso
   * @param {File} file - Arquivo a ser enviado
   * @param {Function} onProgress - Callback para progresso (opcional)
   * @returns {Promise<Object>} Resposta da análise
   */
  async uploadFile(file, onProgress = null) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // ✅ PROGRESSO DO UPLOAD
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress({
              stage: 'upload',
              percent: percentComplete,
              loaded: event.loaded,
              total: event.total,
            });
          }
        });
      }

      // ✅ SUCESSO
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log('✅ Upload concluído com sucesso');
            resolve(response);
          } catch (error) {
            reject(new Error('Erro ao processar resposta do servidor'));
          }
        } else {
          const errorText = xhr.responseText || 'Erro desconhecido';
          reject(new Error(`Erro ${xhr.status}: ${errorText}`));
        }
      });

      // ✅ ERRO
      xhr.addEventListener('error', () => {
        reject(new Error('Erro de conexão ao enviar arquivo'));
      });

      // ✅ TIMEOUT
      xhr.addEventListener('timeout', () => {
        reject(new Error('Timeout: o upload demorou muito tempo'));
      });

      // ✅ CANCELADO
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelado pelo usuário'));
      });

      // Configurar timeout (10 minutos)
      xhr.timeout = 600000;

      // Usar Fetch API como fallback
      console.log(`📤 Iniciando upload de ${file.name}...`);
      xhr.open('POST', `${API_BASE_URL}/files/upload`);
      xhr.send(formData);
    });
  },

  /**
   * Download de relatório em Excel
   * @param {string} processId - ID do processo de análise
   */
  downloadExcel(processId) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`📥 Iniciando download para processId: ${processId}`);

        const link = document.createElement('a');
        link.href = `${API_BASE_URL}/files/export/excel/${processId}`;
        link.target = '_blank';
        link.download = `analise-duplicatas-${processId}.xlsx`;

        document.body.appendChild(link);

        // Simular clique
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });

        link.dispatchEvent(clickEvent);

        // Limpar após sucesso
        setTimeout(() => {
          document.body.removeChild(link);
          console.log('✅ Download iniciado com sucesso');
          resolve(true);
        }, 100);
      } catch (error) {
        console.error('❌ Erro no download:', error);
        reject(error);
      }
    });
  },

  /**
   * Validar arquivo antes de enviar
   * @param {File} file - Arquivo para validar
   * @returns {Object} { valid: boolean, error: string }
   */
  validateFile(file) {
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (!file) {
      return { valid: false, error: 'Nenhum arquivo selecionado' };
    }

    if (file.size > MAX_SIZE) {
      return {
        valid: false,
        error: `Arquivo muito grande. Máximo: 200MB, Seu arquivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Tipo de arquivo não permitido. Use PDF, DOCX, XLS, XLSX, TXT ou CSV',
      };
    }

    return { valid: true, error: null };
  },

  /**
   * Formato de tamanho de arquivo para exibição
   * @param {number} bytes - Tamanho em bytes
   * @returns {string} Tamanho formatado
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Formato de tempo (segundos para HH:MM:SS)
   * @param {number} seconds - Tempo em segundos
   * @returns {string} Tempo formatado
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  },
};