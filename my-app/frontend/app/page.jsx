// Bibliotecas

'use client';
import { useState, useEffect } from 'react';
//componentes
import Header from '../components/layout/Header';
import FileUploader from '../components/FileUploader';
import UploadedFiles from '../components/UploadedFiles';
import Body from '../components/layout/Body';
// import { toFormData } from 'axios';

/**
 * COMPONENTE PRINCIPAL DA APLICAÇÃO
 *
 * O que é um componente?
 * - É uma função JavaScript que retorna JSX (HTML + JavaScript)
 * - Começa com letra MAIÚSCULA
 * - Pode receber "props" (propriedades)
 * - É reutilizável
 */
function Home() {
  // Estado da aplicação - dados que podem mudar
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  // const [loading, setLoading] = useState(false);

  const handleFileUpload = async (files, backendResponse = null) => {
    console.log('Arquivos recebidos:', files);
    setUploadedFiles(files);

    if (backendResponse) {
      setAnalysis(backendResponse);
    } else {
      console.log('Backend não respondeu');
    }
  };

  // console.log(uploadedFiles, setUploadedFiles, setAnalysis);
  useEffect(() => {
    console.log('Novo estado de analysis:', analysis);
  }, [analysis]);
  /**
   * JSX - JavaScript XML
   * - Parece HTML, mas é JavaScript
   * - Usa className em vez de class
   * - Pode inserir JavaScript com { }
   */
  return (
    <main className="py-10 px-4 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6 md:p-8">
        <Header title="Sistema de Verificação de Duplicatas" />
        <FileUploader onUpload={handleFileUpload} />
        <UploadedFiles files={uploadedFiles} />
        <Body analysis={analysis} />
      </div>
    </main>
  );
}

// Exportação padrão - permite usar em outros arquivos
export default Home;
