//passos
//extrair o texto v
//identificar notas
//identificar notas duplicadas
//identificar possiveis notas duplicadas


import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import XLSX from "xlsx";

class FileReaderService {

  constructor(parameters) {
    this.rawText = null;        // Texto bruto extraído
    this.lines = [];            // Linhas do arquivo
    this.notes = [];            // Notas identificadas
    this.duplicates = [];       // Duplicatas exatas
    this.possibleDuplicates = []; // Possíveis duplicatas
  }

  //lê o arquivo
  async readFile(filePath, mimeType) {
    try {

      console.log(`\nIniciando leitura do arquivo ${filePath}`);
      console.log(`\nTipo: ${mimeType}`);


      let rawText;

      switch (mimeType) {

        case mimeType.includes("pdf"):
          rawText = await this._readPDF(filePath);
          break;

        case mimeType.includes("word"):
          rawText = await this._readWord(filePath);
          break

        case mimeType.includes("spreadsheet"):
          rawText = await this._readExcel(filePath);
          break;

        case mimeType.includes("text"):
          rawText = await this._readText(filePath);
          break;

        default:
          return 'Arquivo não suportado'
      }


      this.rawText = rawText;
      console.log(`Texto extraido: ${this.rawText.length}`);

      // PASSO 2: Identificar notas
      return this.identifyNotes();


    } catch (error) {
      console.error("Erro na leitura do arquivo:", error);
      throw error;
    }
  }

  async _readPDF(filePath) { }

  async _readWord(filePath) { }

  async _readExcel(filePath) { }

  async _readText(filePath) { }


  identifyNotes(text) {

  }
}

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
      // console.log('Data:', data);


      // Tenta parser estruturado primeiro (para PDFs tabulares)
      let entries = parseStructuredTablePDF(data.text);

      // Se não encontrou dados, tenta parser genérico
      if (entries.length === 0) {
        console.log("⚠️  Parser estruturado não encontrou dados, tentando parser genérico...");
        entries = parseGenericPDFData(data.text);
      }
      console.log('Entries:', entries);

      return entries;
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

// ✅ NOVO: Parser para tabelas estruturadas (específico para este tipo de PDF)
function parseStructuredTablePDF(text) {
  console.log('🔍 Tentando parser estruturado de tabela...');



  const lines = extractLines(text);
  const financialEntries = [];

  console.log('financial', lines);

  // Detecta cabeçalho da tabela
  let headerIndex = -1;
  let dataStartIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].toLowerCase();

    // Procura por indicadores de cabeçalho tabular
    if (line.includes('código') && line.includes('fornecedor') && line.includes('valor contábil')) {
      headerIndex = i;

      // Encontra onde os dados começam (próxima linha não vazia após cabeçalho)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().length > 10 && !lines[j].match(/^total|^subtotal|^saldo/i)) {
          dataStartIndex = j;
          break;
        }
      }
      console.log(`📌 Cabeçalho tabular detectado na linha ${i + 1}`);
      console.log(`📊 Dados começam na linha ${dataStartIndex + 1}`);
      break;
    }
  }

  // Se não encontrou cabeçalho estruturado, retorna vazio
  if (dataStartIndex === -1) {
    console.log("⚠️  Cabeçalho tabular não encontrado");
    return [];
  }

  // ETAPA 2: Processa cada linha como uma entrada tabular
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];

    // Pula linhas vazias
    if (!line || line.trim().length === 0) continue;

    // Pula rodapé
    if (line.match(/^(total|subtotal|saldo|resultado|fim|end|sistema licenciado|página)/i)) break;

    // Pula linhas que claramente não são dados
    if (isNonDataLine(line)) continue;

    // Tenta fazer parse da linha como entrada tabular
    const entry = parseTableRow(line, 1);

    // console.log('entry', entry);


    if (entry && isValidFinancialEntry(entry)) {
      entry.posicao = i + 1;
      financialEntries.push(entry);
    }
  }

  console.log('Financial entry', financialEntries);


  if (financialEntries.length > 0) {
    console.log(`🎯 ${financialEntries.length} lançamentos encontrados via parser tabular`);
    if (financialEntries.length > 0) {
      console.log("📋 Primeiros 3 lançamentos:");
      financialEntries.slice(0, 3).forEach((entry, idx) => {
        console.log(`${idx + 1}. Código: ${entry.codigoFornecedor} | ${entry.fornecedor} | ${entry.data} | R$ ${entry.valorContabil}`);
      });
    }
  }

  return financialEntries;
}

