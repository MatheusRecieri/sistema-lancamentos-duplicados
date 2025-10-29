import re
from typing import List, Dict, Any, Optional
import pdfplumber
from datetime import datetime
from app.utils.normalizer import (
    normalize_text,
    clean_monetary_value,
    clean_date,
    clean_supplier_name,
)


class PDFReader:
    """
    Leitor de PDF robusto para mútiplas estrategias de extração
    """

    def __init__(self):
        self.extraction_strategies = [
            self._extract_with_layout,
            self._extract_with_table,
            self._extract_with_regex,
        ]

    def extract_raw_text(self, pdf_path: str) -> str:
        # extrai o texto brutodo pdf para debug

        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""

            return text

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extrai dados estruturados do PDF usando múltiplas estratégias

        Args:
            pdf_path: Caminho do arquivo PDF

        Returns:
            Lista de dicionários com dados extraídos
        """
        print(f"🔍 Iniciando extração do PDF: {pdf_path}")

        with pdfplumber.open(pdf_path) as pdf:
            all_entries = []

            for page_num, page in enumerate(pdf.pages, 1):
                print(f"📄 Processando página {page_num}/{len(pdf.pages)}")

                # Tenta cada estratégia até uma funcionar
                for strategy in self.extraction_strategies:
                    entries = strategy(page, page_num)
                    if entries:
                        print(
                            f"   ✅ Estratégia {strategy.__name__} encontrou {len(entries)} entradas"
                        )
                        all_entries.extend(entries)
                        break
                else:
                    print(f"   ⚠️ Nenhuma estratégia funcionou na página {page_num}")

            print(f"🎯 Total extraído: {len(all_entries)} registros")
            return all_entries

    def _extract_with_layout(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Extartégia 1: Extração baseada em layout preservado
        Otimizada para formato ACOMPANHAMENTO DE ENTRADAS
        """

        text = page.extract_text(layout=True)
        if not text:
            return []

        entries = []
        lines = text.split("\n")

        # Detecta onde os dados começam

        data_start_idx = -1
        for idx, line in enumerate(lines):
            # proucura pela linha de cabeçalho das colunas
            if "Codigo" in line and "Data" in line and "Nota" in line:
                data_start_idx = idx + 1
                print(f"Cabeçalho encontrado na linha {idx}")
                break

        if data_start_idx == -1:
            data_start_idx = 10  # fallback: pula primeiras 10 linhas

        for idx in range(data_start_idx, len(lines)):
            line = lines[idx]

            if not line.strip() or len(line.strip()) < 20:
                continue

            if self._is_total_or_footer(line):
                break

            if self._is_tax_subline(line):
                continue

            entry = self._parse_structured_line(line, idx, page_num)
            if entry and self._is_valid_entry(entry):
                entries.append(entry)

        return entries

    def _extract_with_table(self, page, pge_num) -> List[Dict[str, Any]]:
        """
        Estrategia 2: Extração de tabelas
        Melhor para pedf com estrutura tabular clara
        """

        tables = page.extract_tables()
        if not tables:
            return []

        entries = []

        for table in tables:
            if not tables or len(table) < 2:
                continue

            header = table[0]

            col_map = self.map_columns(header)

            for row_idx, row in enumerate(table[1:], 1):
                if note_row or len(row) < 3:
                    continue

                entry = self._parse_table_row(row, col_map, row_idx, page_num)
                if entry and self._is_valid_entry(entry):
                    entries.append(entry)

        return entries

    def _extract_with_regex(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Estratégia 3: Extração via regex
        Fallback para PDFs sem estrutura clara
        """
        text = page.extract_text()
        if not text:
            return []

        entries = []
        lines = text.split("\n")

        # Padrões de extração
        patterns = [
            # Padrão completo: CÓDIGO DATA NOTA FORNECEDOR VALOR_CONTABIL VALOR
            r"(\d{3,6})\s+(\d{2}/\d{2}/\d{2,4})\s+(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)",
            # Padrão sem código: DATA NOTA FORNECEDOR VALOR
            r"(\d{2}/\d{2}/\d{2,4})\s+(\d+)\s+(.{10,}?)\s+([\d.,]+)",
            # Padrão minimalista: FORNECEDOR DATA VALOR
            r"([A-Z][A-Za-z\s]{5,50}?)\s+(\d{2}/\d{2}/\d{2,4})\s+([\d.,]+)",
        ]

        for idx, line in enumerate(lines):
            if self._is_non_data_line(line):
                continue

            for pattern in patterns:
                match = re.search(pattern, line)
                if match:
                    entry = self._build_entry_from_regex(
                        match, pattern, line, idx, page_num
                    )
                    if entry and self._is_valid_entry(entry):
                        entries.append(entry)
                        break

        return entries

    def _find_header_line(self, lines: List[str]) -> int:
        """Encontra a linha do cabeçalho"""
        header_patterns = [
            r"código.*fornecedor.*data.*nota.*valor",
            r"supplier.*date.*invoice.*amount",
            r"cod.*forn.*dt.*vl",
        ]

        for idx, line in enumerate(lines[:15]):  # Procura nas primeiras 15 linhas
            line_lower = line.lower()
            for pattern in header_patterns:
                if re.search(pattern, line_lower, re.IGNORECASE):
                    return idx

        return -1

    def _is_non_data_line(self, line: str) -> bool:
        """Identifica linhas que não são dados"""
        non_data_patterns = [
            r"^total",
            r"^subtotal",
            r"^página",
            r"^emissão",
            r"sistema licenciado",
            r"^cnpj:",
            r"^insc\s+est:",
            r"acompanhamento\s+de",
            r"^\s*$",  # Linha vazia
        ]

        line_lower = line.lower().strip()
        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_tax_subline(self, line: str) -> bool:
        """Identifica linhas de sub-impostos que não são notas"""
        line_clean = line.strip()

        # Padrões de linhas de imposto
        tax_patterns = [
            r"^\s*ISS\s+",
            r"^\s*IRRF\s+",
            r"^\s*CRF\s+",
            r"^\s*INSS-RET\s+",
            r"^\s*ISS RET\.\s+",
        ]

        return any(
            re.match(pattern, line_clean, re.IGNORECASE) for pattern in tax_patterns
        )

    def _is_total_or_footer(self, line: str) -> bool:
        """Identifica linhas de total e rodapé"""
        line_lower = line.lower().strip()

        footer_patterns = [
            "total cfop",
            "total geral",
            "sistema licenciado",
            "página:",
        ]

        return any(pattern in line_lower for pattern in footer_patterns)

    def _parse_structured_line(
        self, line: str, line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Parse especializado para formato ACOMPANHAMENTO DE ENTRADAS
        Formato esperado: Código | Data | Nota | Série | ... | Fornecedor | ... | Valor Contábil
        """
        # Remove espaços extras
        parts = line.split()

        if len(parts) < 8:
            return None

        try:
            # Extração de campos fixos
            codigo = parts[0]

            # Procura pela data (formato DD/MM/YYYY)
            data_idx = -1
            for i, part in enumerate(parts):
                if re.match(r"\d{2}/\d{2}/\d{4}", part):
                    data_idx = i
                    break

            if data_idx == -1:
                return None

            data = parts[data_idx]

            # Nota fiscal geralmente vem depois da data
            nota = parts[data_idx + 1] if data_idx + 1 < len(parts) else "N/A"

            # Procura pelo valor contábil (último valor antes dos impostos)
            # Formato: 1.234,56 ou 234,56
            valor_contabil = "0,00"
            for i in range(len(parts) - 1, -1, -1):
                if re.match(r"[\d.,]+", parts[i]) and "," in parts[i]:
                    valor_contabil = parts[i]
                    break

            # Fornecedor está entre a série/espécie e o CFOP
            # Geralmente após o 5º elemento até antes do valor
            fornecedor_parts = []
            in_fornecedor = False

            for i in range(data_idx + 3, len(parts)):
                part = parts[i]

                # Para quando encontrar padrões de fim de fornecedor
                if re.match(r"\d-\d+", part):  # CFOP (ex: 1-933)
                    break

                # Pula campos numéricos curtos (série, espécie)
                if i <= data_idx + 5 and part.isdigit() and len(part) <= 2:
                    continue

                # Adiciona ao fornecedor
                if not part.replace(".", "").replace(",", "").isdigit():
                    fornecedor_parts.append(part)

            fornecedor = (
                " ".join(fornecedor_parts)
                if fornecedor_parts
                else "Fornecedor Desconhecido"
            )

            return {
                "codigoFornecedor": codigo.strip(),
                "fornecedor": clean_supplier_name(fornecedor),
                "data": clean_date(data),
                "notaSerie": nota.strip(),
                "valorContabil": clean_monetary_value(valor_contabil),
                "valor": clean_monetary_value(valor_contabil),
                "posicao": f"Pág {page_num}, Linha {line_num}",
            }

        except Exception as e:
            # Se falhar, não retorna nada
            return None

    def _map_columns(self, header: List[str]) -> Dict[str, int]:
        """Mapeia colunas da tabela"""
        col_map = {}

        for idx, col in enumerate(header):
            if not col:
                continue

            col_lower = col.lower()

            if "código" in col_lower or "codigo" in col_lower:
                col_map["codigo"] = idx
            elif "fornecedor" in col_lower or "supplier" in col_lower:
                col_map["fornecedor"] = idx
            elif "data" in col_lower or "date" in col_lower:
                col_map["data"] = idx
            elif "nota" in col_lower or "invoice" in col_lower or "nf" in col_lower:
                col_map["nota"] = idx
            elif "contábil" in col_lower or "contabil" in col_lower:
                col_map["valor_contabil"] = idx
            elif "valor" in col_lower or "amount" in col_lower:
                if "valor_contabil" not in col_map:
                    col_map["valor"] = idx

        return col_map

    def _parse_table_row(
        self, row: List[str], col_map: Dict[str, int], row_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """Parse linha de tabela"""

        def get_col(key: str, default: str = "") -> str:
            idx = col_map.get(key, -1)
            if idx != -1 and idx < len(row):
                return str(row[idx] or default).strip()
            return default

        fornecedor = get_col("fornecedor", "Desconhecido")
        data = get_col("data")
        valor_contabil = get_col("valor_contabil", get_col("valor", "0,00"))

        # Validação básica
        if not fornecedor or not data or fornecedor == "Desconhecido":
            return None

        return {
            "codigoFornecedor": get_col("codigo", "N/A"),
            "fornecedor": fornecedor,
            "data": clean_date(data),
            "notaSerie": get_col("nota", "N/A"),
            "valorContabil": clean_monetary_value(valor_contabil),
            "valor": clean_monetary_value(get_col("valor", valor_contabil)),
            "posicao": f"Pág {page_num}, Linha {row_num}",
        }

    def _build_entry_from_regex(
        self, match, pattern: str, original_line: str, line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """Constrói entrada a partir de match regex"""
        groups = match.groups()

        # Identifica qual padrão foi usado pelo número de grupos
        if len(groups) >= 6:  # Padrão completo
            codigo, data, nota, fornecedor, valor_contabil, valor = groups
        elif len(groups) == 4:  # Sem código
            data, nota, fornecedor, valor_contabil = groups
            codigo = "N/A"
            valor = valor_contabil
        elif len(groups) == 3:  # Minimalista
            fornecedor, data, valor_contabil = groups
            codigo = "N/A"
            nota = "N/A"
            valor = valor_contabil
        else:
            return None

        return {
            "codigoFornecedor": str(codigo).strip(),
            "fornecedor": fornecedor.strip(),
            "data": clean_date(data),
            "notaSerie": str(nota).strip(),
            "valorContabil": clean_monetary_value(valor_contabil),
            "valor": clean_monetary_value(valor),
            "posicao": f"Pág {page_num}, Linha {line_num}",
        }

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se a entrada é válida"""
        if not entry:
            return False

        # Validações essenciais
        if not entry.get("fornecedor") or entry["fornecedor"] == "Desconhecido":
            return False

        if not entry.get("data") or entry["data"] == "":
            return False

        if entry.get("valorContabil", "0,00") == "0,00":
            return False

        # Valida se fornecedor tem comprimento razoável
        if len(entry["fornecedor"]) < 3:
            return False

        return True
