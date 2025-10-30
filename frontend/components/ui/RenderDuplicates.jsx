import React from "react";

const RenderDuplicatesTable = ({ duplicates, title, type = 'exact' }) => {
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
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${dup.ocorrencias > 2
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}
                    >
                      {dup.ocorrencias}x
                    </span>
                  </td>
                  <td className="p-4 text-white/90">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${dup.tipo === 'DUPLICATA_REAL'
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

export default RenderDuplicatesTable;