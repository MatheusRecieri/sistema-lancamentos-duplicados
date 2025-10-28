
import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import XLSX from "xlsx";

export async function readFileContent(filePath, mimeType) {
  try {
    if (mimeType.includes("pdf")) {
      console.log("📄 Processando arquivo PDF...");
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      await parser.destroy();

      if (!data || !data.text) {
        throw new Error("Não foi possível extrair texto do PDF");
      }

      console.log(`✅ Texto extraído (${data.text.length} caracteres)`);
      return parseGenericPDFData(data.text);
    }

    if (mimeType.includes("word") || mimeType.includes("docx")) {
      const buffer = await fs.readFile(filePath);
      const { value } = await mammoth.extractRawText({ buffer });
      if (!value) throw new Error("Não foi possível extrair texto do Word");
      return parseGenericPDFData(value);
    }

    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      return parseExcelData(json);
    }

    if (mimeType.includes("text")) {
      const data = await fs.readFile(filePath, "utf-8");
      return parseGenericPDFData(data);
    }

    throw new Error("Tipo de arquivo não suportado");
  } catch (error) {
    console.error("Erro na leitura do arquivo:", error);
    throw error;
  }
}

// ✅ NOVO: Estratégia de extração para Excel
function parseExcelData(rows) {
  console.log(`📊 Analisando ${rows.length} linhas do Excel...`);

  const financialEntries = [];
  let headerRowIndex = -1;

  // Detecta linha de cabeçalho
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (isHeaderRow(row)) {
      headerRowIndex = i;
      console.log(`📌 Cabeçalho detectado na linha ${i + 1}`);
      break;
    }
  }

  // Processa linhas após o cabeçalho
  const startIndex = headerRowIndex + 1;
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    // Pula linhas vazias ou muito curtas
    if (!row || row.length < 3) continue;

    // Pula linhas de totalização
    if (isTotalLine(row)) continue;

    const entry = parseExcelRow(row, i);
    if (entry && isValidFinancialEntry(entry)) {
      entry.posicao = i + 1; // Posição original no arquivo
      financialEntries.push(entry);
    }
  }

  console.log(`🎯 ${financialEntries.length} lançamentos financeiros identificados`);
  return financialEntries;
}

// ✅ NOVO: Detecta linha de cabeçalho
function isHeaderRow(row) {
  if (!row || row.length < 3) return false;

  const headerPatterns = [
    /código|fornecedor|data|nota|valor|contabil/i,
    /supplier|date|invoice|amount/i
  ];

  const rowText = row.join(" ").toLowerCase();
  return headerPatterns.some(pattern => pattern.test(rowText));
}

// ✅ NOVO: Detecta linhas de totalização
function isTotalLine(row) {
  if (!row || row.length === 0) return true;

  const firstCell = String(row[0] || "").toLowerCase();
  const totalPatterns = [
    /^total|^subtotal|^saldo|^resultado/i,
    /^$/, // Linhas vazias
  ];

  return totalPatterns.some(pattern => pattern.test(firstCell));
}

// ✅ NOVO: Parseia linha do Excel
function parseExcelRow(row, rowIndex) {
  // Estrutura esperada: [Código, Fornecedor, Data, Nota, Valor Contabil, Valor, ...]
  const [codigo, fornecedor, data, nota, valorContabil, valor] = row;

  if (!fornecedor || !valorContabil) return null;

  return {
    codigoFornecedor: String(codigo || "").trim() || "N/A",
    fornecedor: String(fornecedor).trim(),
    data: cleanDate(data),
    notaSerie: String(nota || "").trim(),
    valorContabil: cleanMonetaryValue(valorContabil),
    valor: cleanMonetaryValue(valor || valorContabil),
    posicao: rowIndex + 1
  };
}

