import pandas as pd
import xlrd
from typing import List, Dict, Any


class ExcelReader:

    # def __init__(self):
    #     self.extract_excel_smart()

    def extract_excel_smart(self, file_path) -> List[Dict[str, Any]]:
        # Lê Excel
        df = pd.read_excel(file_path, sheet_name=0)

        # Detecta linha de cabeçalho
        header_row: int = 0
        idx = 0
        for idx, row in df.iterrows():
            row_text = " ".join(str(cell).lower() for cell in row if pd.notna(cell))
            if "código" in row_text or "fornecedor" in row_text:
                header_row = hash(idx)
                break

        # Relê com cabeçalho correto
        df = pd.read_excel(file_path, sheet_name=0, header=header_row)

        # Mapeia colunas
        col_map = {}
        for col in df.columns:
            col_lower = str(col).lower()  # FIX: Converte para string primeiro

            if "código" in col_lower or "codigo" in col_lower:
                col_map["codigo"] = col
            elif "fornecedor" in col_lower:
                col_map["fornecedor"] = col
            elif "data" in col_lower:
                col_map["data"] = col
            elif "nota" in col_lower or "nf" in col_lower:
                col_map["nota"] = col
            elif "contábil" in col_lower or "contabil" in col_lower:
                col_map["valor_contabil"] = col
            elif "valor" in col_lower:
                col_map["valor"] = col

        # Extrai dados
        entries = []
        for _, row in df.iterrows():
            if pd.isna(row.get(col_map.get("fornecedor"))):
                continue

            entry = {
                "codigoFornecedor": str(row.get(col_map.get("codigo"), "N/A")),
                "fornecedor": str(row.get(col_map.get("fornecedor"), "")),
                "data": str(row.get(col_map.get("data"), "")),
                "notaSerie": str(row.get(col_map.get("nota"), "N/A")),
                "valorContabil": str(
                    row.get(col_map.get("valor_contabil", col_map.get("valor")), "0,00")
                ),
                "valor": str(row.get(col_map.get("valor"), "0,00")),
            }
            entries.append(entry)

        return entries  # FIX: Retorna lista, não string
