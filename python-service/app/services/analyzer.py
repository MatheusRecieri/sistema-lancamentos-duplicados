from typing import List, Dict, Any, Set
from datetime import datetime
from rapidfuzz import fuzz
from app.utils.normalizer import normalize_text


class DuplicateAnalyzer:
    """
    Detector de duplicatas com match exato e fuzzy
    """

    def __init__(self, similarity_threshold: float = 85.0):
        self.similarity_threshold = similarity_threshold

    # ----------------------------------------------------------------------
    # API PRINCIPAL
    # ----------------------------------------------------------------------
    def analyze_duplicates(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        print(f"🔍 Iniciando análise de {len(data)} registros...")

        valid_entries = self._filter_valid_entries(data)
        print(f"✅ {len(valid_entries)} registros válidos")

        if not valid_entries:
            return self._empty_result(len(data))

        processados = set()
        duplicatas_exatas = []
        possiveis_duplicatas = []

        # -----------------------------
        # 1) DUPLICATAS EXATAS
        # -----------------------------
        exact_groups = self._group_by_exact_match(valid_entries)

        for key, entries in exact_groups.items():
            if len(entries) > 1:
                duplicatas_exatas.append(
                    self._format_group(entries, "DUPLICATA_EXATA",
                                       "Fornecedor, data, nota e valor idênticos")
                )
                for e in entries:
                    processados.add(self._unique_key(e))

        # -----------------------------
        # 2) POSSÍVEIS DUPLICATAS (FUZZY)
        # -----------------------------
        fuzzy_groups = self._group_by_similar_match(valid_entries, processados)

        for key, entries in fuzzy_groups.items():
            if len(entries) > 1:
                possiveis_duplicatas.append(
                    self._format_group(entries, "POSSIVEL_DUPLICATA",
                                       "Fornecedor semelhante e valor igual")
                )
                for e in entries:
                    processados.add(self._unique_key(e))

        # -----------------------------
        # 3) NOTAS ÚNICAS
        # -----------------------------
        notas_unicas = [
            e for e in valid_entries if self._unique_key(e) not in processados
        ]

        print("📊 Análise concluída!")
        print(f"   • Duplicatas exatas: {len(duplicatas_exatas)}")
        print(f"   • Possíveis duplicatas: {len(possiveis_duplicatas)}")
        print(f"   • Notas únicas: {len(notas_unicas)}")

        return {
            "summary": {
                "totalItensProcessados": len(data),
                "itensValidos": len(valid_entries),
                "duplicatasExatas": len(duplicatas_exatas),
                "possiveisDuplicatas": len(possiveis_duplicatas),
                "notasUnicas": len(notas_unicas)
            },
            "duplicatas": duplicatas_exatas,
            "possiveisDuplicatas": possiveis_duplicatas,
            "notasUnicas": notas_unicas
        }

    # ----------------------------------------------------------------------
    # ETAPA 0 - Validação
    # ----------------------------------------------------------------------
    def _filter_valid_entries(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        valid = []

        for e in data:
            if not e:
                continue

            valor = e.get("valorContabil", "0,00")
            fornecedor = e.get("fornecedor", "")
            data_emissao = e.get("data", "")

            if (
                fornecedor
                and fornecedor != "Desconhecido"
                and data_emissao
                and valor not in ("0", "0,00", "0.00")
            ):
                valid.append(e)

        return valid

    # ----------------------------------------------------------------------
    # ETAPA 1 - DUPLICATAS EXATAS
    # ----------------------------------------------------------------------
    def _group_by_exact_match(self, entries):
        groups = {}

        for e in entries:
            key = self._exact_key(e)
            groups.setdefault(key, []).append(e)

        return groups

    def _exact_key(self, e):
        fornecedor = normalize_text(e.get("fornecedor", ""))
        data = e.get("data", "")
        nota = str(e.get("notaSerie", "")).strip()
        valor = self._normalize_valor(e.get("valorContabil", "0,00"))

        return f"{fornecedor}|{data}|{nota}|{valor}"

    # ----------------------------------------------------------------------
    # ETAPA 2 - SIMILAR (FUZZY)
    # ----------------------------------------------------------------------
    def _group_by_similar_match(self, entries, processados):
        groups = {}

        for e in entries:
            if self._unique_key(e) in processados:
                continue

            fornecedor = normalize_text(e.get("fornecedor", ""))
            valor = self._normalize_valor(e.get("valorContabil", "0,00"))

            added = False

            for key, group in groups.items():
                ref = group[0]

                if self._is_similar(e, ref):
                    group.append(e)
                    added = True
                    break

            if not added:
                key = f"{fornecedor}|{valor}"
                groups[key] = [e]

        return groups

    def _is_similar(self, a, b):
        """Fornecedor parecido e valor igual"""
        valor_ok = self._normalize_valor(a["valorContabil"]) == self._normalize_valor(b["valorContabil"])
        if not valor_ok:
            return False

        fornecedor_a = normalize_text(a.get("fornecedor", ""))
        fornecedor_b = normalize_text(b.get("fornecedor", ""))

        similarity = fuzz.ratio(fornecedor_a, fornecedor_b)

        return similarity >= self.similarity_threshold

    # ----------------------------------------------------------------------
    # FORMATAÇÃO DO RELATÓRIO
    # ----------------------------------------------------------------------
    def _format_group(self, entries, tipo, motivo):
        first = entries[0]

        return {
            "fornecedor": first.get("fornecedor", ""),
            "data": first.get("data", ""),
            "notaSerie": first.get("notaSerie", "N/A"),
            "valorContabil": first.get("valorContabil", "0,00"),
            "tipo": tipo,
            "motivo": motivo,
            "ocorrencias": len(entries),
            "chaveDuplicata": self._exact_key(first),
            "detalhes": [
                {
                    "posicao": e.get("posicao", "N/A"),
                    "fornecedor": e.get("fornecedor", ""),
                    "data": e.get("data", ""),
                    "notaSerie": e.get("notaSerie", "N/A"),
                    "valorContabil": e.get("valorContabil", "0,00"),
                    "diferencaDias": self._diff_days(first.get("data"), e.get("data"))
                }
                for e in entries
            ]
        }

    # ----------------------------------------------------------------------
    # HELPERS
    # ----------------------------------------------------------------------
    def _unique_key(self, e):
        return self._exact_key(e)

    def _normalize_valor(self, v: str) -> float:
        v = v.replace(".", "").replace(",", ".")
        try:
            return float(v)
        except:
            return 0.0

    def _diff_days(self, d1, d2):
        try:
            d1 = datetime.strptime(d1, "%d/%m/%Y")
            d2 = datetime.strptime(d2, "%d/%m/%Y")
            return abs((d2 - d1).days)
        except:
            return 0

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
