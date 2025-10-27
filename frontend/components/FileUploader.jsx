import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { fileService } from '../services/api';

// Componente De upload de arquivos
//useRef: acessa elementos DOM diretamente
//useState: gerenca oe stado do componente
// Event handlers: função que lidam com eventos

function FileUploader({ onUpload }) {
  //cria uma refencia para o input de arquivo
  const fileInputRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  //manipulador de arquivo

  const handleFileChange = async event => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      console.log('Enviando para App');
      processFiles(files);
    }
  };

  //manipulador de clique no botão
  // const handleButtonClick = () => {
  //   fileInputRef.current?.click();
  // };

  //manipulador de drag and drop
  // const handleDragOver = event => {
  //   event.preventDefault();
  //   setIsDragOver(true);
  // };

  // const handleDragLeave = () => {
  //   setIsDragOver(false);
  // };

  const handleDrop = event => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = async files => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      console.log('Enviando arquivo para análise', file.name);

      const response = await fileService.uploadFile(file);
      console.log('Resposta do backend:', response);

      onUpload(files, response);
    } catch (error) {
      console.error(`Erro ao processar o arquivo ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      id="upload"
      className="max-w-3xl mx-auto text-center my-10"
      onDragOver={e => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        className={`p-10 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/40 shadow-lg'
            : 'border-[#f28c28] bg-white/10 hover:bg-white/20'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-[#f28c28] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white/90 text-lg font-medium">
              Processando arquivo...
            </p>
          </div>
        ) : (
          <>
            <svg
              className={`w-16 h-16 mx-auto ${
                isDragOver ? 'text-blue-500' : 'text-[#f28c28]'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-white/90 mt-4 mb-6 text-lg font-medium">
              Arraste arquivos aqui ou
            </p>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="bg-[#f28c28] hover:bg-[#f39b41] text-white font-semibold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 focus:ring-2 focus:ring-[#f28c28] shadow-lg"
            >
              Selecionar Arquivos
            </button>
            <p className="text-sm text-white/70 mt-4">
              Formatos suportados: PDF, DOCX, XLS, XLSX, TXT, CSV
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xls,.xlsx,.txt,.csv"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      </div>
    </section>
  );
}

FileUploader.propTypes = {
  onUpload: PropTypes.func.isRequired,
};

export default FileUploader;