// ✅ NOVO: Parse de linha tabular
function parseTableRow(line, rowIndex) {
  // Usando o nome 'extractStructuredData' em vez de 'parseTableRow' para manter a consistência com a lógica anterior

  // Remove múltiplos espaços e normaliza
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  const parts = cleanLine.split(' ');

  // Objeto que será retornado
  const entry = {};

  // -------------------------------------------------------------
  // 1. EXTRAÇÃO DOS 2 PRIMEIROS CAMPOS RÍGIDOS (CÓDIGO E DATA)
  // -------------------------------------------------------------

  // Código: Sempre o primeiro item
  entry.codigoFornecedor = parts[0];
  if (!/^\d{3,6}$/.test(entry.codigoFornecedor)) return null;

  // Data: Sempre o segundo item
  entry.data = cleanDate(parts[1]);
  if (!entry.data || entry.data === parts[1]) return null;

  // -------------------------------------------------------------
  // 2. EXTRAÇÃO DOS CAMPOS VARIÁVEIS (NOTA, FORNECEDOR E VALOR)
  // -------------------------------------------------------------

  // Concatena o restante da linha para RegEx mais flexível
  const remainingText = parts.slice(2).join(' ');

  // A. Valor Contábil (Ponto de Ancoragem)
  // Procura por um valor monetário antes de um tipo de imposto (ISS, ICMS, etc.)
  // Garante que o valor não seja seguido imediatamente por outro número (para evitar o código do fornecedor)
  const valueMatch = remainingText.match(/([\d\.,]+)\s+(ISS|ICMS|PIS|COFINS|IRRF|INSS)/i);

  if (!valueMatch) {
    // console.log(`Falha na ancoragem Valor/Imposto: ${cleanLine.substring(0, 50)}`);
    return null;
  }

  entry.valorContabil = cleanMonetaryValue(valueMatch[1]);
  entry.valor = entry.valorContabil;

  // B. Segmentação do Fornecedor e Nota
  // Pega o texto entre a Data e o Valor Contábil
  const middleSegment = remainingText.substring(0, valueMatch.index).trim();

  // C. Tenta isolar Nota/Série e Fornecedor
  // Nota/Série (pode ser um número longo) está no começo do segmento
  // Pattern: 39 (Espécie) + Número da Nota (longo)

  let notaSerie = '';
  let fornecedorAndLixo = middleSegment;

  // 1. Tenta achar o Espécie '39' e o Número da Nota/Série
  const notaMatch = middleSegment.match(/^(\d{2})\s+([\d\sA-Za-z-]+)/);

  if (notaMatch && notaMatch[1] === '39') {
    // Se for 39 (Espécie) e tiver um bloco de nota longo
    notaSerie = notaMatch[2].replace(/\s0$/, '').trim(); // Captura a nota e limpa
    fornecedorAndLixo = middleSegment.substring(notaMatch[0].length).trim(); // O que sobrou é o fornecedor
  } else {
    // Fallback: Tenta achar um bloco de nota longo (pode ser o caso de não ter '39')
    const genericNotaMatch = middleSegment.match(/^([\d\sA-Za-z-]+)/);
    if (genericNotaMatch) {
      notaSerie = genericNotaMatch[1].replace(/\s0$/, '').trim();
      fornecedorAndLixo = middleSegment.substring(genericNotaMatch[0].length).trim();
    }
  }

  // D. Limpeza final do Fornecedor (Remoção de Códigos e Lixo)
  fornecedorAndLixo = fornecedorAndLixo
    .replace(/[\d\-]+\s+(MG|SP|RJ|BA|ES|RS)$/i, '') // Remove (CÓDIGO UF) no final
    .replace(/1-933\s+\d+\s*/i, '') // Remove (1-933 1715)
    .trim();

  entry.fornecedor = cleanSupplierName(fornecedorAndLixo);
  entry.notaSerie = notaSerie;

  // -------------------------------------------------------------

  // Retorno final
  return {
    codigoFornecedor: entry.codigoFornecedor,
    data: entry.data,
    notaSerie: entry.notaSerie,
    fornecedor: entry.fornecedor,
    valorContabil: entry.valorContabil,
    valor: entry.valor,
    // Garante que todos os campos obrigatórios para análise foram preenchidos
    linhaOriginal: cleanLine.substring(0, 100)
  };
}

