import { readFileContent } from "../services/fileReaderService.js";
import { analyzeDuplicates, formatarResultadosParaExportacao } from "../services/analysisService.js";
import { exportToExcel } from "../services/exportExcelService.js";
import path from "path";

const analysisStorage = new Map();

export const uploadAndAnalyze = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    console.log('Arquivo recebido:', req.file);

    // Processa o arquivo
    const structuredData = await readFileContent(req.file.path, req.file.mimetype);

    // Análise real
    const analysisResult = analyzeDuplicates(structuredData);

    const processId = Date.now().toString();

    const formattedResult = {
      success: true,
      processId: processId,
      filename: req.file.originalname,
      totalEntries: analysisResult.summary.totalItensProcessados,
      validEntries: analysisResult.summary.itensValidos,
      duplicates: analysisResult.duplicatas.map((dup, index) => ({
        id: index + 1,
        codigoFornecedor: dup.codigoFornecedor,
        fornecedor: dup.fornecedor,
        data: dup.data,
        notaSerie: dup.notaSerie,
        valorContabil: dup.valorContabil,
        valor: dup.valor,
        tipo: dup.tipo,
        motivo: dup.motivo,
        ocorrencias: dup.ocorrencias,
        chaveDuplicata: dup.chaveDuplicata,
        detalhes: dup.detalhes
      })),
      possibleDuplicates: analysisResult.possiveisDuplicatas.map((dup, index) => ({
        id: index + 1,
        codigoFornecedor: dup.codigoFornecedor,
        fornecedor: dup.fornecedor,
        data: dup.data,
        notaSerie: dup.notaSerie,
        valorContabil: dup.valorContabil,
        valor: dup.valor,
        tipo: dup.tipo,
        motivo: dup.motivo,
        ocorrencias: dup.ocorrencias,
        chaveDuplicata: dup.chaveDuplicata,
        detalhes: dup.detalhes
      })),
      allEntries: analysisResult.notasUnicas.map((item, index) => ({
        id: index + 1,
        codigoFornecedor: item.codigoFornecedor,
        fornecedor: item.fornecedor,
        data: item.data,
        notaSerie: item.notaSerie,
        valorContabil: item.valorContabil,
        valor: item.valor,
        status: 'Normal'
      })),
      summary: analysisResult.summary,
      // analiseDetalhada: formatarResultadosParaExportacao(analysisResult).analiseDetalhada,
      message: `Análise concluída: ${analysisResult.summary.duplicatasExatas} duplicatas reais e ${analysisResult.summary.possiveisDuplicatas} possíveis duplicatas encontradas`
    };

    // CORREÇÃO: Usar rawAnalysis em vez de ranAnalysis
    analysisStorage.set(processId, {
      ...formattedResult,
      rawAnalysis: analysisResult,
      exportData: formatarResultadosParaExportacao(analysisResult)
    });

    console.log('Análise concluída:', {
      totalItens: formattedResult.totalEntries,
      duplicatas: formattedResult.duplicates.length,
      possiveis: formattedResult.possibleDuplicates.length
    });

    // Envia resposta para o frontend
    res.json(formattedResult);

  } catch (error) {
    console.error('Erro no controller:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const exportToExcelController = async (req, res) => {
  try {
    const { processId } = req.params;

    // console.log(`📥 Download solicitado para processId: ${processId}`);

    if (!processId) {
      return res.status(400).json({
        success: false,
        error: 'ID do processo não fornecido'
      });
    }

    // Buscar análise do armazenamento
    const analysisData = analysisStorage.get(processId);

    if (!analysisData) {
      return res.status(404).json({
        success: false,
        error: 'Análise não encontrada. Faça upload do arquivo primeiro.'
      });
    }

    console.log('📊 Dados encontrados para exportação:', {
      filename: analysisData.filename,
      totalEntries: analysisData.totalEntries,
      // CORREÇÃO: Usar analysisData.duplicates que agora existe
      duplicates: analysisData.duplicates?.length,
      possiveis: analysisData.possibleDuplicates?.length
    });

    const exportData = {
      summary: {
        'Arquivo Processado': analysisData.filename,
        'Data da Análise': new Date().toLocaleString('pt-BR'),
        'Total de Itens Processados': analysisData.totalEntries,
        'Itens Válidos': analysisData.validEntries,
        // CORREÇÃO: Usar analysisData.duplicates que agora existe
        'Duplicatas Exatas Encontradas': analysisData.duplicates.length,
        'Possíveis Duplicatas': analysisData.possibleDuplicates.length
      },
      // CORREÇÃO: Usar analysisData.duplicates que agora existe
      duplicatas: analysisData.duplicates.map(dup => ({
        'Código Fornecedor': dup.codigoFornecedor,
        'Fornecedor': dup.fornecedor,
        'Data': dup.data,
        'Número da Nota': dup.notaSerie,
        'Valor Contábil': dup.valorContabil,
        'Valor': dup.valor,
        'Chave de Duplicata': dup.chaveDuplicata
      })),
      todasEntradas: analysisData.allEntries.map(item => ({
        'Código Fornecedor': item.codigoFornecedor,
        'Fornecedor': item.fornecedor,
        'Data': item.data,
        'Número da Nota': item.notaSerie,
        'Valor Contábil': item.valorContabil,
        'Valor': item.valor,
        'Status': item.status
      })),
      possiveisDuplicatas: analysisData.possibleDuplicates.map(dup => ({
        'Código Fornecedor': dup.codigoFornecedor,
        'Fornecedor': dup.fornecedor,
        'Data': dup.data,
        'Número da Nota': dup.notaSerie,
        'Valor Contábil': dup.valorContabil,
        'Valor': dup.valor,
        'Chave Similar': dup.chaveDuplicata,
        'Dias de Diferença': dup.diferencaDias,
        'Nota Similar': dup.notaSimilar,
        'Data Similar': dup.dataSimilar
      }))
    };

    // Usar a função exportToExcel DO SERVICE
    const excelBuffer = await exportToExcel(exportData);

    console.log(`✅ Excel gerado: ${excelBuffer.length} bytes`);

    // Headers para download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="analise-duplicatas-${processId}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // CORS headers para garantir acesso
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    console.log(`📤 Enviando Excel para download...`);

    // Enviar arquivo
    res.send(excelBuffer);

  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const cleanupStorage = async (req, res) => {
  try {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [processId, data] of analysisStorage.entries()) {
      const processTime = parseInt(processId);
      if (now - processTime > twentyFourHours) {
        analysisStorage.delete(processId);
        cleanedCount++;
      }
    }

    res.json({
      success: true,
      message: `Limpeza concluída: ${cleanedCount} análises antigas removidas`,
      remaining: analysisStorage.size
    });
  } catch (error) {
    console.error('Erro na limpeza:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};