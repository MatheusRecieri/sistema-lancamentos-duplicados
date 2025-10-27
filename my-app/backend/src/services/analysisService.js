export function analyzeDuplicates(data) {
    console.log('🔍 Iniciando análise de duplicatas...');

    const duplicates = [];
    const possibleDuplicates = [];
    const uniqueEntries = [];

    // Filtra apenas itens válidos para análise
    const itensValidos = data.filter(item =>
        item &&
        item.valorContabil &&
        item.valorContabil !== '0,00' &&
        item.fornecedor
    );

    console.log(`📊 Itens válidos para análise: ${itensValidos.length}`);

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

    // Implementação da lógica do seu chefe
    const chaveCount = {};
    const notaFornecedorValor = {};

    // Agrupa por chave (fornecedor + valor)
    for (const entry of itensValidos) {
        const chave = `${normalizarTexto(entry.fornecedor)}|${entry.valorContabil}`;

        if (!chaveCount[chave]) {
            chaveCount[chave] = [];
        }
        chaveCount[chave].push(entry);
    }

    // Analisa duplicatas reais
    for (const [chave, entries] of Object.entries(chaveCount)) {
        if (entries.length > 1) {
            // Verifica se são duplicatas verdadeiras (mesmo fornecedor, valor E nota)
            const notasRepetidas = {};
            let temDuplicataReal = false;

            for (const entry of entries) {
                const notaChave = `${normalizarTexto(entry.fornecedor)}|${entry.valorContabil}|${entry.notaSerie || ''}`;
                if (!notasRepetidas[notaChave]) {
                    notasRepetidas[notaChave] = [];
                }
                notasRepetidas[notaChave].push(entry);

                if (notasRepetidas[notaChave].length > 1) {
                    temDuplicataReal = true;
                }
            }

            if (temDuplicataReal) {
                // Adiciona apenas as duplicatas reais (mesmo fornecedor + valor + nota)
                for (const [notaChave, notaEntries] of Object.entries(notasRepetidas)) {
                    if (notaEntries.length > 1) {
                        duplicates.push({
                            ...notaEntries[0],
                            ocorrencias: notaEntries.length,
                            detalhes: notaEntries,
                            tipo: 'DUPLICATA_REAL',
                            chaveDuplicata: notaChave,
                            motivo: 'Mesmo fornecedor, valor e número de nota'
                        });
                    }
                }
            } else {
                // Marca como possível duplicata (mesmo fornecedor + valor, mas notas diferentes)
                possibleDuplicates.push({
                    ...entries[0],
                    ocorrencias: entries.length,
                    detalhes: entries,
                    tipo: 'POSSIVEL_DUPLICATA',
                    chaveDuplicata: chave,
                    motivo: 'Mesmo fornecedor e valor, mas notas diferentes'
                });
            }
        }
    }

    // Ordena: duplicatas reais primeiro
    duplicates.sort((a, b) => {
        if (a.tipo === 'DUPLICATA_REAL' && b.tipo === 'POSSIVEL_DUPLICATA') return -1;
        if (a.tipo === 'POSSIVEL_DUPLICATA' && b.tipo === 'DUPLICATA_REAL') return 1;
        return 0;
    });

    // Identifica notas únicas
    const todasDuplicatas = [...duplicates, ...possibleDuplicates];
    const chavesDuplicatas = new Set(todasDuplicatas.map(dup => dup.chaveDuplicata));

    itensValidos.forEach(item => {
        const chave = `${normalizarTexto(item.fornecedor)}|${item.valorContabil}`;
        const notaChave = `${normalizarTexto(item.fornecedor)}|${item.valorContabil}|${item.notaSerie || ''}`;

        const ehDuplicata = chavesDuplicatas.has(notaChave) || chavesDuplicatas.has(chave);

        if (!ehDuplicata) {
            uniqueEntries.push(item);
        }
    });

    console.log('✅ Análise concluída:');
    console.log(`   - Duplicatas Reais: ${duplicates.length}`);
    console.log(`   - Possíveis Duplicatas: ${possibleDuplicates.length}`);
    console.log(`   - Notas Únicas: ${uniqueEntries.length}`);

    // Formata para o formato esperado pelo frontend
    const duplicatasFormatadas = duplicates.map((dup, index) => ({
        id: index + 1,
        codigoFornecedor: dup.codigoFornecedor,
        fornecedor: dup.fornecedor,
        data: dup.data,
        notaSerie: dup.notaSerie,
        valorContabil: dup.valorContabil,
        valor: dup.valorContabil,
        tipo: dup.tipo,
        motivo: dup.motivo,
        ocorrencias: dup.ocorrencias,
        chaveDuplicata: dup.chaveDuplicata,
        detalhes: dup.detalhes.map(det => ({
            codigoFornecedor: det.codigoFornecedor,
            fornecedor: det.fornecedor,
            data: det.data,
            notaSerie: det.notaSerie,
            valorContabil: det.valorContabil
        }))
    }));

    const possiveisFormatadas = possibleDuplicates.map((dup, index) => ({
        id: index + 1,
        codigoFornecedor: dup.codigoFornecedor,
        fornecedor: dup.fornecedor,
        data: dup.data,
        notaSerie: dup.notaSerie,
        valorContabil: dup.valorContabil,
        valor: dup.valorContabil,
        tipo: dup.tipo,
        motivo: dup.motivo,
        ocorrencias: dup.ocorrencias,
        chaveDuplicata: dup.chaveDuplicata,
        detalhes: dup.detalhes.map(det => ({
            codigoFornecedor: det.codigoFornecedor,
            fornecedor: det.fornecedor,
            data: det.data,
            notaSerie: det.notaSerie,
            valorContabil: det.valorContabil
        }))
    }));

    return {
        summary: {
            totalItensProcessados: data.length,
            itensValidos: itensValidos.length,
            duplicatasExatas: duplicates.length,
            possiveisDuplicatas: possibleDuplicates.length,
            notasUnicas: uniqueEntries.length
        },
        duplicatas: duplicatasFormatadas,
        possiveisDuplicatas: possiveisFormatadas,
        notasUnicas: uniqueEntries
    };
}

function normalizarTexto(texto) {
    if (!texto) return '';

    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .toLowerCase()
        .replace(/\b(ltda|sa|me|eireli|cnpj|cpf|comercial|distribuidora)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
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
            nota: item.notaSerie
        }))
    };
}