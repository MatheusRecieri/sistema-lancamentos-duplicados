import logging
import re
from typing import List, Dict, Any, Tuple, Optional
import pymupdf as fitz

# Fallback OCR imports (usados somente se precisar)
try:
    from pdf2image import convert_from_path
    import pytesseract
    from PIL import Image

    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

from app.utils.normalizer import clean_date, clean_monetary_value, clean_supplier_name

logger = logging.getLogger("pdf_reader")
logger.setLevel(logging.INFO)


class PDFReader:
    """
    PDFReader robusto para extração posicional por colunas usando PyMuPDF (fitz).
    - Agrupa palavras por linha (mantendo coordenadas)
    - Detecta colunas por cluster em X
    - Heurísticas para mapear colunas a campos (codigo, data, nota, fornecedor, valor)
    - Fallbacks: texto simples e OCR (opcional)
    Saída: lista de dicts com chaves:
      codigoFornecedor, fornecedor, data, notaSerie, valorContabil, valor, posicao
    """

    DATE_REGEX = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")
    MONETARY_REGEX = re.compile(r"\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2}")
    NOTE_LIKE_REGEX = re.compile(r"[Nn][Ff]?\.?\s*[:\-]?\s*(\d+)|\b(\d{5,20})\b")
    # CF examples: long numeric sequences between 5 and 20 digits - heuristic for nota
    # Adjust thresholds as needed for seus PDFs

    def __init__(self, tolerance: int = 35):
        """
        tolerance: pixel tolerance para agrupar x's em uma mesma coluna
        """
        self.tolerance = tolerance

    # -------------------------
    # Interface principal
    # -------------------------
    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        logger.info(f"🔍 Iniciando extração com PyMuPDF: {pdf_path}")
        doc = fitz.open(pdf_path)
        all_entries: List[Dict[str, Any]] = []

        for page_num, page in enumerate(doc, start=1):
            logger.info(f"📄 Processando página {page_num}/{len(doc)}")
            try:
                words = page.get_text(
                    "words"
                )  # normalmente [x0,y0,x1,y1,text,block,line,wordno]
            except Exception as e:
                logger.exception(
                    "Falha ao obter words da página, tentando fallback textual"
                )
                text = page.get_text()
                all_entries.extend(self._extract_from_plain_text(text, page_num))
                continue

            # se words vazio -> tentar fallback texto e OCR
            if not words:
                text = page.get_text().strip()
                if text:
                    all_entries.extend(self._extract_from_plain_text(text, page_num))
                else:
                    # tenta OCR, se disponível
                    if OCR_AVAILABLE:
                        logger.info(
                            "Nenhum texto extraído — tentando OCR (pdf2image + pytesseract)"
                        )
                        ocr_text = self._ocr_pdf_page(pdf_path, page_num)
                        all_entries.extend(
                            self._extract_from_plain_text(ocr_text, page_num)
                        )
                    else:
                        logger.warning("Nenhum texto e OCR não disponível.")
                continue

            # Agrupar mantendo coordenadas
            grouped_lines = self._group_words_by_line(words)
            if not grouped_lines:
                logger.debug("Nenhuma linha agrupada; pulando página")
                continue

            # detectar colunas
            columns = self._detect_columns(grouped_lines)
            # extrair registros
            entries = self._extract_entries(grouped_lines, columns, page_num)
            # all_entries.extend(entries)

            print(grouped_lines)

        logger.info(f"🎯 Extração finalizada. Total registros: {len(all_entries)}")
        return all_entries

    # -------------------------
    # Agrupamento por linha
    # -------------------------
    def _group_words_by_line(self, words: List[List]) -> List[List[Tuple[float, str]]]:
        """
        words: lista de entradas de page.get_text("words")
        Cada entrada geralmente: [x0, y0, x1, y1, text, block_no, line_no, word_no]
        Retorna: lista de linhas; cada linha é lista de (x0, text) ordenados por x
        """
        lines_map = {}
        for w in words:
            # Desempacotamento defensivo
            try:
                x0, y0, x1, y1, text, *rest = w
            except Exception:
                try:
                    wlist = list(w)
                    x0, y0, x1, y1, text = wlist[:5]
                except Exception:
                    logger.debug(f"Ignorando word inválido: {w}")
                    continue

            if text is None:
                continue
            text = str(text).strip()
            if not text:
                continue

            y_key = round(float(y0), 1)
            lines_map.setdefault(y_key, []).append((float(x0), text))

        # ordenar por y crescente e por x
        grouped = []
        for y in sorted(lines_map.keys()):
            row = sorted(lines_map[y], key=lambda t: t[0])
            grouped.append(row)
        return grouped

    # -------------------------
    # Detectar colunas (cluster de X)
    # -------------------------
    def _detect_columns(self, lines: List[List[Tuple[float, str]]]) -> List[float]:
        """
        Recebe linhas (listas de (x, text)) e retorna os centros x das colunas detectadas
        Algoritmo: coleta todas posições x, ordena, agrupa em clusters por gap > tolerance
        """
        x_positions = []
        for line in lines:
            for x, _ in line:
                x_positions.append(x)
        if not x_positions:
            return []

        x_positions = sorted(set(x_positions))
        clusters = []
        cluster = [x_positions[0]]

        for x in x_positions[1:]:
            if abs(x - cluster[-1]) <= self.tolerance:
                cluster.append(x)
            else:
                clusters.append(cluster)
                cluster = [x]
        if cluster:
            clusters.append(cluster)

        columns = [sum(c) / len(c) for c in clusters]
        columns.sort()
        logger.debug(f"Colunas detectadas: {columns}")
        return columns

    # -------------------------
    # Extrair por linha usando colunas
    # -------------------------
    def _extract_entries(
        self, lines: List[List[Tuple[float, str]]], columns: List[float], page_num: int
    ) -> List[Dict[str, Any]]:
        entries = []
        has_columns = bool(columns)

        for idx, line in enumerate(lines):
            try:
                if has_columns:
                    # construir col_data: index -> list[str]
                    col_data = {i: [] for i in range(len(columns))}
                    for x, text in line:
                        # escolhe coluna mais próxima
                        col_idx = min(
                            range(len(columns)), key=lambda i: abs(x - columns[i])
                        )
                        col_data[col_idx].append(text)
                    # transformar em strings
                    cols_text = {i: " ".join(col_data[i]).strip() for i in col_data}
                    # mapear colunas para campos via heurística
                    mapped = self._map_columns_heuristic(cols_text)
                else:
                    # sem colunas detectadas: heurística simples por posição
                    texts = [t for _, t in line]
                    mapped = self._map_by_sequence(texts)

                # build entry from mapped results
                entry = self._build_entry_from_mapped(mapped, page_num, idx)
                if entry:
                    entries.append(entry)
            except Exception as e:
                logger.exception(f"Erro processando linha {idx}: {e}")
                continue

        return entries

    # -------------------------
    # Heurísticas de mapeamento
    # -------------------------
    def _map_columns_heuristic(self, cols_text: Dict[int, str]) -> Dict[str, str]:
        """
        Recebe cols_text: {col_idx: texto}
        Retorna dicionário mapeado: codigo, data, nota, fornecedor, valor
        Heurística:
         - coluna com maior ocorrência de datas -> data
         - coluna com maior ocorrência de valores (padrão monetário) -> valor
         - coluna com maior comprimento de texto (com letras) -> fornecedor
         - coluna à esquerda com dígitos curtos -> codigo
         - nota: sequência numérica longa ou token 'NF' em qualquer coluna
        """
        mapped = {"codigo": "", "data": "", "nota": "", "fornecedor": "", "valor": ""}

        if not cols_text:
            return mapped

        # detect helpers
        def has_date(s: str) -> bool:
            return bool(self.DATE_REGEX.search(s))

        def has_money(s: str) -> bool:
            return bool(self.MONETARY_REGEX.search(s))

        def candidate_note(s: str) -> Optional[str]:
            m = self.NOTE_LIKE_REGEX.search(s)
            if m:
                # return first non-empty capture
                g = next((grp for grp in m.groups() if grp), None)
                return g or m.group(0)
            return None

        # compute metrics per column
        metrics = {}
        for k, v in cols_text.items():
            metrics[k] = {
                "text": v,
                "len": len(v),
                "digits": sum(c.isdigit() for c in v),
                "letters": sum(c.isalpha() for c in v),
                "has_date": has_date(v),
                "has_money": has_money(v),
                "note_candidate": candidate_note(v),
            }

        # data column: prefer column with has_date True
        date_cols = [k for k in metrics if metrics[k]["has_date"]]
        if date_cols:
            # pick the one with most dates/len
            mapped["data"] = next(metrics[k]["text"] for k in date_cols)
        else:
            # try to find date-like token inside any column text (DD/MM/YYYY)
            for k in metrics:
                m = self.DATE_REGEX.search(metrics[k]["text"])
                if m:
                    mapped["data"] = m.group(0)
                    break

        # value column: prefer has_money True, else rightmost non-empty with digits
        value_cols = [k for k in metrics if metrics[k]["has_money"]]
        if value_cols:
            # choose the rightmost money column (higher k usually rightmost)
            chosen = sorted(value_cols)[-1]
            mapped["valor"] = metrics[chosen]["text"]
        else:
            # rightmost col with digits
            for k in sorted(metrics.keys(), reverse=True):
                if metrics[k]["digits"] > 0:
                    mapped["valor"] = metrics[k]["text"]
                    break

        # note detection: prefer note_candidate
        for k in metrics:
            if metrics[k]["note_candidate"]:
                mapped["nota"] = metrics[k]["note_candidate"]
                break

        # fornecedor: choose column with many letters and longest len (exclude value column)
        candidate_cols = [
            k for k in metrics if k != (max(metrics.keys()) if metrics else None)
        ]
        if candidate_cols:
            # score by letters and length
            scored = sorted(
                candidate_cols,
                key=lambda k: (metrics[k]["letters"], metrics[k]["len"]),
                reverse=True,
            )
            mapped["fornecedor"] = metrics[scored[0]]["text"]

        # codigo: leftmost column with digits and short length
        for k in sorted(metrics.keys()):
            text = metrics[k]["text"]
            if metrics[k]["digits"] > 0 and metrics[k]["len"] <= 8:
                mapped["codigo"] = text
                break

        # final cleanup: strip
        for k in mapped:
            if isinstance(mapped[k], str):
                mapped[k] = mapped[k].strip()

        return mapped

    def _map_by_sequence(self, texts: List[str]) -> Dict[str, str]:
        """
        Heurística quando não há colunas detectadas: baseada em sequência de tokens
        Assume formatos típicos:
          [codigo] [data] [nota] [fornecedor ...] [valor]
        We'll try to find date and last token as amount.
        """
        mapped = {"codigo": "", "data": "", "nota": "", "fornecedor": "", "valor": ""}

        if not texts:
            return mapped

        # detect date index
        date_idx = None
        for i, tok in enumerate(texts):
            if self.DATE_REGEX.search(tok):
                date_idx = i
                mapped["data"] = self.DATE_REGEX.search(tok).group(0)
                break

        # value likely last token containing comma/point
        for i in range(len(texts) - 1, -1, -1):
            if self.MONETARY_REGEX.search(texts[i]):
                mapped["valor"] = texts[i]
                value_idx = i
                break
        else:
            value_idx = None

        # codigo: first numeric small token
        for i, tok in enumerate(texts[:3]):
            if tok.isdigit() and len(tok) <= 8:
                mapped["codigo"] = tok
                break

        # nota: token near date (after date) or a long numeric token
        if date_idx is not None and date_idx + 1 < len(texts):
            mapped["nota"] = texts[date_idx + 1]
        else:
            for tok in texts:
                if re.fullmatch(r"\d{5,20}", tok):
                    mapped["nota"] = tok
                    break

        # fornecedor: tokens between nota (or date) and valor
        start = 1
        if mapped["codigo"]:
            try:
                start = texts.index(mapped["codigo"]) + 1
            except ValueError:
                start = 1

        end = value_idx if value_idx is not None else len(texts)
        # try to avoid including date and nota
        if date_idx is not None:
            start = max(start, date_idx + 1)
        mapped["fornecedor"] = " ".join(texts[start:end]).strip()

        return mapped

    # -------------------------
    # Construir entrada final
    # -------------------------
    def _build_entry_from_mapped(
        self, mapped: Dict[str, str], page_num: int, line_index: int
    ) -> Optional[Dict[str, Any]]:

        if self._is_header_line(mapped):
            return None

        codigo = mapped.get("codigo") or "N/A"
        fornecedor = mapped.get("fornecedor") or ""
        nota = mapped.get("nota") or "N/A"
        valor = mapped.get("valor") or ""
        data = mapped.get("data") or ""

        # Normalizar
        fornecedor_norm = clean_supplier_name(fornecedor) if fornecedor else ""
        data_norm = clean_date(data) if data else ""
        valor_norm = clean_monetary_value(valor) if valor else "0,00"

        # Validações: manter as mesmas do analyzer
        if not fornecedor_norm or fornecedor_norm == "Desconhecido":
            return None
        if not data_norm:
            # tentar buscar data dentro do fornecedor/note/other (segunda chance)
            any_text = " ".join([fornecedor, nota, valor])
            m = self.DATE_REGEX.search(any_text)
            if m:
                data_norm = clean_date(m.group(0))
        if valor_norm == "0,00":
            # tentar buscar valor em outros campos
            for fld in (
                mapped.get("fornecedor", ""),
                mapped.get("nota", ""),
                mapped.get("codigo", ""),
            ):
                mm = self.MONETARY_REGEX.search(fld)
                if mm:
                    valor_norm = clean_monetary_value(mm.group(0))
                    break

        if not fornecedor_norm or valor_norm == "0,00" or not data_norm:
            # não temos info mínima para ser considerada válida
            return None

        return {
            "codigoFornecedor": str(codigo).strip() if codigo else "N/A",
            "fornecedor": fornecedor_norm,
            "data": data_norm,
            "notaSerie": str(nota).strip() if nota else "N/A",
            "valorContabil": valor_norm,
            "valor": valor_norm,
            "posicao": f"Pág {page_num}, Linha {line_index}",
        }

    # -------------------------
    # Texto puro fallback (regex)
    # -------------------------
    def _extract_from_plain_text(
        self, text: str, page_num: int
    ) -> List[Dict[str, Any]]:
        entries = []
        if not text:
            return entries

        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for idx, line in enumerate(lines):
            # tenta extrair campos via regex heurístico:
            # data, nota, valor, fornecedor
            date_m = self.DATE_REGEX.search(line)
            valor_m = self.MONETARY_REGEX.search(line)
            nota_m = self.NOTE_LIKE_REGEX.search(line)

            if not valor_m or not date_m:
                # pouca chance de ser uma linha válida
                continue

            date = date_m.group(0)
            valor = valor_m.group(0)
            nota = (
                nota_m.group(1)
                if nota_m and nota_m.group(1)
                else (nota_m.group(2) if nota_m and nota_m.group(2) else "N/A")
            )

            # fornecedor: tudo entre date+nota e valor (heurística)
            try:
                before_val, _ = line.rsplit(valor, 1)
                after_date = before_val.split(date, 1)[-1]
                # remover nota se aparecer
                if nota and nota != "N/A":
                    after_date = after_date.replace(nota, "")
                fornecedor = after_date.strip()
            except Exception:
                fornecedor = ""

            e = self._build_entry_from_mapped(
                {
                    "codigo": "N/A",
                    "fornecedor": fornecedor,
                    "nota": nota,
                    "valor": valor,
                    "data": date,
                },
                page_num,
                idx,
            )
            if e:
                entries.append(e)

        return entries

    # -------------------------
    # OCR de página (opcional)
    # -------------------------
    def _ocr_pdf_page(self, pdf_path: str, page_number: int) -> str:
        """
        Converte página específica para imagem e roda pytesseract.
        page_number: 1-indexed
        """
        if not OCR_AVAILABLE:
            return ""

        try:
            images = convert_from_path(
                pdf_path, first_page=page_number, last_page=page_number, dpi=300
            )
            if not images:
                return ""
            img = images[0]
            text = pytesseract.image_to_string(img, lang="por")
            return text
        except Exception as e:
            logger.exception(f"OCR falhou para {pdf_path} page {page_number}: {e}")
            return ""

        # ---------------------------------------------------------

    # Detectar se a linha é cabeçalho — IGNORAR
    # ---------------------------------------------------------
    def _is_header_line(self, mapped: Dict[str, str]) -> bool:
        """
        Retorna True se a linha parecer um cabeçalho e não um item real.
        """

        text_joined = " ".join(mapped.values()).lower()

        # Palavras típicas de cabeçalho
        header_keywords = [
            "documento",
            "doc",
            "fornecedor",
            "descrição",
            "descricao",
            "valor",
            "contábil",
            "contabil",
            "nota",
            "serie",
            "série",
            "código",
            "codigo",
            "data",
            "entrada",
            "cfop",
            "controle",
            "loja",
            "cnpj",
        ]

        # Regra 1 — contém palavras de cabeçalho
        if any(k in text_joined for k in header_keywords):
            return True

        # Regra 2 — não tem números relevantes
        digits = sum(c.isdigit() for c in text_joined)
        if digits < 3:  # nenhum código, nota ou valor
            return True

        # Regra 3 — não tem valor monetário
        if not self.MONETARY_REGEX.search(text_joined):
            return True

        # Regra 4 — não tem fornecedor e nota ao mesmo tempo
        fornecedor = mapped.get("fornecedor", "")
        nota = mapped.get("nota", "")
        if len(fornecedor) < 3 and len(nota) < 3:
            return True

        # Se passou em tudo → não é cabeçalho
        return False
