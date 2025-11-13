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
    Leitor de PDF robusto e genérico — funciona com múltiplos formatos de notas.
    Detecta automaticamente o layout e tenta diferentes estratégias de regex.
    """

    def _init_(self):
        self.regex_patterns = [
            # 1️⃣ Formato completo (mais comum)
            re.compile(
                r"^\d{3,6}\s+\d{2}/\d{2}/\d{4}\s+(\d{2}/\d{2}/\d{4})\s+(\d+)\s+\d+\s+\d+\s*-\s*([A-Z0-9\s\.\-]+?)\s+\d-\d+[A-Z]{2}\s+([\d.,]+)",
                re.MULTILINE,
            ),
            # 2️⃣ Data - Nota - Fornecedor - Valor
            re.compile(
                r"(\d{2}/\d{2}/\d{2,4})\s+(\d+)\s+([A-ZÀ-Ú0-9\s\.\-]{3,})\s+([\d.,]+)",
                re.MULTILINE,
            ),
            # 3️⃣ Fornecedor - Data - Valor
            re.compile(
                r"([A-ZÀ-Ú][A-ZÀ-Úa-z0-9\s\.\-]{5,})\s+(\d{2}/\d{2}/\d{2,4})\s+([\d.,]+)",
                re.MULTILINE,
            ),
            # 4️⃣ Código - Data - Nota - Valor
            re.compile(
                r"^\d{3,6}\s+(\d{2}/\d{2}/\d{4})\s+(\d+)\s+([A-ZÀ-Ú\s\.\-]{3,})\s+([\d.,]+)",
                re.MULTILINE,
            ),
        ]

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extrai dados estruturados de qualquer PDF.
        """
        print(f"🔍 Iniciando extração do PDF: {pdf_path}")

        all_entries = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                print(f"📄 Processando página {page_num}/{len(pdf.pages)}")
                entries = self._extract_with_regex(page, page_num)
                all_entries.extend(entries)

        print(f"🎯 Total extraído: {len(all_entries)} registros")
        return all_entries

    def _extract_with_regex(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Estratégia: tentar vários regex até encontrar correspondências.
        """
        text = page.extract_text()
        if not text:
            return []

        entries = []
        lines = text.split("\n")

        for idx, line in enumerate(lines):
            if self._is_non_data_line(line):
                continue

            for pattern in self.regex_patterns:
                match = re.search(pattern, line)
                if match:
                    entry = self._build_entry_from_match(match, pattern, idx, page_num)
                    if entry and self._is_valid_entry(entry):
                        entries.append(entry)
                        break  # encontrou, não precisa testar outros padrões

        return entries

    def _build_entry_from_match(
        self, match, pattern, line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Cria o dicionário padronizado com base nos grupos encontrados.
        """
        groups = match.groups()
        entry = {
            "codigoFornecedor": "N/A",
            "fornecedor": "",
            "data": "",
            "notaSerie": "N/A",
            "valorContabil": "0,00",
            "valor": "0,00",
            "posicao": f"Pág {page_num}, Linha {line_num}",
        }

        try:
            # Adapta dinamicamente ao número de grupos
            if len(groups) == 4:
                # Padrão: data, nota, fornecedor, valor
                data, nota, fornecedor, valor = groups
                entry.update({
                    "fornecedor": clean_supplier_name(fornecedor.strip()),
                    "data": clean_date(data),
                    "notaSerie": nota.strip(),
                    "valorContabil": clean_monetary_value(valor),
                    "valor": clean_monetary_value(valor),
                })
            elif len(groups) == 3:
                # Padrão: fornecedor, data, valor
                fornecedor, data, valor = groups
                entry.update({
                    "fornecedor": clean_supplier_name(fornecedor.strip()),
                    "data": clean_date(data),
                    "valorContabil": clean_monetary_value(valor),
                    "valor": clean_monetary_value(valor),
                })
            else:
                # fallback genérico
                fornecedor = groups[-2] if len(groups) > 2 else ""
                valor = groups[-1]
                entry.update({
                    "fornecedor": clean_supplier_name(fornecedor.strip()),
                    "valorContabil": clean_monetary_value(valor),
                    "valor": clean_monetary_value(valor),
                })
        except Exception:
            return None

        return entry

    def _is_non_data_line(self, line: str) -> bool:
        """Ignora linhas que não contêm dados."""
        non_data_patterns = [
            r"^total",
            r"^subtotal",
            r"^página",
            r"^emissão",
            r"sistema licenciado",
            r"^cnpj",
            r"^insc\s+est",
            r"acompanhamento\s+de",
            r"^\s*$",
        ]
        line_lower = line.lower().strip()
        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se o registro é plausível."""
        if not entry:
            return False
        if not entry.get("fornecedor") or len(entry["fornecedor"]) < 3:
            return False
        if not entry.get("valorContabil") or entry["valorContabil"] in ["0", "0,00"]:
            return False
        return True