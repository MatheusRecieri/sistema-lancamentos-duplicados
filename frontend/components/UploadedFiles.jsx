import React from 'react';
import PropTypes from 'prop-types';

function UploadedFiles({ files }) {
  console.log(files);

  if (files.length === 0) {
    return (
      <div className="mt-6 text-center bg-white/10 backdrop-blur-md rounded-2xl p-6 text-white/80">
        <p className="text-lg">Nenhum arquivo enviado ainda</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-[#f28c28]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Arquivo(s) Carregado(s)
      </h3>
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
          >
            <div className="flex items-center">
              <svg
                className="w-4 h-4 text-[#f28c28] mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-white/90 font-medium">{file.name}</span>
            </div>
            <span className="text-white/60 text-sm">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

UploadedFiles.propTypes = {
  files: PropTypes.arrayOf(PropTypes.object),
};

export default UploadedFiles;
