import re
from patterns import patterns
from layout_parser import extract_with_layout


class PDFReader:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.layout_data = extract_with_layout(file_path)
        self.full_text = " ".join(block["text"] for block in self.layout_data)

    def extract_field(self, field_name: str):
        """
        Extrai o campo usando:
        1️⃣ Regex direta no texto completo.
        2️⃣ Fallback por proximidade no layout.
        """
        pattern = patterns.get(field_name)
        if not pattern:
            return None

        # 1️⃣ Tenta regex direta no texto bruto
        match = re.search(pattern, self.full_text, re.IGNORECASE)
        if match:
            return match.group(0).strip()

        # 2️⃣ Fallback — tenta por proximidade no layout
        for i, block in enumerate(self.layout_data):
            if field_name.lower() in block["text"].lower():
                # tenta capturar o texto mais próximo (mesma linha ou próxima)
                if i + 1 < len(self.layout_data):
                    nearby_text = self.layout_data[i + 1]["text"]
                    match = re.search(pattern, nearby_text, re.IGNORECASE)
                    if match:
                        return match.group(0).strip()
        return None

    def extract_all_fields(self):
        """
        Extrai todos os campos definidos em patterns.py.
        """
        results = {}
        for field in patterns.keys():
            results[field] = self.extract_field(field)
        return results


if __name__ == "__main__":
    pdf_path = "exemplo.pdf"  # caminho do seu PDF
    reader = PDFReader(pdf_path)
    dados = reader.extract_all_fields()

    print("\n=== RESULTADO EXTRAÍDO ===")
    for campo, valor in dados.items():
        print(f"{campo.capitalize()}: {valor}")
