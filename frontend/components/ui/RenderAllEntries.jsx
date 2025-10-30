import React from "react";

import { useFileUpload } from "frontend/hooks/useFileUpload";

const RenderAllEntries = ({ analysis }) => {
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
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.status === 'Duplicata'
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

export default RenderAllEntries;