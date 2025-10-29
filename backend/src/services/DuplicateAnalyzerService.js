class DuplicateAnalyzerService {

  constructor(notes = []) {
    this.notes = notes;
    this.exactDuplicates = [];
    this.possibleDuplicates = [];
    this.uniqueNotes = [];
    this.analysisReport = null;
  }

  /**
   * @param {Array}
   * @returns {Array}
   */

  identifyExactDuplicates(notesInput = null) {
    try {
      const notes = notesInput || this.notes;

      if (!notes || !Array.isArray(notes) || notes.length === 0) {
        console.warn("⚠️ Nenhuma nota válida fornecida para análise de duplicatas");
        return [];
      }

      console.log('🔍 Passo 3: Identificando duplicatas exatas');
      console.log(`📊 Analisando ${notes.length} notas`);

      // Agrupar por chave exata
      const exactDuplicatesMap = this._groupByExactKey(notes);
      this.exactDuplicates = this._extractDuplicates(exactDuplicatesMap, "DUPLICATA_EXATA");

      console.log(`✅ ${this.exactDuplicates.length} duplicatas exatas encontradas`);

      // Debug: verificar a primeira duplicata se existir
      if (this.exactDuplicates.length > 0) {
        const primeiraDup = this.exactDuplicates[0];
        console.log(`📋 Primeira duplicata:`, {
          fornecedor: primeiraDup.fornecedor,
          data: primeiraDup.data,
          valor: primeiraDup.valorContabil,
          ocorrencias: primeiraDup.ocorrencias
        });

        console.log(`📋 Primeiras 3 duplicatas exatas:`);
        this.exactDuplicates.slice(0, 3).forEach((dup, i) => {
          console.log(
            `   ${i + 1}. ${dup.fornecedor} | ${dup.data} | R$ ${dup.valorContabil} (${dup.ocorrencias}x)`
          );
        });
      } else {
        console.log('✅ Nenhuma duplicata exata encontrada');
      }

      return this.exactDuplicates;

    } catch (error) {
      console.error("❌ Erro ao identificar duplicatas exatas:", error);
      throw error;
    }
  }

  /**
     * Agrupar notas por chave exata
     * Chave: codigoFornecedor + data + notaSerie + valorContabil
     * 
     * @param {Array} notes - Notas para agrupar
     * @returns {Object} Mapa com chaves e grupos de notas
     */
  _groupByExactKey(notes) {
    console.log('Agrupando por chave exata');
    const map = {};

    for (const note of notes) {

      const chave = this._createExactKey(note);

      if (!map[chave]) {
        map[chave] = [];
      }
      map[chave].push(note);
    }

    console.log(`Chaves unicas encontradas ${Object.keys(map).length}`);

    return map;
  }

  /**
   * Criar chave exata para uma nota
   * Chave: "CÓDIGO|DATA|NOTA|VALOR"
   * 
   * @param {Object} note - Nota
   * @returns {string} Chave única
   */
  _createExactKey(note) {
    return `${note.codigoFornecedor}|${note.data}|${note.notaSerie}|${note.valorContabil}`;
  }

  _extractDuplicates(map, tipo) {
    console.log(`📤 Extraindo ${tipo}...`);

    const duplicatas = [];
    const processados = new Set();

    for (const [chave, notas] of Object.entries(map)) {
      // Apenas grupos com 2+ notas
      if (notas.length >= 2) {
        // Evitar registrar a mesma duplicata 2x
        if (processados.has(chave)) continue;
        processados.add(chave);

        // VERIFICAR se a primeira nota tem dados válidos
        const primeiraNota = notas[0];
        if (!primeiraNota) continue;

        const duplicata = {
          // Dados da primeira ocorrência - COM VALIDAÇÃO
          codigoFornecedor: primeiraNota.codigoFornecedor || "N/A",
          fornecedor: primeiraNota.fornecedor || "Fornecedor não identificado",
          cnpj: primeiraNota.cnpj || "N/A",
          data: primeiraNota.data || "01/01/2023",
          notaSerie: primeiraNota.notaSerie || "N/A",
          valorContabil: primeiraNota.valorContabil || "0,00",

          // Informações de duplicação
          tipo: tipo,
          ocorrencias: notas.length,
          chave: chave,
          motivo: "Mesmo código, data, nota e valor",

          // Detalhes de cada ocorrência
          detalhes: notas.map((nota, idx) => ({
            posicao: nota.posicaoOriginal || idx,
            data: nota.data || "01/01/2023",
            fornecedor: nota.fornecedor || "Fornecedor não identificado",
            cnpj: nota.cnpj || "N/A",
            notaSerie: nota.notaSerie || "N/A",
            valorContabil: nota.valorContabil || "0,00",
            indice: idx + 1,
          })),

          // Análise
          diferencaDias: this._calculateDaysDifference(notas),
        };

        duplicatas.push(duplicata);
      }
    }

    return duplicatas;
  }

  /**
    * Calcular diferença de dias entre duplicatas
    * Ajuda a identificar quando foram inseridas
    * 
    * @param {Array} notas - Array de notas duplicadas
    * @returns {number} Dias de diferença
    */

  _calculateDaysDifference(notas) {
    if (!notas || notas.length < 2) return 0;

    try {
      // Pega a primeira e a última nota - COM VERIFICAÇÃO
      const primeiraNota = notas[0];
      const ultimaNota = notas[notas.length - 1];

      if (!primeiraNota || !ultimaNota) return 0;

      const primeiraData = primeiraNota.data;
      const ultimaData = ultimaNota.data;

      // Verificar se as datas existem e são válidas
      if (!primeiraData || !ultimaData) return 0;

      console.log(`📅 Calculando diferença entre: ${primeiraData} e ${ultimaData}`);

      const primeira = new Date(primeiraData.split("/").reverse().join("-"));
      const ultima = new Date(ultimaData.split("/").reverse().join("-"));

      // Verificar se as datas são válidas
      if (isNaN(primeira.getTime()) || isNaN(ultima.getTime())) {
        console.log('❌ Datas inválidas para cálculo de diferença');
        return 0;
      }

      const diffTime = Math.abs(ultima - primeira);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log(`⏱️ Diferença de dias: ${diffDays}`);

      return diffDays;
    } catch (error) {
      console.log('❌ Erro ao calcular diferença de dias:', error);
      return 0;
    }
  }

  /**
   * Identificar notas únicas
   * Notas que NÃO aparecem em nenhuma duplicata
   * 
   * @param {Array} notes - Todas as notas
   * @returns {Array} Notas únicas
   */
  identifyUniqueNotes(notesInput = null) {
    try {
      console.log(`\n📌 Identificando notas únicas...`);

      const notes = notesInput || this.notes;

      // CORREÇÃO CRÍTICA: Verificar se notes é um array
      if (!Array.isArray(notes)) {
        console.error('❌ ERRO: notes não é um array:', typeof notes, notes);
        this.uniqueNotes = [];
        return [];
      }

      const todasAsDuplicatas = [
        ...this.exactDuplicates,
        ...this.possibleDuplicates,
      ];

      // Criar set de chaves duplicadas
      const chavesDuplicadas = new Set(
        todasAsDuplicatas.flatMap(dup =>
          dup.detalhes ? dup.detalhes.map(d => this._createExactKey(d)) : []
        )
      );

      // Filtrar notas que NÃO estão em duplicatas
      this.uniqueNotes = notes.filter((nota) => {
        const chave = this._createExactKey(nota);
        return !chavesDuplicadas.has(chave);
      });

      console.log(`✅ ${this.uniqueNotes.length} notas únicas identificadas`);

      return this.uniqueNotes;

    } catch (error) {
      console.error("❌ Erro ao identificar notas únicas:", error.message);
      this.uniqueNotes = [];
      return [];
    }
  }

  /**
   * Gerar relatório de análise completo
   * Resumo estatístico de duplicatas
   * 
   * @returns {Object} Relatório com estatísticas
   */
  generateAnalysisReport() {
    try {
      console.log(`\n📊 Gerando relatório de análise...`);

      // Calcular estatísticas
      const totalNotas = this.notes.length;
      const totalDuplicatas = this.exactDuplicates.length;
      const totalPossíveis = this.possibleDuplicates.length;
      const totalÚnicas = this.uniqueNotes.length;

      // Calcular valor total duplicado
      const valorTotalDuplicado = this.exactDuplicates.reduce((sum, dup) => {
        const valor = parseFloat(dup.valorContabil.replace(",", "."));
        return sum + valor * (dup.ocorrencias - 1); // -1 porque 1 é o original
      }, 0);

      // Fornecedores com duplicatas
      const fornecedoresComDuplicatas = new Set(
        this.exactDuplicates.map((dup) => dup.fornecedor)
      ).size;

      // Fornecedores totais
      const fornecedoresTotais = new Set(this.notes.map((n) => n.fornecedor)).size;

      this.analysisReport = {
        data_analise: new Date().toLocaleString("pt-BR"),
        total_notas: totalNotas,
        notas_validas: totalNotas,
        duplicatas_exatas: totalDuplicatas,
        duplicatas_possiveis: totalPossíveis,
        notas_unicas: totalÚnicas,
        fornecedores_unicos: fornecedoresTotais,
        fornecedores_com_duplicatas: fornecedoresComDuplicatas,
        valor_total_duplicado: valorTotalDuplicado.toFixed(2),
        percentual_duplicatas: ((totalDuplicatas / totalNotas) * 100).toFixed(2),
        ocorrencias_total: this.exactDuplicates.reduce(
          (sum, dup) => sum + (dup.ocorrencias - 1),
          0
        ),
      };

      console.log(`✅ Relatório gerado com sucesso`);

      return this.analysisReport;

    } catch (error) {
      console.error("❌ Erro ao gerar relatório:", error.message);
      throw error;
    }
  }

  /**
  * SETTER para possíveis duplicatas (usado pelo AnalysisService)
  */
  setPossibleDuplicates(possibleDuplicates) {
    this.possibleDuplicates = possibleDuplicates;
  }

  /**
   * Exibir resumo formatado
   * Para console ou logs
   */
  printSummary() {
    if (!this.analysisReport) {
      this.generateAnalysisReport();
    }

    const report = this.analysisReport;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`📊 RELATÓRIO DE ANÁLISE DE DUPLICATAS`);
    console.log(`${"═".repeat(60)}`);
    console.log(`Data: ${report.data_analise}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`TOTALIZAÇÕES:`);
    console.log(`  • Total de notas: ${report.total_notas}`);
    console.log(`  • Duplicatas exatas: ${report.duplicatas_exatas} (${report.percentual_duplicatas}%)`);
    console.log(`  • Duplicatas possíveis: ${report.duplicatas_possiveis}`);
    console.log(`  • Notas únicas: ${report.notas_unicas}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`FORNECEDORES:`);
    console.log(`  • Total: ${report.fornecedores_unicos}`);
    console.log(`  • Com duplicatas: ${report.fornecedores_com_duplicatas}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`VALORES:`);
    console.log(`  • Valor total duplicado: R$ ${report.valor_total_duplicado}`);
    console.log(`  • Ocorrências extras: ${report.ocorrencias_total}`);
    console.log(`${"═".repeat(60)}\n`);
  }

  /**
   * Getters para acessar dados
   */
  getExactDuplicates() {
    return this.exactDuplicates;
  }

  getUniquNotes() {
    return this.uniqueNotes;
  }

  getAnalysisReport() {
    return this.analysisReport;
  }

  getTotalExactDuplicates() {
    return this.exactDuplicates.length;
  }

  getTotalUniqueNotes() {
    return this.uniqueNotes.length;
  }

  /**
   * GETTER para possíveis duplicatas
   */
  getPossibleDuplicates() {
    return this.possibleDuplicates;
  }

}

export default DuplicateAnalyzerService;