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
    Leitor de PDF robusto e específico para formato ACOMPANHAMENTO DE ENTRADAS
    """

    def __init__(self):
        """Inicializa os padrões de regex otimizados para o formato do PDF"""
        self.regex_patterns = [
            # Padrão 1: COMPLETO - Formato exato do PDF
            # Código Data Nota Série Espécie CódForn Fornecedor CFOP AC UF Valor
            {
                "pattern": r"^(\d{3,5})\s+(\d{2}/\d{2}/\d{4})\s+(\d{8,})\s+\d+\s+\d+\s+\d+\s+(.+?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
            # Padrão 2: SEM SÉRIE - Alguns registros não têm série
            {
                "pattern": r"^(\d{3,5})\s+(\d{2}/\d{2}/\d{4})\s+(\d{8,})\s+\d+\s+(.+?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
            # Padrão 3: FLEXÍVEL - Captura mesmo com espaçamento irregular
            {
                "pattern": r"(\d{3,5})\s+(\d{2}/\d{2}/\d{4})\s+(\d{8,})\s+.*?([A-ZÀ-Ú][A-ZÀ-Úa-z\s\.\-&']+?)\s+\d-\d{3,4}\s+\d+\s+[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
            # Padrão 4: MUITO FLEXÍVEL - Último recurso
            {
                "pattern": r"(\d{3,5})\s+(\d{2}/\d{2}/\d{4})\s+(\d{6,})\s+.*?([A-Z]{2,}[\w\s\.\-&']{3,40}?)\s+.*?[A-Z]{2}\s+([\d.,]+)",
                "groups": ["codigo", "data", "nota", "fornecedor", "valor"],
            },
        ]

        # Linhas de imposto/subtotal que devem ser ignoradas
        self.tax_lines = ["ISS", "IRRF", "CRF", "INSS-RET", "ISS RET", "SUBTRI", "ICMS"]

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
            # Debug: mostra primeiras 10 linhas e linhas com matches
            if idx < 10 or (idx < 50 and any(c.isdigit() for c in line[:10])):
                print(f"🔍 Linha {idx}: {line[:150]}")

            # Ignora linhas não relevantes
            if self._is_non_data_line(line):
                continue

            # Ignora linhas de imposto/subtotal
            if self._is_tax_line(line):
                print(f"⚠️ Linha de imposto ignorada: {line[:80]}")
                continue

            # Tenta cada padrão de regex
            for pattern_idx, pattern_dict in enumerate(self.regex_patterns):
                try:
                    match = re.search(pattern_dict["pattern"], line, re.IGNORECASE)

                    if match:
                        print(f"✅ MATCH (Padrão {pattern_idx + 1}) na linha {idx}!")
                        print(f"   Grupos: {match.groups()}")

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
                            print(f"⚠️ Entry inválida ou incompleta")

                except Exception as e:
                    print(f"⚠️ Erro ao processar padrão {pattern_idx + 1}: {e}")
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

                    # Remove espaços múltiplos
                    fornecedor = re.sub(r"\s+", " ", fornecedor)

                    # Remove números soltos no final
                    fornecedor = re.sub(r"\s+\d+$", "", fornecedor)

                    # Remove CFOP se foi capturado acidentalmente
                    fornecedor = re.sub(r"\s+\d-\d{3,4}.*$", "", fornecedor)

                    # Remove CPF/CNPJ se estiver no final
                    fornecedor = re.sub(r"\s+\d{11,14}$", "", fornecedor)
                    fornecedor = re.sub(
                        r"\s+\d{2,3}\.\d{3}\.\d{3}/\d{4}-\d{2}$", "", fornecedor
                    )

                    # Limpa espaços finais novamente
                    fornecedor = fornecedor.strip()

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
            r"^sistema licenciado",
            r"^cnpj",
            r"^insc\s+est",
            r"^período",
            r"^hora",
            r"acompanhamento\s+de\s+entradas",
            r"^código.*data.*nota",  # Cabeçalho
            r"^\s*$",  # Linha vazia
        ]

        line_lower = line.lower().strip()

        # Verifica se é linha vazia ou muito curta
        if len(line_lower) < 10:
            return True

        return any(re.match(pattern, line_lower) for pattern in non_data_patterns)

    def _is_tax_line(self, line: str) -> bool:
        """
        Identifica linhas de impostos/subtotais que não são notas
        Essas linhas começam com ISS, IRRF, CRF, etc.
        """
        line_stripped = line.strip()

        # Se a linha começa com um termo de imposto (não tem código antes)
        for tax_term in self.tax_lines:
            if line_stripped.startswith(tax_term):
                return True

        # Se tem apenas número pequeno no início (identificador de subtotal)
        # mas não é um código de nota válido (3-5 dígitos)
        if re.match(r"^\d{1,2}\s+[A-Z]{2,}", line_stripped):
            return True

        return False

    def _is_valid_entry(self, entry: Dict[str, Any]) -> bool:
        """Valida se a entrada é válida"""
        if not entry:
            return False

        # Validações essenciais
        fornecedor = entry.get("fornecedor", "")
        if not fornecedor or fornecedor == "Desconhecido" or len(fornecedor) < 3:
            print(f"   ❌ Fornecedor inválido: '{fornecedor}'")
            return False

        # Valor deve ser maior que zero
        valor = entry.get("valorContabil", "0,00")
        if valor in ["0", "0,00", "0.00", "", "Não é um valor: 0,00"]:
            print(f"   ❌ Valor inválido: '{valor}'")
            return False

        # Data deve existir
        if not entry.get("data"):
            print(f"   ❌ Data inválida ou ausente")
            return False

        # Nota deve existir
        if not entry.get("notaSerie") or entry["notaSerie"] == "N/A":
            print(f"   ❌ Nota inválida: '{entry.get('notaSerie')}'")
            return False

        return True

    def extract_raw_text(self, pdf_path: str) -> str:
        """Extrai texto bruto do PDF (para debug)"""
        with pdfplumber.open(pdf_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
