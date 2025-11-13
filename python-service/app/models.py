patterns = {
    "codigo": r"(?<=Código\s*[:\-]?\s*)\d+",
    "data": r"\b\d{2}/\d{2}/\d{4}\b",
    "nota": r"(?<=Nota\s*(Fiscal|de\s*Série)?\s*[:\-]?\s*)\w+",
    "fornecedor": r"(?<=Fornecedor\s*[:\-]?\s*)[A-Z\s]+",
}
