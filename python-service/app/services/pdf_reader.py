import logging
from typing import List, Dict, Any, Tuple
import pymupdf as fitz  # já está funcionando no seu container
from app.utils.normalizer import clean_date, clean_monetary_value, clean_supplier_name

logger = logging.getLogger("pdf_reader")
logger.setLevel(logging.INFO)


class PDFReader:
    """
    Extração baseada em colunas com PyMuPDF (fitz).
    Retorna lista de dicionários com campos:
    codigoFornecedor, fornecedor, data, notaSerie, valorContabil, valor, posicao
    """

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        logger.info(f"🔍 Iniciando extração com PyMuPDF: {pdf_path}")
        doc = fitz.open(pdf_path)

        all_entries: List[Dict[str, Any]] = []

        for page_num, page in enumerate(doc, 1):
            logger.info(f"📄 Processando página {page_num}/{len(doc)}")
            try:
                words = page.get_text("words")  # pode ter 8 campos por word
            except Exception as e:
                logger.exception(
                    "❌ Falha ao obter words; tentando extract_text como fallback"
                )
                text = page.get_text()
                all_entries.extend(self._extract_from_plain_text(text, page_num))
                continue

            if not words:
                # fallback para texto puro (se existir)
                text = page.get_text().strip()
                if text:
                    all_entries.extend(self._extract_from_plain_text(text, page_num))
                continue

            # Agrupa sem perder coordenadas
            lines = self._group_words_by_line(words)

            # detecta colunas baseado em X das palavras (mantendo coordenadas)
            columns = self._detect_columns(lines)

            # extrai registros linha-a-linha
            entries = self._extract_entries(lines, columns, page_num)
            all_entries.extend(entries)

        logger.info(f"🎯 Extração concluída. Total: {len(all_entries)} registros")
        return all_entries

    # ------------------------------
    # Agrupa palavras por linha (mantendo (x, text))
    # ------------------------------
    def _group_words_by_line(self, words: List[List]) -> List[List[Tuple[float, str]]]:
        """
        words: lista de entradas do PyMuPDF page.get_text("words")
        Cada entrada normalmente: [x0, y0, x1, y1, "text", block_no, line_no, word_no]
        Retorna: [ [(x0, text), (x1, text), ...], ... ] ordenadas por y asc e x asc
        """
        lines_map = {}

        for w in words:
            # defensivo: w pode ter >5 elementos ou ser mal formatado
            try:
                # tenta descompactar a forma completa
                x0, y0, x1, y1, text, *rest = w
            except Exception:
                # se falhar, tenta conversão alternativa
                try:
                    # alguns formatos inesperados: tentar converter para lista de 5
                    w_list = list(w)
                    x0, y0, x1, y1, text = w_list[:5]
                except Exception:
                    logger.debug(f"Ignorando entrada de word inválida: {w}")
                    continue

            if not isinstance(text, str):
                text = str(text)

            # key agrupamento por Y arredondado (tolerância)
            y_key = round(float(y0), 1)
            if y_key not in lines_map:
                lines_map[y_key] = []

            lines_map[y_key].append((float(x0), text.strip()))

        # transformar em lista ordenada por Y e por X
        grouped_lines: List[List[Tuple[float, str]]] = []
        for y in sorted(lines_map.keys()):
            line_words = sorted(lines_map[y], key=lambda item: item[0])
            grouped_lines.append(line_words)

        return grouped_lines

    # ------------------------------
    # Detecta colunas por clusterização simples de X
    # ------------------------------
    def _detect_columns(self, lines: List[List[Tuple[float, str]]]) -> List[float]:
        """
        Recebe lines (cada linha = lista de (x, text))
        Retorna lista de X médios representando cada coluna, ordenada
        """
        x_positions = []

        # coletar apenas x's (primeiro palavra de cada grupo)
        for line in lines:
            if not line:
                continue
            for word in line:
                if not isinstance(word, tuple) or len(word) < 2:
                    continue
                x_positions.append(word[0])

        if not x_positions:
            return []

        x_positions = sorted(set(x_positions))

        # clusterização muito simples: junta valores próximos
        clusters = []
        cluster = [x_positions[0]]

        tolerance = 35  # ajuste: tolerância de distância em pixels
        for x in x_positions[1:]:
            if abs(x - cluster[-1]) <= tolerance:
                cluster.append(x)
            else:
                clusters.append(cluster)
                cluster = [x]
        if cluster:
            clusters.append(cluster)

        columns = [sum(c) / len(c) for c in clusters]
        columns.sort()
        logger.debug(f"Colunas detectadas (x centers): {columns}")
        return columns

    # ------------------------------
    # Extrai entradas usando colunas detectadas
    # ------------------------------
    def _extract_entries(
        self, lines: List[List[Tuple[float, str]]], columns: List[float], page_num: int
    ) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []

        # se não houver colunas detectadas, tenta heurística: última palavra é valor
        has_columns = bool(columns)

        for line_index, line in enumerate(lines):
            try:
                # mapear cada palavra para a coluna mais próxima
                col_data = {i: [] for i in range(max(1, len(columns)))}

                if has_columns:
                    for x, text in line:
                        # encontra coluna mais próxima
                        col_idx = min(
                            range(len(columns)), key=lambda i: abs(x - columns[i])
                        )
                        col_data[col_idx].append(text)
                else:
                    # sem colunas: tenta heurística simples
                    # última palavra -> valor, primeira -> código (se numérica), middle -> fornecedor
                    if not line:
                        continue
                    texts = [t for _, t in line]
                    codigo_try = texts[0] if texts and texts[0].isdigit() else "N/A"
                    valor_try = texts[-1] if texts else ""
                    fornecedor_try = (
                        " ".join(texts[1:-1])
                        if len(texts) > 2
                        else texts[1] if len(texts) == 2 else ""
                    )
                    entry = self._build_entry_from_parts(
                        codigo_try,
                        fornecedor_try,
                        texts[0],
                        valor_try,
                        page_num,
                        line_index,
                    )
                    if entry:
                        entries.append(entry)
                    continue

                # converter colunas para strings
                cols_text = {i: " ".join(col_data[i]).strip() for i in col_data}

                # heurística para mapear col index -> campo
                # Estratégia:
                # - coluna mais à esquerda pode ser código (numérica)
                # - coluna mais à direita tende a ser valor
                # - a maior (em comprimento) tende a ser fornecedor
                left = cols_text.get(0, "")
                right = cols_text.get(max(cols_text.keys()), "")
                middle_candidates = [
                    v
                    for k, v in cols_text.items()
                    if k not in (0, max(cols_text.keys()))
                ]

                fornecedor_guess = (
                    max(
                        middle_candidates
                        + [
                            cols_text.get(0, ""),
                            cols_text.get(max(cols_text.keys()), ""),
                        ],
                        key=lambda s: len(s),
                    )
                    if (middle_candidates or cols_text)
                    else ""
                )

                codigo_guess = (
                    left if any(c.isdigit() for c in left) and len(left) <= 8 else "N/A"
                )
                valor_guess = right if any(ch.isdigit() for ch in right) else ""

                # Se valor não encontrado à direita, procurar última coluna não vazia
                if not valor_guess:
                    for k in sorted(cols_text.keys(), reverse=True):
                        if cols_text[k] and any(c.isdigit() for c in cols_text[k]):
                            valor_guess = cols_text[k]
                            break

                # nota pode estar na coluna 1/2 — tentar extrair números longos
                nota_guess = ""
                for v in cols_text.values():
                    if v and len(v) > 3 and any(ch.isdigit() for ch in v):
                        # heurística: sequências longas com dígitos podem ser nota/serie
                        if (
                            len(v) >= 3
                            and len(v) <= 30
                            and any(ch.isdigit() for ch in v)
                        ):
                            nota_guess = v
                            break

                # fornecedor final
                fornecedor = fornecedor_guess

                entry = self._build_entry_from_parts(
                    codigo_guess,
                    fornecedor,
                    nota_guess,
                    valor_guess,
                    page_num,
                    line_index,
                )
                if entry:
                    entries.append(entry)

            except Exception as e:
                logger.exception(f"Erro tratando linha {line_index}: {e}")
                continue

        return entries

    # ------------------------------
    # Monta registro final (limpeza)
    # ------------------------------
    def _build_entry_from_parts(
        self, codigo, fornecedor, nota, valor_contabil, page_num, line_index
    ) -> Dict[str, Any] | None:
        # limpeza básica
        fornecedor_norm = clean_supplier_name(fornecedor) if fornecedor else ""
        data = ""  # Data pode não estar na mesma coluna; você pode estender para procurar por datas nas colunas
        valor_limpo = clean_monetary_value(valor_contabil) if valor_contabil else "0,00"

        # validações
        if not fornecedor_norm or len(fornecedor_norm) < 3:
            return None
        if valor_limpo == "0,00":
            # talvez seja um total ou linha inválida
            return None

        return {
            "codigoFornecedor": str(codigo).strip() if codigo else "N/A",
            "fornecedor": fornecedor_norm,
            "data": data,
            "notaSerie": str(nota).strip() if nota else "N/A",
            "valorContabil": valor_limpo,
            "valor": valor_limpo,
            "posicao": f"Pág {page_num}, Linha {line_index}",
        }

    # ------------------------------
    # Fallback: extrair a partir de texto puro (quando words não estão disponíveis)
    # ------------------------------
    def _extract_from_plain_text(
        self, text: str, page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Extrai via regex heurística apenas como fallback.
        Mantemos isso simples; preferível usar a extração posicional.
        """
        entries = []
        if not text:
            return entries

        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for idx, line in enumerate(lines):
            parts = line.split()
            # heurística mínima: procura por valor no final (contendo , ou .)
            if not parts:
                continue
            if any("," in p or "." in p for p in parts[-2:]):
                valor = parts[-1]
                fornecedor = " ".join(parts[:-2]) if len(parts) > 2 else parts[0]
                e = self._build_entry_from_parts(
                    "N/A", fornecedor, "N/A", valor, page_num, idx
                )
                if e:
                    entries.append(e)
        return entries
