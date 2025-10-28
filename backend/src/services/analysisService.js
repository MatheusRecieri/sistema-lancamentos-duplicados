export function analyzeDuplicates(data) {
  console.log('🔍 Iniciando análise de duplicatas...');

  // ETAPA 1: Validação básica
  const itensValidos = data.filter(item =>
    item &&
    item.valorContabil &&
    item.valorContabil !== '0,00' &&
    item.fornecedor &&
    item.data
  );

  console.log(`📊 Total de itens: ${data.length}`);
  console.log(`✅ Itens válidos: ${itensValidos.length}`);

  if (itensValidos.length === 0) {
    return {
      summary: {
        totalItensProcessados: data.length,
        itensValidos: 0,
        duplicatasExatas: 0,
        possiveisDuplicatas: 0,
        notasUnicas: 0
      },
      duplicatas: [],
      possiveisDuplicatas: [],
      notasUnicas: []
    };
  }

  // ETAPA 2: Criar índices para busca rápida
  const duplicatas = [];
  const possiveisDuplicatas = [];
  const processados = new Set(); // Para evitar duplicação de resultados

  // ETAPA 3: DUPLICATAS EXATAS
  // Mesma combinação: Código Fornecedor + Data + Nota + Valor Contábil
  const chaveExata = {};

  for (const entry of itensValidos) {
    const chave = `${String(entry.codigoFornecedor).trim()}|${entry.data}|${String(entry.notaSerie).trim()}|${entry.valorContabil}`;

    if (!chaveExata[chave]) {
      chaveExata[chave] = [];
    }
    chaveExata[chave].push(entry);
  }

  // Processa duplicatas exatas
  for (const [chave, entries] of Object.entries(chaveExata)) {
    if (entries.length > 1) {
      // Marca todos como processados
      entries.forEach(e => processados.add(criarChaveUnica(e)));

      const primeiraOcorrencia = entries[0];
      duplicatas.push({
        codigoFornecedor: primeiraOcorrencia.codigoFornecedor,
        fornecedor: primeiraOcorrencia.fornecedor,
        data: primeiraOcorrencia.data,
        notaSerie: primeiraOcorrencia.notaSerie,
        valorContabil: primeiraOcorrencia.valorContabil,
        valor: primeiraOcorrencia.valor,
        tipo: 'DUPLICATA_EXATA',
        motivo: 'Mesmo fornecedor, data, nota e valor',
        ocorrencias: entries.length,
        chaveDuplicata: chave,
        detalhes: entries.map((e, idx) => ({
          posicao: e.posicao || `Item ${idx + 1}`,
          codigoFornecedor: e.codigoFornecedor,
          fornecedor: e.fornecedor,
          data: e.data,
          notaSerie: e.notaSerie,
          valorContabil: e.valorContabil
        }))
      });
    }
  }

  // ETAPA 4: POSSÍVEIS DUPLICATAS
  // Mesma combinação: Fornecedor + Valor Contábil (ignora data e nota)
  const chaveSimilar = {};

  for (const entry of itensValidos) {
    // Só processa itens que ainda não foram marcados como duplicata exata
    const chaveUnica = criarChaveUnica(entry);
    if (processados.has(chaveUnica)) continue;

    // Normaliza apenas fornecedor e valor
    const fornecedorNorm = normalizarTexto(entry.fornecedor);
    const chave = `${fornecedorNorm}|${entry.valorContabil}`;

    if (!chaveSimilar[chave]) {
      chaveSimilar[chave] = [];
    }
    chaveSimilar[chave].push(entry);
  }

  // Processa possíveis duplicatas
  for (const [chave, entries] of Object.entries(chaveSimilar)) {
    if (entries.length > 1) {
      // Verifica se tem datas diferentes (para ser "possível")
      const datasUnicas = new Set(entries.map(e => e.data));
      const notasUnicas = new Set(entries.map(e => e.notaSerie));

      // Se tem data ou nota diferentes, é possível duplicata
      if (datasUnicas.size > 1 || notasUnicas.size > 1) {
        const primeiraOcorrencia = entries[0];

        possiveisDuplicatas.push({
          codigoFornecedor: primeiraOcorrencia.codigoFornecedor,
          fornecedor: primeiraOcorrencia.fornecedor,
          data: primeiraOcorrencia.data,
          notaSerie: primeiraOcorrencia.notaSerie,
          valorContabil: primeiraOcorrencia.valorContabil,
          valor: primeiraOcorrencia.valor,
          tipo: 'POSSIVEL_DUPLICATA',
          motivo: 'Mesmo fornecedor e valor, mas data/nota diferentes',
          ocorrencias: entries.length,
          chaveDuplicata: chave,
          detalhes: entries.map((e, idx) => ({
            posicao: e.posicao || `Item ${idx + 1}`,
            codigoFornecedor: e.codigoFornecedor,
            fornecedor: e.fornecedor,
            data: e.data,
            notaSerie: e.notaSerie,
            valorContabil: e.valorContabil,
            diferencaDias: calcularDiferencaDias(entries[0].data, e.data)
          }))
        });

        // Marca como processado
        entries.forEach(e => processados.add(criarChaveUnica(e)));
      }
    }
  }

  // ETAPA 5: Identifica notas únicas (não duplicadas)
  const notasUnicas = itensValidos.filter(item => {
    return !processados.has(criarChaveUnica(item));
  });

  console.log('✅ Análise concluída:');
  console.log(`   📋 Duplicatas Exatas: ${duplicatas.length}`);
  console.log(`   🤔 Possíveis Duplicatas: ${possiveisDuplicatas.length}`);
  console.log(`   ✔️  Notas Únicas: ${notasUnicas.length}`);

  return {
    summary: {
      totalItensProcessados: data.length,
      itensValidos: itensValidos.length,
      duplicatasExatas: duplicatas.length,
      possiveisDuplicatas: possiveisDuplicatas.length,
      notasUnicas: notasUnicas.length
    },
    duplicatas,
    possiveisDuplicatas,
    notasUnicas
  };
}

