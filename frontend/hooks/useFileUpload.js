import { useState } from 'react';
import { fileService } from 'frontend/services/api';

//hook para upload de aruivos
export const useFileUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const uploadFile = async file => {
    setLoading(true);
    setError(null);

    try {
      console.log('Enviando arquivo:', file.name);
      const data = await fileService.uploadFile(file);
      setResult(data);
      return data;
    } catch (err) {
      console.error('Erro no upload:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async processId => {
    try {
      console.log(`Solicitando download para: ${processId}`);
      await fileService.downloadExcel(processId);
      return true;
    } catch (err) {
      console.error('Erro no download:', err);

      // Mensagem mais amigável para o usuário
      if (err.message.includes('popup') || err.message.includes('bloqueou')) {
        alert(
          'O navegador bloqueou a janela de download. Por favor, permita popups para este site e tente novamente.'
        );
      } else {
        alert(`Não foi possível baixar o arquivo: ${err.message}`);
      }

      throw err;
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setResult(null);
  };

  return {
    uploadFile,
    downloadExcel,
    loading,
    error,
    result,
    reset,
  };
};
