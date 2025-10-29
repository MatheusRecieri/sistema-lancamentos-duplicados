class SimilarityAnalyzerService {
  constructor() {
    this.similarityThreshold = 0.85; //85% de similariedade
  }

  /**
   * Identifica possíveis duplicatas baseado em critérios flexíveis
   */
  findPossibleDuplicates(notes) {
    console.log('PASSO 4: Identificando possíveis duplicatas...');
    console.log(`Analisando ${notes.length} notas`);
    const possibleDuplicates = [];
    const processedKeys = new Set();

    notes.forEach((currentNote, index) => {
      // Pular notas já processadas
      const currentKey = this._generateNoteKey(currentNote);
      if (processedKeys.has(currentKey)) return;

      // Encontrar notas similares
      const similarNotes = this._findSimilarNotes(currentNote, notes, index);

      if (similarNotes.length > 0) {
        const similarityGroup = {
          masterNote: currentNote,
          similarNotes: similarNotes,
          similarityScore: this._calculateSimilarityScore(currentNote, similarNotes),
          reason: this._getSimilarityReason(currentNote, similarNotes),
          totalNotes: similarNotes.length + 1,
          totalValue: this._calculateTotalValue(currentNote, similarNotes)
        };

        possibleDuplicates.push(similarityGroup);

        // Marcar todas as notas do grupo como processadas
        similarNotes.forEach(note => {
          processedKeys.add(this._generateNoteKey(note));
        });
      }

      processedKeys.add(currentKey);
    });

    console.log(`${possibleDuplicates.length} grupos de possíveis duplicatas identificados`);
    return possibleDuplicates;
  }

  /**
   * Encontra notas similares baseado em critérios de negócio
   */
  _findSimilarNotes(masterNote, allNotes, startIndex) {
    return allNotes.slice(startIndex + 1).filter(note => {
      // Critério 1: Mesmo fornecedor + valor igual
      const sameSupplierAndValue =
        note.codigoFornecedor === masterNote.codigoFornecedor &&
        this._normalizeValue(note.valorContabil) === this._normalizeValue(masterNote.valorContabil);

      // Critério 2: Mesmo fornecedor + valor similar (±5%)
      const sameSupplierAndSimilarValue =
        note.codigoFornecedor === masterNote.codigoFornecedor &&
        this._isValueSimilar(
          this._normalizeValue(note.valorContabil),
          this._normalizeValue(masterNote.valorContabil),
          0.05
        );

      // E pelo menos um campo diferente (data ou número da nota)
      const hasDifferences =
        note.data !== masterNote.data ||
        note.notaSerie !== masterNote.notaSerie;

      return (sameSupplierAndValue || sameSupplierAndSimilarValue) && hasDifferences;
    });
  }

  /**
     * Normalizar valor para comparação
     */
  _normalizeValue(value) {
    if (typeof value === 'string') {
      return parseFloat(value.replace(/\./g, '').replace(',', '.'));
    }
    return value;
  }


  /**
   * Verifica se valores são similares dentro de uma tolerância
   */
  _isValueSimilar(value1, value2, tolerance = 0.05) {
    const num1 = this._normalizeValue(value1);
    const num2 = this._normalizeValue(value2);

    if (num1 === 0 && num2 === 0) return true;
    if (num1 === 0 || num2 === 0) return false;

    const diff = Math.abs(num1 - num2);
    const avg = (num1 + num2) / 2;
    return (diff / avg) <= tolerance;
  }

  /**
   * Calcula score de similaridade (0-1)
   */
  _calculateSimilarityScore(masterNote, similarNotes) {
    if (similarNotes.length === 0) return 0;

    const scores = similarNotes.map(note => {
      let score = 0;

      // Fornecedor igual = +40%
      if (note.codigoFornecedor === masterNote.codigoFornecedor) score += 0.4;

      // Valor exato = +40%, similar = +20%
      const masterValue = this._normalizeValue(masterNote.valorContabil);
      const noteValue = this._normalizeValue(note.valorContabil);

      if (noteValue === masterValue) {
        score += 0.4;
      } else if (this._isValueSimilar(noteValue, masterValue)) {
        score += 0.2;
      }

      // Data próxima (±30 dias) = +20%
      if (this._areDatesClose(note.data, masterNote.data, 30)) {
        score += 0.2;
      }

      return Math.min(score, 1.0);
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Verifica se datas estão próximas
   */
  _areDatesClose(date1, date2, maxDaysDiff = 30) {
    try {
      const d1 = new Date(date1.split('/').reverse().join('-'));
      const d2 = new Date(date2.split('/').reverse().join('-'));
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= maxDaysDiff;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gera chave única para a nota
   */
  _generateNoteKey(note) {
    return `${note.codigoFornecedor}-${note.dataEmissao}-${note.numeroSerie}-${note.valorContabil}`;
  }

  /**
   * Retorna o motivo da similaridade
   */
  _getSimilarityReason(masterNote, similarNotes) {
    const reasons = [];
    const firstSimilar = similarNotes[0];

    if (masterNote.codigoFornecedor === firstSimilar.codigoFornecedor) {
      reasons.push('mesmo fornecedor');
    }

    if (masterNote.valorContabil === firstSimilar.valorContabil) {
      reasons.push('valor exato');
    } else if (this._isValueSimilar(masterNote.valorContabil, firstSimilar.valorContabil)) {
      reasons.push('valor similar');
    }

    if (masterNote.dataEmissao !== firstSimilar.dataEmissao) {
      reasons.push('datas diferentes');
    }

    if (masterNote.numeroSerie !== firstSimilar.numeroSerie) {
      reasons.push('números de nota diferentes');
    }

    return reasons.join(' + ');
  }

  /**
  * Calcula valor total do grupo
  */
  _calculateTotalValue(masterNote, similarNotes) {
    const masterValue = this._normalizeValue(masterNote.valorContabil);
    const similarValues = similarNotes.map(note =>
      this._normalizeValue(note.valorContabil)
    );

    const total = similarValues.reduce((sum, val) => sum + val, masterValue);
    return total.toFixed(2).replace('.', ',');
  }


  /**
   * Gera relatório estatístico
   */
  generateSimilarityReport(possibleDuplicates) {
    const totalGroups = possibleDuplicates.length;
    const totalNotes = possibleDuplicates.reduce((sum, group) =>
      sum + 1 + group.similarNotes.length, 0
    );

    const scoreDistribution = {
      high: possibleDuplicates.filter(g => g.similarityScore >= 0.8).length,
      medium: possibleDuplicates.filter(g => g.similarityScore >= 0.6 && g.similarityScore < 0.8).length,
      low: possibleDuplicates.filter(g => g.similarityScore < 0.6).length
    };

    const totalValue = possibleDuplicates.reduce((sum, group) =>
      sum + this._normalizeValue(group.totalValue), 0
    );

    return {
      totalGroups,
      totalNotes,
      totalValue: totalValue.toFixed(2),
      scoreDistribution,
      possibleDuplicates: possibleDuplicates.map(group => ({
        fornecedor: group.masterNote.fornecedor,
        codigoFornecedor: group.masterNote.codigoFornecedor,
        dataPrincipal: group.masterNote.data,
        notaSeriePrincipal: group.masterNote.notaSerie,
        valorPrincipal: group.masterNote.valorContabil,
        similarNotesCount: group.similarNotes.length,
        similarityScore: group.similarityScore,
        reason: group.reason,
        totalValue: group.totalValue
      }))
    };
  }
}

export default SimilarityAnalyzerService;
