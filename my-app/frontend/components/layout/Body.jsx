import React from 'react';
// import { fileService } from '../../services/api';
import { useFileUpload } from 'frontend/hooks/useFileUpload';

const Body = ({ analysis }) => {
  const { downloadExcel } = useFileUpload();

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <p className="text-white/70 text-lg">
          Faça upload de um arquivo para analisar lançamentos duplicados
        </p>
      </div>
    );
  }

  const handleDownload = async () => {
    if (!analysis.processId) {
      alert('ID do processo não disponível para download');
      return;
    }

    console.log('🎯 Iniciando download para processId:', analysis.processId);

    try {
      await downloadExcel(analysis.processId);
      console.log('✅ Download iniciado com sucesso');
    } catch (error) {
      console.error('❌ Erro no download:', error);
      alert('Erro ao baixar relatório: ' + error.message);

      // ✅ LINK ALTERNATIVO DIRETO
      const downloadUrl = `http://localhost:4000/api/files/export/excel/${analysis.processId}`;
      console.log('🔗 URL de download direto:', downloadUrl);

      // Tentar abrir em nova janela
      window.open(downloadUrl, '_blank');
    }
  };

  const renderDuplicatesTable = (duplicates, title, type = 'exact') => {
    if (!duplicates || duplicates.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <span
            className={`w-2 h-6 ${type === 'exact' ? 'bg-red-500' : 'bg-yellow-500'} rounded-full mr-3`}
          ></span>
          {title} ({duplicates.length})
        </h3>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/80 font-semibold">
                    ID
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Fornecedor
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Data
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Nota
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Valor
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Ocorrências
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Tipo
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map(dup => (
                  <tr
                    key={dup.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4 text-white/90">{dup.id}</td>
                    <td className="p-4 text-white/90">{dup.fornecedor}</td>
                    <td className="p-4 text-white/90">{dup.data}</td>
                    <td className="p-4 text-white/90">{dup.notaSerie}</td>
                    <td className="p-4 text-white/90 font-semibold">
                      R${' '}
                      {typeof dup.valorContabil === 'string'
                        ? dup.valorContabil
                        : '0,00'}
                    </td>
                    <td className="p-4 text-white/90">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          dup.ocorrencias > 2
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}
                      >
                        {dup.ocorrencias}x
                      </span>
                    </td>
                    <td className="p-4 text-white/90">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          dup.tipo === 'DUPLICATA_REAL'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}
                      >
                        {dup.tipo === 'DUPLICATA_REAL' ? 'Real' : 'Possível'}
                      </span>
                    </td>
                    <td className="p-4 text-white/90">{dup.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Função para renderizar todas as entradas
  const renderAllEntries = () => {
    if (!analysis.allEntries || analysis.allEntries.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
          Todas as Entradas ({analysis.allEntries.length})
        </h3>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/80 font-semibold">
                    ID
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Fornecedor
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Data
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Nota
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Valor
                  </th>
                  <th className="text-left p-4 text-white/80 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.allEntries.map(entry => (
                  <tr
                    key={entry.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4 text-white/90">{entry.id}</td>
                    <td className="p-4 text-white/90">{entry.fornecedor}</td>
                    <td className="p-4 text-white/90">{entry.data}</td>
                    <td className="p-4 text-white/90">{entry.notaSerie}</td>
                    <td className="p-4 text-white/90 font-semibold">
                      R${' '}
                      {typeof entry.valorContabil === 'string'
                        ? entry.valorContabil
                        : '0,00'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.status === 'Duplicata'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-green-500/20 text-green-300 border border-green-500/30'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8">
      {/* Resumo da Análise */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-6 text-center border border-blue-300/20">
          <h3 className="text-white text-sm font-semibold mb-2">
            TOTAL DE LANÇAMENTOS
          </h3>
          <p className="text-3xl font-bold text-white">
            {analysis.totalEntries || 0}
          </p>
        </div>

        <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-6 text-center border border-green-300/20">
          <h3 className="text-white text-sm font-semibold mb-2">
            ITENS VÁLIDOS
          </h3>
          <p className="text-3xl font-bold text-white">
            {analysis.validEntries || 0}
          </p>
        </div>

        <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-6 text-center border border-red-300/20">
          <h3 className="text-white text-sm font-semibold mb-2">
            DUPLICATAS CONFIRMADAS
          </h3>
          <p className="text-3xl font-bold text-white">
            {analysis.duplicates?.length || 0}
          </p>
        </div>

        <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-6 text-center border border-yellow-300/20">
          <h3 className="text-white text-sm font-semibold mb-2">
            POSSÍVEIS DUPLICATAS
          </h3>
          <p className="text-3xl font-bold text-white">
            {analysis.possibleDuplicates?.length || 0}
          </p>
        </div>
      </div>

      {/* Mensagem de sucesso */}
      {analysis.message && (
        <div className="mb-6 p-4 bg-blue-500/20 border border-blue-300/30 rounded-xl">
          <p className="text-white text-center font-semibold">
            {analysis.message}
          </p>
        </div>
      )}

      {/* Duplicatas Confirmadas */}
      {renderDuplicatesTable(
        analysis.duplicates,
        'Duplicatas Confirmadas',
        'exact'
      )}

      {/* Possíveis Duplicatas */}
      {renderDuplicatesTable(
        analysis.possibleDuplicates,
        'Possíveis Duplicatas',
        'possible'
      )}

      {/* Todas as Entradas */}
      {renderAllEntries()}

      {/* Botão de Download */}
      {analysis.processId && (
        <div className="text-center mt-8">
          <button
            onClick={handleDownload}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 focus:ring-2 focus:ring-green-500 shadow-lg flex items-center mx-auto"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Baixar Relatório em Excel
          </button>
        </div>
      )}

      {/* Nenhuma duplicata encontrada */}
      {!analysis.duplicates?.length && !analysis.possibleDuplicates?.length && (
        <div className="text-center py-8">
          <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-6 border border-green-300/20">
            <svg
              className="w-12 h-12 text-green-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-xl font-bold text-white mb-2">
              Nenhuma Duplicata Encontrada
            </h3>
            <p className="text-white/70">
              Não foram detectados lançamentos duplicados no arquivo analisado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Body;
