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
    Leitor de PDF robusto com extração por tabela
    """

    def __init__(self):
        """Inicializa configurações"""
        self.tax_lines = [
            "ISS",
            "IRRF",
            "CRF",
            "INSS-RET",
            "ISS RET",
            "SUBTRI",
            "ICMS",
            "Total Fornecedor",
            "Total Geral",
        ]

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extrai dados estruturados do PDF usando extração de tabelas

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

                # ESTRATÉGIA 1: Extração por tabela (melhor para esse formato)
                entries_table = self._extract_with_table(page, page_num)

                # ESTRATÉGIA 2: Extração por regex (fallback)
                if not entries_table:
                    print("⚠️ Tabela não encontrada, tentando regex...")
                    entries_table = self._extract_with_regex(page, page_num)

                all_entries.extend(entries_table)

            print(f"🎯 Total extraído: {len(all_entries)} registros")
            return all_entries

    def _extract_with_table(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Extração por tabela (melhor para PDFs estruturados)
        """
        # Configurações de extração de tabela
        table_settings = {
            "vertical_strategy": "lines_strict",
            "horizontal_strategy": "lines_strict",
            "intersection_x_tolerance": 5,
            "intersection_y_tolerance": 5,
        }

        tables = page.extract_tables(table_settings)

        if not tables:
            print("⚠️ Nenhuma tabela encontrada na página")
            return []

        entries = []

        for table_idx, table in enumerate(tables):
            if not table or len(table) < 2:
                continue

            print(f"📊 Tabela {table_idx + 1}: {len(table)} linhas")

            # Encontra o cabeçalho
            header_idx = self._find_header_in_table(table)

            if header_idx == -1:
                print("⚠️ Cabeçalho não encontrado")
                continue

            # Processa cada linha da tabela
            for row_idx in range(header_idx + 1, len(table)):
                row = table[row_idx]

                if not row or len(row) < 8:
                    continue

                # Debug: mostra primeiras linhas
                if row_idx < header_idx + 10:
                    print(f"🔍 Linha {row_idx}: {row[:5]}")

                entry = self._parse_table_row(row, row_idx, page_num)

                if entry and self._is_valid_entry(entry):
                    print(
                        f"✅ Entry válida: {entry['fornecedor']} - R$ {entry['valorContabil']}"
                    )
                    entries.append(entry)

        print(f"📊 Extraídos {len(entries)} registros da página {page_num}")
        return entries

    def _find_header_in_table(self, table: List[List]) -> int:
        """Encontra a linha do cabeçalho na tabela"""
        for idx, row in enumerate(table):
            if not row:
                continue

            # Junta a linha para verificar
            row_text = " ".join([str(cell or "").lower() for cell in row])

            # Verifica se tem os campos principais do cabeçalho
            if "codigo" in row_text or "código" in row_text:
                if "data" in row_text and "fornecedor" in row_text:
                    print(f"✅ Cabeçalho encontrado na linha {idx}")
                    return idx

        return -1

    def _parse_table_row(
        self, row: List[str], row_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Parse de uma linha da tabela

        Formato esperado (colunas):
        0: Código
        1: Data
        2: Nota
        3: Série
        4: Espécie
        5: Código Fornecedor
        6: Fornecedor
        7: CFOP
        8: AC
        9: UF
        10: Valor Contábil
        """
        try:
            # Extrai valores das colunas
            codigo = str(row[0] or "").strip()
            data = str(row[1] or "").strip()
            nota = str(row[2] or "").strip()
            fornecedor = str(row[6] or "").strip()
            valor = str(row[10] or "").strip()

            # Ignora linhas de imposto/total
            if self._is_tax_or_total_line(codigo, fornecedor):
                return None

            # Validações básicas
            if not codigo or not codigo.isdigit():
                return None

            if len(codigo) > 5:  # Código deve ter no máximo 5 dígitos
                return None

            if not data or "/" not in data:
                return None

            if not fornecedor or len(fornecedor) < 3:
                return None

            # Limpa fornecedor
            fornecedor = self._clean_supplier_name(fornecedor)

            # Cria entry
            entry = {
                "codigoFornecedor": codigo,
                "fornecedor": clean_supplier_name(fornecedor),
                "data": clean_date(data),
                "notaSerie": nota if nota else "N/A",
                "valorContabil": clean_monetary_value(valor),
                "valor": clean_monetary_value(valor),
                "posicao": f"Pág {page_num}, Linha {row_num}",
            }

            return entry

        except Exception as e:
            print(f"⚠️ Erro ao processar linha {row_num}: {e}")
            return None

    def _clean_supplier_name(self, name: str) -> str:
        """Limpa nome do fornecedor"""
        # Remove CPF/CNPJ
        name = re.sub(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", "", name)  # CNPJ
        name = re.sub(r"\d{3}\.\d{3}\.\d{3}-\d{2}", "", name)  # CPF
        name = re.sub(r"\d{11,14}", "", name)  # CPF/CNPJ sem formatação

        # Remove espaços múltiplos
        name = re.sub(r"\s+", " ", name).strip()

        return name

    def _is_tax_or_total_line(self, codigo: str, fornecedor: str) -> bool:
        """Verifica se é linha de imposto ou total"""
        # Linhas de imposto começam com número pequeno ou texto
        if codigo and len(codigo) <= 2 and codigo.isdigit():
            return True

        # Verifica termos de imposto
        for tax_term in self.tax_lines:
            if tax_term.lower() in fornecedor.lower():
                return True

        return False

    def _extract_with_regex(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Estratégia de fallback: regex (para PDFs com texto bem formatado)
        """
        text = page.extract_text()
        if not text:
            return []

        entries = []
        lines = text.split("\n")

        # Padrão regex simplificado
        pattern = r"^(\d{3,5})\s+(\d{2}/\d{2}/\d{4})\s+(\d{8,})\s+.*?([A-ZÀ-Ú][A-ZÀ-Úa-z\s\.\-&']{5,}?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)"

        for idx, line in enumerate(lines):
            if self._is_non_data_line(line):
                continue

            match = re.search(pattern, line, re.IGNORECASE)

            if match:
                codigo, data, nota, fornecedor, valor = match.groups()

                entry = {
                    "codigoFornecedor": codigo.strip(),
                    "fornecedor": clean_supplier_name(
                        self._clean_supplier_name(fornecedor)
                    ),
                    "data": clean_date(data),
                    "notaSerie": nota.strip(),
                    "valorContabil": clean_monetary_value(valor),
                    "valor": clean_monetary_value(valor),
                    "posicao": f"Pág {page_num}, Linha {idx}",
                }

                if self._is_valid_entry(entry):
                    entries.append(entry)

        return entries

    def _is_non_data_line(self, line: str) -> bool:
        """Identifica linhas que não são dados"""
        non_data_patterns = [
            r"^total",
            r"^subtotal",
            r"^página",
            r"^emissão",
            r"^sistema licenciado",
            r"^cnpj",
            r"^insc\s+est",
            r"^período",
            r"^hora",
            r"acompanhamento\s+de\s+entradas",
            r"^código.*data.*nota",
            r"^\s*$",
        ]

        line_lower = line.lower().strip()

        if len(line_lower) < 10:
            return True

        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se a entrada é válida"""
        if not entry:
            return False

        # Fornecedor
        fornecedor = entry.get("fornecedor", "")
        if not fornecedor or fornecedor == "Desconhecido" or len(fornecedor) < 3:
            return False

        # Valor
        valor = entry.get("valorContabil", "0,00")
        if valor in ["0", "0,00", "0.00", "", "Não é um valor: 0,00"]:
            return False

        # Data
        if not entry.get("data"):
            return False

        return True

    def extract_raw_text(self, pdf_path: str) -> str:
        """Extrai texto bruto do PDF (para debug)"""
        with pdfplumber.open(pdf_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
