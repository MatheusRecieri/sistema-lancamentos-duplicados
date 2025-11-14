from typing import List, Dict, Any, Set
from datetime import datetime
from rapidfuzz import fuzz
import unicodedata


class DuplicateAnalyzer:
    """
    Analisa duplicidades com matching exato e fuzzy
    """

    def __init__(self, similarity_threshold: float = 85.0):
        self.similarity_threshold = similarity_threshold

    # ============================================================
    # API PRINCIPAL
    # ============================================================
    def analyze_duplicates(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        print(f"🔍 Iniciando análise de {len(data)} registros...")

        valid = self._filter_valid(data)
        print(f"✅ {len(valid)} registros válidos")

        if not valid:
            return self._empty_result(len(data))

        processados = set()
        duplicatas_exatas = []
        duplicatas_fuzzy = []

        # --------------------------------------------------------
        # 1) EXATAS
        # --------------------------------------------------------
        exact_groups = self._group_exact(valid)

        for entries in exact_groups.values():
            if len(entries) > 1:
                duplicatas_exatas.append(
                    self._format_group(entries, "DUPLICATA_EXATA",
                                       "Fornecedor, data, nota e valor idênticos")
                )
                for e in entries:
                    processados.add(self._unique_key(e))

        # --------------------------------------------------------
        # 2) FUZZY
        # --------------------------------------------------------
        fuzzy_groups = self._group_fuzzy(valid, processados)

        for entries in fuzzy_groups.values():
            if len(entries) > 1:
                duplicatas_fuzzy.append(
                    self._format_group(entries, "POSSIVEL_DUPLICATA",
                                       "Fornecedor semelhante e valor igual")
                )
                for e in entries:
                    processados.add(self._unique_key(e))

        # --------------------------------------------------------
        # 3) NÃO DUPLICADOS
        # --------------------------------------------------------
        unicos = [
            e for e in valid if self._unique_key(e) not in processados
        ]

        print("📊 Concluído!")

        return {
            "summary": {
                "totalItensProcessados": len(data),
                "itensValidos": len(valid),
                "duplicatasExatas": len(duplicatas_exatas),
                "possiveisDuplicatas": len(duplicatas_fuzzy),
                "notasUnicas": len(unicos),
            },
            "duplicatas": duplicatas_exatas,
            "possiveisDuplicatas": duplicatas_fuzzy,
            "notasUnicas": unicos,
        }

    # ============================================================
    # VALIDAÇÃO
    # ============================================================
    def _filter_valid(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        valid = []

        for e in data:
            if not e:
                continue

            fornecedor = e.get("fornecedor", "").strip()
            data_emissao = e.get("data", "").strip()
            valor = e.get("valorContabil", "").strip()

            if not fornecedor or fornecedor == "Desconhecido":
                continue

            if not data_emissao:
                continue

            if valor in ("0", "0.00", "0,00"):
                continue

            valid.append(e)

        return valid

    # ============================================================
    # EXATO
    # ============================================================
    def _group_exact(self, entries):
        groups = {}

        for e in entries:
            key = self._exact_key(e)
            groups.setdefault(key, []).append(e)

        return groups

    def _exact_key(self, e):
        fornecedor = self._norm(e.get("fornecedor", ""))
        data = e.get("data", "")
        nota = str(e.get("notaSerie", "")).strip()
        valor = self._norm_valor(e.get("valorContabil", "0"))

        return f"{fornecedor}|{data}|{nota}|{valor}"

    # ============================================================
    # FUZZY
    # ============================================================
    def _group_fuzzy(self, entries, processados: Set[str]):
        groups = {}

        for e in entries:
            if self._unique_key(e) in processados:
                continue

            added = False

            for group in groups.values():
                ref = group[0]

                if self._is_similar(e, ref):
                    group.append(e)
                    added = True
                    break

            if not added:
                key = f"{self._norm(e['fornecedor'])}|{self._norm_valor(e['valorContabil'])}"
                groups.setdefault(key, []).append(e)

        return groups

    def _is_similar(self, a, b):
        """Fornecedor fuzzy + valor igual"""
        if self._norm_valor(a["valorContabil"]) != self._norm_valor(b["valorContabil"]):
            return False

        fa = self._norm(a["fornecedor"])
        fb = self._norm(b["fornecedor"])

        similarity = fuzz.ratio(fa, fb)

        return similarity >= self.similarity_threshold

    # ============================================================
    # FORMATAÇÃO
    # ============================================================
    def _format_group(self, entries, tipo, motivo):
        first = entries[0]

        return {
            "fornecedor": first.get("fornecedor", ""),
            "data": first.get("data", ""),
            "notaSerie": first.get("notaSerie", ""),
            "valorContabil": first.get("valorContabil", ""),
            "tipo": tipo,
            "motivo": motivo,
            "ocorrencias": len(entries),
            "chaveDuplicata": self._exact_key(first),
            "detalhes": [
                {
                    "posicao": e.get("posicao", ""),
                    "fornecedor": e.get("fornecedor", ""),
                    "data": e.get("data", ""),
                    "notaSerie": e.get("notaSerie", ""),
                    "valorContabil": e.get("valorContabil", ""),
                    "diferencaDias": self._diff_days(first.get("data"), e.get("data"))
                }
                for e in entries
            ]
        }

    # ============================================================
    # HELPERS
    # ============================================================
    def _unique_key(self, e):
        return self._exact_key(e)

    def _diff_days(self, d1, d2):
        try:
            d1 = datetime.strptime(d1, "%d/%m/%Y")
            d2 = datetime.strptime(d2, "%d/%m/%Y")
            return abs((d2 - d1).days)
        except:
            return 0

    def _norm(self, text: str):
        text = text.strip().lower()
        text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode()
        return text

    def _norm_valor(self, v: str) -> float:
        try:
            v = v.replace(".", "").replace(",", ".")
            return float(v)
        except:
            return 0.0

    def _empty_result(self, total):
        return {
            "summary": {
                "totalItensProcessados": total,
                "itensValidos": 0,
                "duplicatasExatas": 0,
                "possiveisDuplicatas": 0,
                "notasUnicas": 0,
            },
            "duplicatas": [],
            "possiveisDuplicatas": [],
            "notasUnicas": [],
        }
