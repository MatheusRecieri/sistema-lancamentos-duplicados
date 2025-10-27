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

            if (!value) {
                throw new Error("Não foi possível extrair texto do Word");
            }

            return extractLines(value);
        }

        if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
            // XLSX.set_fs(fs);
            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            return json.filter(row => row.length > 0);
        }

        if (mimeType.includes("text")) {
            const data = await fs.readFile(filePath, "utf-8");
            return extractLines(data);
        }

        throw new Error("Tipo de arquivo não suportado");
    } catch (error) {
        console.error("Erro na leitura do arquivo:", error);
        throw error;
    }
}

function parseGenericPDFData(text) {
    const lines = extractLines(text);
    const financialEntries = [];

    console.log(`📊 Analisando ${lines.length} linhas...`);

    const index = 6;

    lines.forEach((line, index) => {
        // Ignora linhas que claramente não são dados financeiros
        // if (index > 6) {
        //     return;
        // }

        // Tenta identificar e extrair dados financeiros de forma genérica
        const entry = extractFinancialData(line, index, lines);

        if (entry && isValidFinancialEntry(entry)) {
            financialEntries.push(entry);
        }
    });

    console.log(`🎯 ${financialEntries.length} lançamentos financeiros identificados`);

    // Log dos primeiros itens para debug
    if (financialEntries.length > 0) {
        console.log("📋 Primeiros 5 lançamentos encontrados:");
        financialEntries.slice(0, 5).forEach((entry, i) => {
            console.log(`${i + 1}. ${entry.fornecedor || 'N/A'} | ${entry.data || 'N/A'} | R$ ${entry.valor || 'N/A'}`);
        });
    }

    return financialEntries;
}

function extractFinancialData(line, currentIndex, allLines) {
    // Remove múltiplos espaços e normaliza
    const cleanLine = line.replace(/\s+/g, ' ').trim();

    // Padrões genéricos para identificar dados financeiros
    const patterns = [
        // Padrão 1: Código + Data + Valor + Descrição
        /(\d{3,6})[\s\/\-]*(\d{2}\/\d{2}\/\d{2,4})[\s\/\-]*([\d\.\,]+)[\s\-]*(.+)/i,

        // Padrão 2: Data + Valor + Descrição
        /(\d{2}\/\d{2}\/\d{2,4})[\s\/\-]*([\d\.\,]+)[\s\-]*(.+)/i,

        // Padrão 3: Descrição + Valor + Data
        /(.+?)[\s\-]+([\d\.\,]+)[\s\-]+(\d{2}\/\d{2}\/\d{2,4})/i,

        // Padrão 4: Apenas valor e descrição (busca data nas linhas próximas)
        /([\d\.\,]+)[\s\-]+(.+)/i
    ];

    for (const pattern of patterns) {
        const match = cleanLine.match(pattern);
        if (match) {
            const entry = buildFinancialEntry(match, pattern, cleanLine, currentIndex, allLines);
            if (entry) return entry;
        }
    }

    return null;
}

function buildFinancialEntry(match, pattern, originalLine, currentIndex, allLines) {
    let codigo, data, valor, fornecedor, nota;

    // Determina qual padrão foi encontrado e extrai os dados correspondentes
    if (pattern.source.includes('(\\d{3,6})') && match.length >= 4) {
        // Padrão 1: Código + Data + Valor + Descrição
        codigo = match[1];
        data = match[2];
        valor = match[3];
        fornecedor = match[4];
    } else if (pattern.source.includes('(\\d{2}\\/\\d{2}\\/\\d{2,4})') && match.length >= 3) {
        // Padrão 2: Data + Valor + Descrição
        data = match[1];
        valor = match[2];
        fornecedor = match[3];
    } else if (pattern.source.includes('(.+?)[\\s\\-]+([\\d\\.\\,]+)[\\s\\-]+(\\d{2}\\/\\d{2}\\/\\d{2,4})') && match.length >= 3) {
        // Padrão 3: Descrição + Valor + Data
        fornecedor = match[1];
        valor = match[2];
        data = match[3];
    } else if (pattern.source.includes('([\\d\\.\\,]+)[\\s\\-]+(.+)') && match.length >= 2) {
        // Padrão 4: Apenas valor e descrição
        valor = match[1];
        fornecedor = match[2];
        // Tenta encontrar data nas linhas próximas
        data = findDateInContext(currentIndex, allLines);
    }

    // Limpa e formata os dados
    fornecedor = cleanSupplierName(fornecedor);
    valor = cleanMonetaryValue(valor);
    data = cleanDate(data);

    // Tenta extrair número da nota da linha
    nota = extractDocumentNumber(originalLine);

    return {
        codigoFornecedor: codigo || generateTemporaryCode(fornecedor),
        data: data,
        notaSerie: nota,
        fornecedor: fornecedor,
        valorContabil: valor,
        valor: valor,
        // Campos genéricos para compatibilidade
        // baseCalculo: '0,00',
        // aliquota: '0,00',
        // isentas: '0',
        // especie: '',
        // cfop: '',
        // outras: '0,00',
        // uf: '',
        // tipoImposto: 'GENÉRICO',
        impostos: [],
        linhaOriginal: originalLine.substring(0, 100) // Para debug
    };
}

