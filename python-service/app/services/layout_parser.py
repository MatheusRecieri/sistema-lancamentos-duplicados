import fitz


def extract_with_layout(file_path: str):
    """
    Extrai o texto do PDF junto com as coordenadas (x, y)
    para permitir análise de layout.
    """
    doc = fitz.open(file_path)
    layout_data = []

    for page_number, page in enumerate(doc, start=1):
        blocks = page.get_text("blocks")  # lista de blocos (x0, y0, x1, y1, text, ...)
        for b in blocks:
            x0, y0, x1, y1, text, *_ = b
            layout_data.append(
                {"page": page_number, "x": x0, "y": y0, "text": text.strip()}
            )
    return layout_data
