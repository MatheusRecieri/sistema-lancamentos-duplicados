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
    Leitor de PDF robusto para múltiplas estratégias de extração
    """

    def __init__(self):
        """Inicializa os padrões de regex otimizados"""
        self.regex_patterns = [
            # Padrão 1: Formato completo do seu PDF
            # Código - Data - Nota - Espécie(ignora) - CódForn(ignora) - Fornecedor - CFOP - AC - UF - Valor
            {
                "pattern": r"(\d{1,4})\s+(\d{2}/\d{2}/\d{4})\s+(\d{10,})\s+\d{1,3}\s+\d{1,3}\s+([A-Z0-9][\w\s\-\.]+?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
            # Padrão 2: Com ano curto (DD/MM/AA)
            {
                "pattern": r"(\d{1,4})\s+(\d{2}/\d{2}/\d{2,4})\s+(\d{10,})\s+\d{1,3}\s+\d{1,3}\s+([A-Z0-9][\w\s\-\.]+?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
            # Padrão 3: Sem código (fallback)
            {
                "pattern": r"(\d{2}/\d{2}/\d{2,4})\s+(\d{10,})\s+([A-ZÀ-Ú0-9\s\.\-]{5,}?)\s+([\d.,]+)",
                "groups": ["data", "nota", "fornecedor", "valor"],
            },
            # Padrão 4: Muito flexível (último recurso)
            {
                "pattern": r"(\d{1,4})\s+(\d{2}/\d{2}/\d{2,4})\s+(\d{8,})\s+.*?([A-Z]{2,}[\w\s\-\.]{3,}?)\s+.*?[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
        ]

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extrai dados estruturados do PDF

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
                entries = self._extract_with_regex(page, page_num)
                all_entries.extend(entries)

            print(f"🎯 Total extraído: {len(all_entries)} registros")
            return all_entries

    def _extract_with_regex(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Estratégia principal: Extração via regex
        """
        text = page.extract_text()
        if not text:
            print("⚠️ Nenhum texto extraído da página")
            return []

        entries = []
        lines = text.split("\n")

        print(f"📝 Total de linhas: {len(lines)}")

        for idx, line in enumerate(lines):
            # Debug: mostra primeiras 10 linhas
            if idx < 10:
                print(f"🔍 Linha {idx}: {line[:120]}")

            if self._is_non_data_line(line):
                continue

            # Tenta cada padrão de regex
            for pattern_dict in self.regex_patterns:
                try:
                    match = re.search(pattern_dict["pattern"], line, re.IGNORECASE)

                    if match:
                        print(f"✅ MATCH na linha {idx}!")
                        print(f"   Grupos capturados: {match.groups()}")

                        entry = self._build_entry_from_match(
                            match, pattern_dict["groups"], idx, page_num
                        )

                        if entry and self._is_valid_entry(entry):
                            print(
                                f"✅ Entry válida: {entry['fornecedor']} - R$ {entry['valorContabil']}"
                            )
                            entries.append(entry)
                            break  # Encontrou, não precisa testar outros padrões
                        else:
                            print(f"⚠️ Entry inválida ou None")

                except Exception as e:
                    print(f"⚠️ Erro ao processar padrão: {e}")
                    continue

        print(f"📊 Extraídos {len(entries)} registros da página {page_num}")
        return entries

    def _build_entry_from_match(
        self, match, group_names: List[str], line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Constrói entrada a partir do match do regex
        """
        try:
            groups = match.groups()

            # Inicializa entry com valores padrão
            entry = {
                "codigoFornecedor": "N/A",
                "fornecedor": "",
                "data": "",
                "notaSerie": "N/A",
                "valorContabil": "0,00",
                "valor": "0,00",
                "posicao": f"Pág {page_num}, Linha {line_num}",
            }

            # Mapeia grupos capturados para campos
            for idx, field_name in enumerate(group_names):
                if idx >= len(groups):
                    break

                value = groups[idx]

                if field_name == "codigo":
                    entry["codigoFornecedor"] = value.strip()

                elif field_name == "data":
                    entry["data"] = clean_date(value)

                elif field_name == "nota":
                    entry["notaSerie"] = value.strip()

                elif field_name == "fornecedor":
                    # Limpa o fornecedor
                    fornecedor = value.strip()
                    # Remove números e caracteres do final
                    fornecedor = re.sub(r"[\d\s\-\.]+$", "", fornecedor).strip()
                    # Remove códigos que possam ter sido capturados
                    fornecedor = re.sub(r"\b\d+-\d+\b", "", fornecedor).strip()
                    entry["fornecedor"] = clean_supplier_name(fornecedor)

                elif field_name == "valor":
                    valor_limpo = clean_monetary_value(value)
                    entry["valorContabil"] = valor_limpo
                    entry["valor"] = valor_limpo

            return (
                entry
                if entry["fornecedor"] and entry["fornecedor"] != "Desconhecido"
                else None
            )

        except Exception as e:
            print(f"⚠️ Erro ao construir entry: {e}")
            return None

    def _is_non_data_line(self, line: str) -> bool:
        """Identifica linhas que não são dados"""
        non_data_patterns = [
            r"^total",
            r"^subtotal",
            r"^página",
            r"^emissão",
            r"sistema licenciado",
            r"^cnpj",
            r"^insc\s+est",
            r"acompanhamento\s+de",
            r"^código.*data.*nota",  # Cabeçalho
            r"^\s*$",  # Linha vazia
        ]

        line_lower = line.lower().strip()
        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se a entrada é válida"""
        if not entry:
            return False

        # Validações essenciais
        fornecedor = entry.get("fornecedor", "")
        if not fornecedor or fornecedor == "Desconhecido" or len(fornecedor) < 3:
            return False

        # Valor deve ser maior que zero
        valor = entry.get("valorContabil", "0,00")
        if valor in ["0", "0,00", "0.00", ""]:
            return False

        # Data deve existir
        if not entry.get("data"):
            return False

        return True

    def extract_raw_text(self, pdf_path: str) -> str:
        """Extrai texto bruto do PDF (para debug)"""
        with pdfplumber.open(pdf_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)

    # Métodos de table extraction (mantidos para compatibilidade)
    def _extract_with_table(self, page, page_num) -> List[Dict[str, Any]]:
        """Extração de tabelas"""
        tables = page.extract_tables()
        if not tables:
            return []

        entries = []
        for table in tables:
            if not table or len(table) < 2:
                continue

            header = table[0]
            col_map = self._map_columns(header)

            for row_idx, row in enumerate(table[1:], 1):
                if not row or len(row) < 3:
                    continue

                entry = self._parse_table_row(row, col_map, row_idx, page_num)
                if entry and self._is_valid_entry(entry):
                    entries.append(entry)

        return entries

    def _map_columns(self, header: List[str]) -> Dict[str, int]:
        """Mapeia colunas da tabela"""
        col_map = {}
        for idx, col in enumerate(header):
            if not col:
                continue
            col_lower = col.lower()
            if "código" in col_lower or "codigo" in col_lower:
                col_map["codigo"] = idx
            elif "fornecedor" in col_lower:
                col_map["fornecedor"] = idx
            elif "data" in col_lower:
                col_map["data"] = idx
            elif "nota" in col_lower:
                col_map["nota"] = idx
            elif "contabil" in col_lower:
                col_map["valor_contabil"] = idx
            elif "valor" in col_lower and "valor_contabil" not in col_map:
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
