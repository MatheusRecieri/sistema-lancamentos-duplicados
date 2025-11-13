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
from concurrent.futures import ThreadPoolExecutor


class PDFReader:
    """
    Leitor de PDF robusto para múltiplas estratégias de extração.
    """

    def _init_(self):
        self.extraction_strategies = [
            self._extract_with_regex,
        ]

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extrai dados estruturados do PDF usando regex.
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
        Estratégia: extração via regex para PDFs sem estrutura tabular clara.
        """
        text = page.extract_text()
        if not text:
            return []

        entries = []
        lines = text.split("\n")

        # Padrão adaptado ao layout do PDF de "Entradas.pdf"
        pattern = re.compile(
            r"^\d{3,6}\s+\d{2}/\d{2}/\d{4}\s+(\d{2}/\d{2}/\d{4})\s+(\d+)\s+\d+\s+\d+\s*-\s*([A-Z0-9\s\.\-]+?)\s+\d-\d+[A-Z]{2}\s+([\d.,]+)",
            re.MULTILINE,
        )

        for idx, line in enumerate(lines):
            if self._is_non_data_line(line):
                continue

            match = re.search(pattern, line)
            if match:
                entry = self._build_entry_from_regex(match, line, idx, page_num)
                if entry and self._is_valid_entry(entry):
                    entries.append(entry)

        return entries

    def _build_entry_from_regex(
        self, match, original_line: str, line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """Constrói uma entrada válida a partir do regex."""
        try:
            data, nota, fornecedor, valor_contabil = match.groups()
        except Exception:
            return None

        return {
            "codigoFornecedor": "N/A",
            "fornecedor": clean_supplier_name(fornecedor.strip()),
            "data": clean_date(data),
            "notaSerie": str(nota).strip(),
            "valorContabil": clean_monetary_value(valor_contabil),
            "valor": clean_monetary_value(valor_contabil),
            "posicao": f"Pág {page_num}, Linha {line_num}",
        }

    def _is_non_data_line(self, line: str) -> bool:
        """Ignora linhas que não contêm dados relevantes."""
        non_data_patterns = [
            r"^total",
            r"^subtotal",
            r"^página",
            r"^emissão",
            r"sistema licenciado",
            r"^cnpj:",
            r"^insc\s+est:",
            r"acompanhamento\s+de",
            r"^\s*$",
        ]
        line_lower = line.lower().strip()
        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se a entrada extraída é plausível."""
        if not entry:
            return False

        if not entry.get("fornecedor") or entry["fornecedor"] == "Desconhecido":
            return False
        if not entry.get("data"):
            return False
        if entry.get("valorContabil", "0,00") == "0,00":
            return False
        if len(entry["fornecedor"]) < 3:
            return False

        return True
