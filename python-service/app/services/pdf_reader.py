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
    Leitor de PDF robusto para formato ACOMPANHAMENTO DE ENTRADAS
    """

    def __init__(self):
        """Inicializa configurações"""
        self.tax_keywords = [
            "ISS",
            "IRRF",
            "CRF",
            "INSS-RET",
            "ISS RET",
            "SUBTRI",
            "ICMS",
            "Total Fornecedor",
            "Total Geral",
            "Total CFOP",
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

                entries = self._extract_from_text(page, page_num)
                all_entries.extend(entries)

            print(f"🎯 Total extraído: {len(all_entries)} registros")
            return all_entries

    def _extract_from_text(self, page, page_num: int) -> List[Dict[str, Any]]:
        """
        Extração de texto com parse inteligente
        """
        text = page.extract_text()
        if not text:
            print("⚠️ Nenhum texto extraído")
            return []

        entries = []
        lines = text.split("\n")

        print(f"📝 Total de linhas: {len(lines)}")

        for idx, line in enumerate(lines):
            # Debug primeiras linhas
            if idx < 20:
                print(f"🔍 Linha {idx}: {line[:100]}")

            # Tenta extrair dados da linha
            entry = self._parse_line(line, idx, page_num)

            if entry and self._is_valid_entry(entry):
                print(
                    f"✅ Entry válida: {entry['fornecedor']} - R$ {entry['valorContabil']}"
                )
                entries.append(entry)

        print(f"📊 Extraídos {len(entries)} registros da página {page_num}")
        return entries

    def _parse_line(
        self, line: str, line_num: int, page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Parse de uma linha de texto

        Formato esperado:
        Código Data Nota ... Fornecedor ... Valor
        """
        # Ignora linhas vazias e muito curtas
        if not line or len(line.strip()) < 20:
            return None

        # Ignora cabeçalhos
        if self._is_header_line(line):
            return None

        # Ignora linhas de imposto/total
        if self._is_tax_or_total_line(line):
            print(f"⚠️ Linha de imposto/total ignorada: {line[:80]}")
            return None

        # Tenta extrair com regex
        # Padrão: Código (3-5 dígitos) + Data (DD/MM/YYYY) + Números + Texto(Fornecedor) + Valor
        patterns = [
            # Padrão 1: Código no início, data, nota longa, fornecedor, valor no final
            r"^(\d{3,5})\s*(\d{2}/\d{2}/\d{4})\s+(\d{6,})\s+.*?([A-ZÀ-Ú][A-ZÀ-Úa-z0-9\s\.\-&\'/]{8,}?)\s+([\d.,]+)\s*(?:ISS|ICMS|IRRF|CRF|$)",
            # Padrão 2: Mais flexível
            r"(\d{4,5})\s*(\d{2}/\d{2}/\d{4})\s+\d+.*?([A-ZÀ-Ú][A-ZÀ-Úa-z\s\-\.&]{10,})\s+([\d.,]{4,})",
            # Padrão 3: Captura fornecedor entre números
            r"(\d{4,5})\s+(\d{2}/\d{2}/\d{4})\s+\d+\s+\d+\s+\d+\s+\d+\s+([A-Z][A-Za-z\s\-\.&]{8,}?)\s+\d-\d+\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
        ]

        for pattern_idx, pattern in enumerate(patterns):
            match = re.search(pattern, line)

            if match:
                groups = match.groups()

                # Debug
                if pattern_idx == 0:
                    print(f"🎯 MATCH (Padrão {pattern_idx + 1}): {groups}")

                # Extrai campos
                if len(groups) >= 4:
                    codigo = groups[0]
                    data = groups[1]
                    fornecedor = groups[-2]  # Penúltimo grupo
                    valor = groups[-1]  # Último grupo
                    nota = groups[2] if len(groups) > 4 else "N/A"

                    # Limpa fornecedor
                    fornecedor = self._clean_supplier(fornecedor)

                    # Valida se parece um fornecedor válido
                    if len(fornecedor) < 5:
                        continue

                    # Cria entry
                    entry = {
                        "codigoFornecedor": codigo.strip(),
                        "fornecedor": clean_supplier_name(fornecedor),
                        "data": clean_date(data),
                        "notaSerie": nota if nota != "N/A" else "N/A",
                        "valorContabil": clean_monetary_value(valor),
                        "valor": clean_monetary_value(valor),
                        "posicao": f"Pág {page_num}, Linha {line_num}",
                    }

                    return entry

        return None

    def _clean_supplier(self, text: str) -> str:
        """Limpa nome do fornecedor"""
        # Remove números no final
        text = re.sub(r"\s+\d+\s*$", "", text)

        # Remove CFOP (formato X-XXX)
        text = re.sub(r"\s+\d-\d{3,4}.*$", "", text)

        # Remove CPF/CNPJ
        text = re.sub(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", "", text)
        text = re.sub(r"\d{3}\.\d{3}\.\d{3}-\d{2}", "", text)
        text = re.sub(r"\s+\d{8,}", "", text)

        # Remove UF no final (ex: MG, SP)
        text = re.sub(r"\s+[A-Z]{2}\s*$", "", text)

        # Remove espaços múltiplos
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def _is_header_line(self, line: str) -> bool:
        """Identifica cabeçalhos"""
        header_patterns = [
            r"código.*data.*nota",
            r"acompanhamento\s+de\s+entradas",
            r"^cnpj:",
            r"^insc\s+est:",
            r"^período:",
            r"^emissão:",
            r"^hora:",
            r"^página:",
        ]

        line_lower = line.lower().strip()
        return any(re.search(pattern, line_lower) for pattern in header_patterns)

    def _is_tax_or_total_line(self, line: str) -> bool:
        """Identifica linhas de imposto ou totais"""
        line_stripped = line.strip()

        # Se começa com termo de imposto
        for keyword in self.tax_keywords:
            if line_stripped.startswith(keyword):
                return True

        # Se tem apenas 1-2 dígitos no início seguido de termo de imposto
        if re.match(r"^\d{1,2}\s+(ISS|IRRF|CRF|INSS|ICMS|SUBTRI)", line_stripped):
            return True

        # Linhas com "Total"
        if "total" in line_stripped.lower():
            return True

        # Linha vazia ou do sistema
        if "sistema licenciado" in line_stripped.lower():
            return True

        return False

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida entrada"""
        if not entry:
            return False

        # Fornecedor
        fornecedor = entry.get("fornecedor", "")
        if not fornecedor or fornecedor == "Desconhecido" or len(fornecedor) < 5:
            print(f"   ❌ Fornecedor inválido: '{fornecedor}'")
            return False

        # Verifica se não é termo de imposto
        for keyword in self.tax_keywords:
            if keyword.lower() in fornecedor.lower():
                print(f"   ❌ Fornecedor é termo de imposto: '{fornecedor}'")
                return False

        # Valor
        valor = entry.get("valorContabil", "0,00")
        if valor in ["0", "0,00", "0.00", "", "Não é um valor: 0,00"]:
            print(f"   ❌ Valor inválido: '{valor}'")
            return False

        # Data
        data = entry.get("data", "")
        if not data or len(data) < 8:
            print(f"   ❌ Data inválida: '{data}'")
            return False

        # Código
        codigo = entry.get("codigoFornecedor", "")
        if not codigo or not codigo.isdigit() or len(codigo) > 5:
            print(f"   ❌ Código inválido: '{codigo}'")
            return False

        return True

    def extract_raw_text(self, pdf_path: str) -> str:
        """Extrai texto bruto do PDF (para debug)"""
        with pdfplumber.open(pdf_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
