import pymupdf as fitz
from typing import List, Dict, Any
from app.utils.normalizer import clean_date, clean_monetary_value, clean_supplier_name


class PDFReader:

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        print(f"🔍 Iniciando extração com PyMuPDF: {pdf_path}")
        doc = fitz.open(pdf_path)

        all_entries = []

        for page_num, page in enumerate(doc, 1):
            print(f"📄 Processando página {page_num}/{len(doc)}")

            words = page.get_text("words")  # [text, x1, y1, x2, y2]
            if not words:
                continue

            lines = self._group_words_by_line(words)
            columns = self._detect_columns(lines)

            entries = self._extract_entries(lines, columns, page_num)
            all_entries.extend(entries)

        print(f"🎯 Extração concluída. Total: {len(all_entries)} registros")
        return all_entries

    # ------------------------------
    # AGRUPAMENTO POR LINHA
    # ------------------------------
    def _group_words_by_line(self, words):
        lines = []
        current_line = []
        last_y = None

        for word in sorted(words, key=lambda w: (w[2], w[1])):  # ordena por Y depois X
            text, x1, y1, x2, y2 = word

            if last_y is None or abs(y1 - last_y) < 3:  # mesma linha
                current_line.append(word)
            else:
                lines.append(current_line)
                current_line = [word]

            last_y = y1

        if current_line:
            lines.append(current_line)

        return lines

    # ------------------------------
    # DETECTAR COLUNAS PELO X
    # ------------------------------
    def _detect_columns(self, lines):
        x_positions = []

        for line in lines:
            if not line:
                continue
            for word in line:
                x_positions.append(word[1])  # x1

        # clusterização básica pela distância
        x_positions = sorted(list(set(x_positions)))
        columns = []

        cluster = [x_positions[0]]
        for x in x_positions[1:]:
            if abs(x - cluster[-1]) < 30:  # tolerância
                cluster.append(x)
            else:
                columns.append(sum(cluster) / len(cluster))
                cluster = [x]

        if cluster:
            columns.append(sum(cluster) / len(cluster))

        columns.sort()
        return columns

    # ------------------------------
    # EXTRAÇÃO BASEADA EM COLUNAS
    # ------------------------------
    def _extract_entries(self, lines, columns, page_num):
        entries = []

        for line_index, words in enumerate(lines):
            # Ordenar por X
            words = sorted(words, key=lambda w: w[1])

            col_data = {i: [] for i in range(len(columns))}

            for word in words:
                text, x1, y1, x2, y2 = word

                # encontrar coluna mais próxima
                col_idx = min(range(len(columns)), key=lambda i: abs(x1 - columns[i]))
                col_data[col_idx].append(text)

            # monta linha
            entry = self._parse_line(col_data, page_num, line_index)

            if entry:
                entries.append(entry)

        return entries

    # ------------------------------
    # PARSE INTELIGENTE
    # ------------------------------
    def _parse_line(self, col_data, page_num, line_index):
        # montar as colunas em texto
        cols = {i: " ".join(col_data[i]) for i in col_data}

        # detectar campos (de forma tolerante)
        codigo = cols.get(0, "").strip()
        data = cols.get(1, "")
        nota = cols.get(2, "")
        fornecedor = cols.get(3, "")
        valor = cols.get(4, "")

        # validação mínima
        if not fornecedor or not any(char.isalpha() for char in fornecedor):
            return None
        if not any(char.isdigit() for char in valor):
            return None

        return {
            "codigoFornecedor": codigo,
            "fornecedor": clean_supplier_name(fornecedor),
            "data": clean_date(data),
            "notaSerie": nota,
            "valorContabil": clean_monetary_value(valor),
            "valor": clean_monetary_value(valor),
            "posicao": f"Pág {page_num}, Linha {line_index}",
        }