// ✅ MELHORADO: Parse genérico (PDF/Word) com filtragem rigorosa
function parseGenericPDFData(text) {
  const lines = extractLines(text);
  const financialEntries = [];

  console.log(`📊 Analisando ${lines.length} linhas...`);

  let headerIndex = -1;
  let dataStartIndex = -1;

  // ETAPA 1: Encontrar onde começam os dados reais
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pula linhas muito curtas
    if (line.length < 10) continue;

    // Detecta cabeçalho
    if (line.match(/código|fornecedor|data|nota|valor|contabil/i)) {
      headerIndex = i;
      dataStartIndex = i + 1;
      console.log(`📌 Cabeçalho detectado na linha ${i + 1}: "${line.substring(0, 50)}..."`);
      break;
    }
  }

  // Se não encontrou cabeçalho, começa depois das 5 primeiras linhas
  if (dataStartIndex === -1) {
    dataStartIndex = 5;
    console.log("⚠️  Cabeçalho não detectado, começando análise na linha 6");
  }

  // ETAPA 2: Extrai dados apenas após o cabeçalho
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];

    // Pula linhas vazias
    if (!line || line.trim().length === 0) continue;

    // Pula linhas de rodapé/finalização
    if (isFinalLine(line)) break;

    // Pula linhas que claramente não são dados
    if (isNonDataLine(line)) continue;

    // Extrai dados
    const entry = extractFinancialData(line, i, lines);

    if (entry && isValidFinancialEntry(entry)) {
      entry.posicao = i + 1; // Posição original no arquivo
      financialEntries.push(entry);
    }
  }

  console.log(`🎯 ${financialEntries.length} lançamentos encontrados`);

  if (financialEntries.length > 0) {
    console.log("📋 Primeiros 5 lançamentos:");
    financialEntries.slice(0, 5).forEach((entry, i) => {
      console.log(`${i + 1}. Código: ${entry.codigoFornecedor} | ${entry.fornecedor} | ${entry.data} | R$ ${entry.valorContabil}`);
    });
  }

  return financialEntries;
}

// ✅ NOVO: Detecta linhas de finalização (rodapé, totais, etc)
function isFinalLine(line) {
  const finalPatterns = [
    /^(total|subtotal|saldo|resultado|fim|end)/i,
    /^(page|página|pag\.)/i,
    /^(sistema licenciado|assinado|certificado)/i,
  ];
  return finalPatterns.some(pattern => pattern.test(line.trim()));
}

// ✅ MELHORADO: Filtragem de linhas não-dados
function isNonDataLine(line) {
  const nonDataPatterns = [
    /POSTO\s+JUPITER/i,
    /CLINICA\s+LEV\s+SAVASSI/i,
    /ACOMPANHAMENTO\s+DE\s+(ENTRADAS|SERVIÇOS)/i,
    /^CNPJ:/i,
    /^Insc\s+Est:/i,
    /^Período:/i,
    /^Hora:/i,
    /^Emissão:/i,
    /^Página:/i,
    /Sistema\s+licenciado/i,
    /^Total\s+(Geral|CFOP|Fornecedor|Cliente)/i,
    /^Base\s+Cálculo/i,
    /^Valor\s+Contábil/i,
    /^Código\s+Fornecedor/i,
  ];

  return nonDataPatterns.some(pattern => pattern.test(line));
}

