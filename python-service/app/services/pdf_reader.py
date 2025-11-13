import re
import pdfplumber
from typing import List, Dict, Any


class PDFReader:
    def __init__(self):
        # Regex atualizado (sem capturar código do fornecedor)
        self.pattern = re.compile(
            r"(?P<codigo>\d{3,6})\s+[0-9,\.]+\s+[0-9,\.]+\s+\d{2}/\d{2}/\d{4}\s+(?P<nota>\d+)\s+\d+\s+\d+\s+[0-9,\.]+\s+[0-9,\.]+\s+[0-9,\.]+\s+\d{2}\.\d{3}\.\d{3}\s+(?P<fornecedor>[A-ZÀ-Úa-z0-9\s\.\-&]+?)\s+[A-Z]{2}\d{5}-\d{3}\s+(?P<valorContabil>[\d\.]+,\d{2})",
            re.MULTILINE
        )

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        results = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if not text:
                    continue
                for match in self.pattern.finditer(text):
                    results.append({
                        "codigo": match.group("codigo"),
                        "nota": match.group("nota"),
                        "fornecedor": match.group("fornecedor").strip(),
                        "valorContabil": match.group("valorContabil"),
                        "pagina": page_num,
                    })
        return results


# Exemplo de uso:
if __name__ == "__main__":
    reader = PDFReader()
    data = reader.extract_from_pdf("Entradas-teste3.pdf")
    for item in data[:10]:  # Mostra os 10 primeiros resultados
        print(item)
