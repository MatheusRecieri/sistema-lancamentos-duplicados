import dotenv from "dotenv";

const API_BASE_URL = process.env.FRONTEND_URL;

export const fileService = {
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Erro no upload do arquivo');
    }

    return await response.json();
  },

  downloadExcel(processId) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 Iniciando download direto para: ${processId}`);

        // Criar link temporário
        const link = document.createElement('a');
        link.href = `${API_BASE_URL}/files/export/excel/${processId}`;
        link.target = '_blank'; // Abre em nova aba/guia
        link.download = `analise-duplicatas-${processId}.xlsx`;

        // Adicionar ao DOM (necessário para alguns navegadores)
        document.body.appendChild(link);

        // Disparar o clique
        link.click();

        // Remover do DOM após um tempo
        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
          console.log('✅ Download iniciado com sucesso');
          resolve(true);
        }, 100);
      } catch (error) {
        console.error('❌ Erro no download direto:', error);
        reject(error);
      }
    });
  },
};