// ✅ NOVO: Cria chave única para rastreamento
function criarChaveUnica(entry) {
  return `${String(entry.codigoFornecedor).trim()}|${entry.data}|${String(entry.notaSerie).trim()}|${entry.valorContabil}`;
}

// ✅ MELHORADO: Normalização conservadora
function normalizarTexto(texto) {
  if (!texto) return '';

  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ✅ NOVO: Calcula diferença em dias entre datas
function calcularDiferencaDias(data1, data2) {
  try {
    const d1 = new Date(data1.split('/').reverse().join('-'));
    const d2 = new Date(data2.split('/').reverse().join('-'));
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return 0;
  }
}

// Função para análise detalhada
export function analiseDetalhadaDuplicatas(duplicatas) {
  const analise = {
    porFornecedor: {},
    porValor: {},
    porPeriodo: {},
    estatisticas: {
      totalDuplicatas: duplicatas.length,
      fornecedoresAfetados: new Set(),
      valorTotalDuplicatas: 0,
      periodoMaisComum: ''
    }
  };

  duplicatas.forEach(dup => {
    // Análise por fornecedor
    const fornecedor = dup.fornecedor || 'Não identificado';
    if (!analise.porFornecedor[fornecedor]) {
      analise.porFornecedor[fornecedor] = 0;
    }
    analise.porFornecedor[fornecedor]++;
    analise.estatisticas.fornecedoresAfetados.add(fornecedor);

    // Análise por valor
    const valor = dup.valorContabil;
    if (!analise.porValor[valor]) {
      analise.porValor[valor] = 0;
    }
    analise.porValor[valor]++;

    // Análise por período
    const mes = dup.data ? dup.data.substring(3, 10) : 'Data inválida';
    if (!analise.porPeriodo[mes]) {
      analise.porPeriodo[mes] = 0;
    }
    analise.porPeriodo[mes]++;

    // Soma valores
    const valorNumerico = parseFloat(dup.valorContabil.replace('.', '').replace(',', '.'));
    if (!isNaN(valorNumerico)) {
      analise.estatisticas.valorTotalDuplicatas += valorNumerico * (dup.ocorrencias || 1);
    }
  });

  // Encontra período mais comum
  let periodoMaisComum = '';
  let maxOcorrencias = 0;
  Object.entries(analise.porPeriodo).forEach(([periodo, count]) => {
    if (count > maxOcorrencias) {
      maxOcorrencias = count;
      periodoMaisComum = periodo;
    }
  });
  analise.estatisticas.periodoMaisComum = periodoMaisComum;
  analise.estatisticas.fornecedoresAfetados = analise.estatisticas.fornecedoresAfetados.size;

  return analise;
}

// Função para exportar resultados
export function formatarResultadosParaExportacao(resultadoAnalise) {
  const { duplicatas, possiveisDuplicatas, notasUnicas, summary } = resultadoAnalise;

  return {
    resumo: summary,
    duplicatasExatas: duplicatas.map(dup => ({
      codigo: dup.codigoFornecedor,
      fornecedor: dup.fornecedor,
      data: dup.data,
      nota: dup.notaSerie,
      valor: dup.valorContabil,
      tipo: dup.tipo,
      motivo: dup.motivo,
      ocorrencias: dup.ocorrencias,
      detalhes: dup.detalhes
    })),
    possiveisDuplicatas: possiveisDuplicatas.map(dup => ({
      codigo: dup.codigoFornecedor,
      fornecedor: dup.fornecedor,
      data: dup.data,
      nota: dup.notaSerie,
      valor: dup.valorContabil,
      tipo: dup.tipo,
      motivo: dup.motivo,
      ocorrencias: dup.ocorrencias,
      detalhes: dup.detalhes
    })),
    analiseDetalhada: analiseDetalhadaDuplicatas([...duplicatas, ...possiveisDuplicatas])
  };
}

// Função auxiliar para debug
export function debugAnalise(data) {
  return {
    total: data.length,
    amostra: data.slice(0, 5).map(item => ({
      codigo: item.codigoFornecedor,
      fornecedor: item.fornecedor?.substring(0, 20),
      data: item.data,
      valor: item.valorContabil,
      nota: item.notaSerie,
      posicao: item.posicao
    }))
  };
}