function findDateInContext(currentIndex, allLines) {
    // Procura por datas nas 5 linhas anteriores e posteriores
    const contextRange = 5;
    const start = Math.max(0, currentIndex - contextRange);
    const end = Math.min(allLines.length, currentIndex + contextRange);

    for (let i = start; i < end; i++) {
        if (i === currentIndex) continue;

        const dateMatch = allLines[i].match(/(\d{2}\/\d{2}\/\d{2,4})/);
        if (dateMatch) {
            return cleanDate(dateMatch[1]);
        }
    }

    return new Date().toLocaleDateString('pt-BR'); // Data atual como fallback
}

function cleanSupplierName(name) {
    if (!name) return 'Fornecedor não identificado';

    return name
        .replace(/\b(LTDA|SA|ME|EPP|EIRELI|CNPJ|CPF)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

function cleanMonetaryValue(value) {
    if (!value) return '0,00';

    // Remove caracteres não numéricos exceto vírgula e ponto
    let cleanValue = value.replace(/[^\d,\.]/g, '');

    // Se tem ponto como separador de milhar e vírgula como decimal
    if (cleanValue.includes('.') && cleanValue.includes(',')) {
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    // Se só tem vírgula, assume que é decimal
    else if (cleanValue.includes(',')) {
        cleanValue = cleanValue.replace(',', '.');
    }

    // Converte para número e formata como string monetária
    const numberValue = parseFloat(cleanValue);
    if (isNaN(numberValue)) return '0,00';

    return numberValue.toFixed(2).replace('.', ',');
}

function cleanDate(date) {
    if (!date) return '';

    // Garante o formato dd/mm/aaaa
    const dateMatch = date.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (dateMatch) {
        let day = dateMatch[1];
        let month = dateMatch[2];
        let year = dateMatch[3];

        // Converte ano de 2 para 4 dígitos
        if (year.length === 2) {
            year = '20' + year;
        }

        return `${day}/${month}/${year}`;
    }

    return date;
}

function extractDocumentNumber(line) {
    // Procura por padrões comuns de números de documento
    const patterns = [
        /NF[\.\-\s]*(\d+)/i,
        /NOTA[\.\-\s]*FISCAL[\.\-\s]*(\d+)/i,
        /DOCUMENTO[\.\-\s]*(\d+)/i,
        /(\d{6,})/ // Números longos (provavelmente número da nota)
    ];

    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            return match[1] || match[0];
        }
    }

    return '';
}

function generateTemporaryCode(supplierName) {
    // Gera um código temporário baseado no nome do fornecedor
    if (!supplierName) return 'TEMP001';

    const cleanName = supplierName
        .replace(/[^A-Za-z]/g, '')
        .substring(0, 3)
        .toUpperCase();

    return `TEMP${cleanName.padStart(3, '0')}`;
}

function isNonDataLine(line) {
    const nonDataPatterns = [
        /POSTO\s+JUPITER/i,
        /CLINICA\s+LEV\s+SAVASSI/i,
        /ACOMPANHAMENTO\s+DE\s+(ENTRADAS|SERVIÇOS)/i,
        /CNPJ:/i,
        /Insc\s+Est:/i,
        /Período:/i,
        /Hora:/i,
        /Emissão:/i,
        /Página:/i,
        /Sistema\s+licenciado/i,
        /Total\s+(Geral|CFOP|Fornecedor|Cliente)/i,
        /Base\s+Cálculo/i,
        /Valor\s+Contábil/i,
        /Código\s+Fornecedor/i,
        /^\s*$/ // Linhas vazias
    ];

    return nonDataPatterns.some(pattern => pattern.test(line));
}

function isValidFinancialEntry(entry) {
    // Verifica se é um lançamento válido
    return entry &&
        entry.valorContabil &&
        entry.valorContabil !== '0,00' &&
        entry.fornecedor &&
        entry.fornecedor !== 'Fornecedor não identificado';
}

function extractLines(text) {
    if (!text || typeof text !== "string") {
        console.warn("Texto vazio ou inválido para extração de linhas");
        return [];
    }

    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

// Função auxiliar para debug
export function debugStructuredData(data) {
    return data.map(item => ({
        codigo: item.codigoFornecedor,
        data: item.data,
        nota: item.notaSerie,
        fornecedor: item.fornecedor?.substring(0, 30),
        valorContabil: item.valorContabil,
        linhaOriginal: item.linhaOriginal
    }));
}