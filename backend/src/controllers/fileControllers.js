import { pythonService } from "../services/pythonServiceClient.js";
import { exportToExcel } from "../services/exportExcelService.js";

const analysisStorage = new Map();

/**
 * Controller principal - usa serviço Python para PDFs
 */
export const uploadAndAnalyze = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    console.log('📄 Arquivo recebido:', req.file.originalname);
    console.log('📊 Tipo:', req.file.mimetype);

    const isPDF = req.file.mimetype.includes('pdf');
    const isXLSX = req.file.mimetype.includes('vnd.openxmlformats-officedocument.spreadsheetml.sheet'); //xlsx
    const isXLS = req.file.mimetype.includes('application/vnd.ms-excel');

    console.log("Pdf", isPDF);
    console.log("XLSX", isXLSX);
    console.log("XLS", isXLS);

    let analysisResult;

    // ✅ ROTA PYTHON: PDFs usam o microserviço Python
    if (isPDF || isXLS || isXLSX) {
      console.log('🐍 Usando serviço Python para análise...');

      // Verifica se serviço está online
      const health = await pythonService.healthCheck();
      if (!health) {
        throw new Error('Serviço Python está offline. Certifique-se que está rodando na porta 5000.');
      }

      // Envia para análise
      analysisResult = await pythonService.analyzeArchive(req.file.path);

      console.log('✅ Análise Python concluída');
    }
    // ✅ FALLBACK: Outros formatos usam Node.js
    else {
      console.log('📊 Usando análise Node.js (Excel/Word)...');

      // Importa dinamicamente apenas se necessário
      const { readFileContent } = await import("../services/fileReaderService.js");
      const { analyzeDuplicates } = await import("../services/analysisService.js");

      const structuredData = await readFileContent(req.file.path, req.file.mimetype);
      analysisResult = analyzeDuplicates(structuredData);
    }

    // console.log('🐍 Usando serviço Python para análise...');

    // // Verifica se serviço está online
    // const health = await pythonService.healthCheck();
    // if (!health) {
    //   throw new Error('Serviço Python está offline. Certifique-se que está rodando na porta 5000.');
    // }

    // // Envia para análise
    // analysisResult = await pythonService.analyzePDF(req.file.path);

    // console.log('✅ Análise Python concluída');

    // Gera ID do processo
    const processId = Date.now().toString();

    // Formata resposta padronizada
    const formattedResult = {
      success: true,
      processId: processId,
      filename: req.file.originalname,
      totalEntries: analysisResult.summary.totalItensProcessados,
      validEntries: analysisResult.summary.itensValidos,
      duplicates: (analysisResult.duplicatas || []).map((dup, index) => ({
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
      possibleDuplicates: (analysisResult.possiveisDuplicatas || []).map((dup, index) => ({
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
      allEntries: (analysisResult.notasUnicas || []).map((item, index) => ({
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
      message: `Análise concluída: ${analysisResult.summary.duplicatasExatas} duplicatas reais e ${analysisResult.summary.possiveisDuplicatas} possíveis duplicatas encontradas`
    };

    // Armazena para exportação
    analysisStorage.set(processId, {
      ...formattedResult,
      rawAnalysis: analysisResult
    });

    console.log('📊 Resumo da análise:');
    console.log(`   Total: ${formattedResult.totalEntries}`);
    console.log(`   Duplicatas: ${formattedResult.duplicates.length}`);
    console.log(`   Possíveis: ${formattedResult.possibleDuplicates.length}`);

    res.json(formattedResult);

  } catch (error) {
    console.error('❌ Erro no controller:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Endpoint de debug para testar extração
 */
export const debugAnalysis = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const isPDF = req.file.mimetype.includes('pdf');

    if (!isPDF) {
      return res.status(400).json({
        success: false,
        error: 'Debug disponível apenas para PDFs'
      });
    }

    // Usa endpoint de debug do Python
    const debugData = await pythonService.analyzePDFDebug(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      ...debugData
    });

  } catch (error) {
    console.error('❌ Erro no debug:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Exportação para Excel (mantém igual)
 */
export const exportToExcelController = async (req, res) => {
  try {
    const { processId } = req.params;

    if (!processId) {
      return res.status(400).json({
        success: false,
        error: 'ID do processo não fornecido'
      });
    }

    const analysisData = analysisStorage.get(processId);

    if (!analysisData) {
      return res.status(404).json({
        success: false,
        error: 'Análise não encontrada. Faça upload do arquivo primeiro.'
      });
    }

    const exportData = {
      summary: {
        'Arquivo Processado': analysisData.filename,
        'Data da Análise': new Date().toLocaleString('pt-BR'),
        'Total de Itens Processados': analysisData.totalEntries,
        'Itens Válidos': analysisData.validEntries,
        'Duplicatas Exatas Encontradas': analysisData.duplicates.length,
        'Possíveis Duplicatas': analysisData.possibleDuplicates.length
      },
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
        'Chave Similar': dup.chaveDuplicata
      }))
    };

    const excelBuffer = await exportToExcel(exportData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="analise-duplicatas-${processId}.xlsx"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);

  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Limpeza de armazenamento (mantém igual)
 */
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