// ✅ MELHORADO: Extração com padrões mais específicos
function extractFinancialData(line, currentIndex, allLines) {
  const cleanLine = line.replace(/\s+/g, ' ').trim();

  // Padrão esperado: CÓDIGO DATA NOTA FORNECEDOR VALOR_CONTABIL VALOR
  // Exemplo: 001234  01/01/2024  123456  EMPRESA X LTDA  1.500,00  1.500,00

  const patterns = [
    // Padrão 1: Código + Data + Nota + Fornecedor + Valores
    /(\d{3,6})\s+(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(.+?)\s+([\d\.,]+)\s+([\d\.,]+)/,

    // Padrão 2: Data + Nota + Fornecedor + Valores (código implícito)
    /(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(.+?)\s+([\d\.,]+)\s+([\d\.,]+)/,

    // Padrão 3: Fornecedor + Data + Valor (minimalista)
    /([A-Z][A-Za-z\s]{3,50})\s+(\d{2}\/\d{2}\/\d{2,4})\s+([\d\.,]+)/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = cleanLine.match(patterns[i]);
    if (match) {
      return buildFinancialEntry(match, i, cleanLine);
    }
  }

  return null;
}

// ✅ MELHORADO: Construção de entrada com validação
function buildFinancialEntry(match, patternIndex, originalLine) {
  let codigo, data, nota, fornecedor, valorContabil, valor;

  try {
    if (patternIndex === 0) {
      // Padrão 1: Código + Data + Nota + Fornecedor + Valores
      [, codigo, data, nota, fornecedor, valorContabil, valor] = match;
    } else if (patternIndex === 1) {
      // Padrão 2: Data + Nota + Fornecedor + Valores
      [, data, nota, fornecedor, valorContabil, valor] = match;
      codigo = generateTemporaryCode(fornecedor);
    } else if (patternIndex === 2) {
      // Padrão 3: Fornecedor + Data + Valor
      [, fornecedor, data, valorContabil] = match;
      codigo = generateTemporaryCode(fornecedor);
      nota = extractDocumentNumber(originalLine) || "N/A";
      valor = valorContabil;
    }

    // Limpeza e validação
    fornecedor = cleanSupplierName(fornecedor);
    valorContabil = cleanMonetaryValue(valorContabil);
    valor = cleanMonetaryValue(valor || valorContabil);
    data = cleanDate(data);

    // Validação final
    if (!fornecedor || fornecedor === "Fornecedor não identificado") return null;
    if (!data || data === "") return null;
    if (valorContabil === "0,00") return null;

    return {
      codigoFornecedor: codigo || "N/A",
      data,
      notaSerie: nota || "N/A",
      fornecedor,
      valorContabil,
      valor
    };
  } catch (error) {
    console.warn("Erro ao construir entrada:", error.message);
    return null;
  }
}

function cleanSupplierName(name) {
  if (!name) return "Fornecedor não identificado";

  return name
    .replace(/\b(LTDA|SA|ME|EPP|EIRELI)\b/gi, '') // ✅ Mantém info importante
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

function cleanMonetaryValue(value) {
  if (!value) return "0,00";

  let cleanValue = String(value).replace(/[^\d,\.]/g, '');

  if (cleanValue.includes('.') && cleanValue.includes(',')) {
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
  } else if (cleanValue.includes(',')) {
    cleanValue = cleanValue.replace(',', '.');
  }

  const numberValue = parseFloat(cleanValue);
  return isNaN(numberValue) ? "0,00" : numberValue.toFixed(2).replace('.', ',');
}

function cleanDate(date) {
  if (!date) return "";

  const dateMatch = String(date).match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (dateMatch) {
    let [, day, month, year] = dateMatch;
    day = String(day).padStart(2, '0');
    month = String(month).padStart(2, '0');
    year = year.length === 2 ? '20' + year : year;
    return `${day}/${month}/${year}`;
  }

  return "";
}

function extractDocumentNumber(line) {
  const patterns = [
    /NF[\.\-\s]*(\d+)/i,
    /NOTA[\.\-\s]*FISCAL[\.\-\s]*(\d+)/i,
    /DOCUMENTO[\.\-\s]*(\d+)/i,
    /(\d{6,})/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return match[1] || match[0];
  }

  return "";
}

function generateTemporaryCode(supplierName) {
  if (!supplierName) return "TEMP001";
  const cleanName = supplierName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  return `TEMP${cleanName.padStart(3, '0')}`;
}

function isValidFinancialEntry(entry) {
  return entry &&
    entry.valorContabil &&
    entry.valorContabil !== "0,00" &&
    entry.fornecedor &&
    entry.fornecedor !== "Fornecedor não identificado" &&
    entry.data !== "";
}

function extractLines(text) {
  if (!text || typeof text !== "string") {
    console.warn("Texto vazio ou inválido");
    return [];
  }

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}