// ✅ ANTIGO: Parser genérico (fallback)
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

    if (!line || line.trim().length === 0) continue;
    if (isFinalLine(line)) break;
    if (isNonDataLine(line)) continue;

    const entry = extractFinancialData(line, i, lines);

    if (entry && isValidFinancialEntry(entry)) {
      entry.posicao = i + 1;
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

// ✅ Parse Excel
function parseExcelData(rows) {
  console.log(`📊 Analisando ${rows.length} linhas do Excel...`);

  const financialEntries = [];
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (isHeaderRow(row)) {
      headerRowIndex = i;
      console.log(`📌 Cabeçalho detectado na linha ${i + 1}`);
      break;
    }
  }

  const startIndex = headerRowIndex + 1;
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length < 3) continue;
    if (isTotalLine(row)) continue;

    const entry = parseExcelRow(row, i);
    if (entry && isValidFinancialEntry(entry)) {
      entry.posicao = i + 1;
      financialEntries.push(entry);
    }
  }

  console.log(`🎯 ${financialEntries.length} lançamentos encontrados do Excel`);
  return financialEntries;
}

function isHeaderRow(row) {
  if (!row || row.length < 3) return false;
  const headerPatterns = [
    /código|fornecedor|data|nota|valor|contabil/i,
    /supplier|date|invoice|amount/i
  ];
  const rowText = row.join(" ").toLowerCase();
  return headerPatterns.some(pattern => pattern.test(rowText));
}

function isTotalLine(row) {
  if (!row || row.length === 0) return true;
  const firstCell = String(row[0] || "").toLowerCase();
  return /^(total|subtotal|saldo|resultado)$/i.test(firstCell);
}

function parseExcelRow(row, rowIndex) {
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

function extractFinancialData(line, currentIndex, allLines) {
  const cleanLine = line.replace(/\s+/g, ' ').trim();

  const patterns = [
    /(\d{3,6})\s+(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(.+?)\s+([\d\.,]+)\s+([\d\.,]+)/,
    /(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(.+?)\s+([\d\.,]+)\s+([\d\.,]+)/,
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

function buildFinancialEntry(match, patternIndex, originalLine) {
  let codigo, data, nota, fornecedor, valorContabil, valor;

  try {
    if (patternIndex === 0) {
      [, codigo, data, nota, fornecedor, valorContabil, valor] = match;
    } else if (patternIndex === 1) {
      [, data, nota, fornecedor, valorContabil, valor] = match;
      codigo = generateTemporaryCode(fornecedor);
    } else if (patternIndex === 2) {
      [, fornecedor, data, valorContabil] = match;
      codigo = generateTemporaryCode(fornecedor);
      nota = extractDocumentNumber(originalLine) || "N/A";
      valor = valorContabil;
    }

    fornecedor = cleanSupplierName(fornecedor);
    valorContabil = cleanMonetaryValue(valorContabil);
    valor = cleanMonetaryValue(valor || valorContabil);
    data = cleanDate(data);

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

function isFinalLine(line) {
  const finalPatterns = [
    /^(total|subtotal|saldo|resultado|fim|end)/i,
    /^(page|página|pag\.)/i,
    /^(sistema licenciado|assinado|certificado)/i,
  ];
  return finalPatterns.some(pattern => pattern.test(line.trim()));
}

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

function cleanSupplierName(name) {
  if (!name) return "Fornecedor não identificado";

  return name
    .replace(/\b(LTDA|SA|ME|EPP|EIRELI)\b/gi, '')
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