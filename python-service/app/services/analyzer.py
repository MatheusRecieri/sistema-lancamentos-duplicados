from typing import List, Dict, Any, Set
from datetime import datetime
from rapidfuzz import fuzz
from app.utils.normalizer import normalize_text
from concurrent.futures import ProcessPoolExecutor


class DuplicateAnalyzer:
    """
    Analisador de duplicatas com comparação fuzzy e múltiplos critérios
    """

    def __init__(self, similarity_threshold: float = 85.0, max_workers: int = 4):
        """
        Args:
            similarity_threshold: Threshold para similaridade (0-100)
        """
        self.similarity_threshold = similarity_threshold
        self.max_workers = max_workers

    def analyze_duplicates(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analisa dados e identifica duplicatas

        Args:
            data: Lista de entradas financeiras

        Returns:
            Dicionário com duplicatas, possíveis duplicatas e resumo
        """
        print(f"🔍 Iniciando análise de {len(data)} registros...")

        # Validação
        valid_entries = self._filter_valid_entries(data)
        print(f"✅ {len(valid_entries)} registros válidos")

        if not valid_entries:
            return self._empty_result(len(data))

        # Análise
        duplicatas_exatas = []
        possiveis_duplicatas = []
        processados = set()

        # ETAPA 1: Duplicatas Exatas
        exact_groups = self._group_by_exact_match(valid_entries)

        for key, entries in exact_groups.items():
            if len(entries) > 1:
                # Marca como processados
                for entry in entries:
                    processados.add(self._create_unique_key(entry))

                duplicatas_exatas.append(
                    self._format_duplicate_group(
                        entries,
                        "DUPLICATA_EXATA",
                        "Mesmo fornecedor, data, nota e valor",
                    )
                )

        # ETAPA 2: Possíveis Duplicatas (com fuzzy matching)
        possible_groups = self._group_by_similar_match(valid_entries, processados)

        for key, entries in possible_groups.items():
            if len(entries) > 1:
                # Marca como processados
                for entry in entries:
                    processados.add(self._create_unique_key(entry))

                possiveis_duplicatas.append(
                    self._format_duplicate_group(
                        entries,
                        "POSSIVEL_DUPLICATA",
                        "Mesmo fornecedor e valor com pequenas variações",
                    )
                )

        # ETAPA 3: Notas únicas
        notas_unicas = [
            entry
            for entry in valid_entries
            if self._create_unique_key(entry) not in processados
        ]

        print(f"📊 Análise concluída:")
        print(f"   - Duplicatas exatas: {len(duplicatas_exatas)}")
        print(f"   - Possíveis duplicatas: {len(possiveis_duplicatas)}")
        print(f"   - Notas únicas: {len(notas_unicas)}")

        return {
            "summary": {
                "totalItensProcessados": len(data),
                "itensValidos": len(valid_entries),
                "duplicatasExatas": len(duplicatas_exatas),
                "possiveisDuplicatas": len(possiveis_duplicatas),
                "notasUnicas": len(notas_unicas),
            },
            "duplicatas": duplicatas_exatas,
            "possiveisDuplicatas": possiveis_duplicatas,
            "notasUnicas": notas_unicas,
        }

    def _filter_valid_entries(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filtra apenas entradas válidas"""
        valid = []

        for entry in data:
            if not entry:
                continue

            # Validações
            valor = entry.get("valorContabil", "0,00")
            fornecedor = entry.get("fornecedor", "")
            data_entry = entry.get("data", "")

            if (
                valor != "0,00"
                and fornecedor
                and fornecedor != "Desconhecido"
                and data_entry
            ):
                valid.append(entry)

        return valid

    def _group_by_exact_match(
        self, entries: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Agrupa por correspondência exata
        Chave: codigo_fornecedor|data|nota|valor
        """
        groups = {}

        for entry in entries:
            key = self._create_exact_key(entry)

            if key not in groups:
                groups[key] = []
            groups[key].append(entry)

        return groups

    def _group_by_similar_match(
        self, entries: List[Dict[str, Any]], processados: Set[str]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Agrupa por correspondência similar (fuzzy)
        Ignora registros já processados
        """
        groups = {}

        for entry in entries:
            # Pula se já foi processado
            if self._create_unique_key(entry) in processados:
                continue

            # Normaliza fornecedor e valor
            fornecedor_norm = normalize_text(entry.get("fornecedor", ""))
            valor = entry.get("valorContabil", "0,00")

            # Procura grupo similar existente
            found_group = False

            for existing_key, existing_entries in groups.items():
                # Compara com primeiro elemento do grupo
                ref_entry = existing_entries[0]
                ref_fornecedor_norm = normalize_text(ref_entry.get("fornecedor", ""))
                ref_valor = ref_entry.get("valorContabil", "0,00")

                # Verifica similaridade
                if self._is_similar(
                    fornecedor_norm, ref_fornecedor_norm, valor, ref_valor
                ):
                    existing_entries.append(entry)
                    found_group = True
                    break

            # Se não encontrou grupo similar, cria novo
            if not found_group:
                key = f"{fornecedor_norm}|{valor}"
                if key not in groups:
                    groups[key] = []
                groups[key].append(entry)

        return groups

    def _is_similar(
        self, fornecedor1: str, fornecedor2: str, valor1: str, valor2: str
    ) -> bool:
        """
        Verifica se dois registros são similares

        Critérios:
        - Fornecedor com similaridade >= threshold
        - Valor exatamente igual
        """
        # Valor deve ser exatamente igual

        # Fornecedor com fuzzy matching
        similarity = fuzz.ratio(fornecedor1, fornecedor2)

        if similarity == True:
            if valor1 != valor2:
                return False
            else:

                return similarity >= self.similarity_threshold

    def _create_exact_key(self, entry: Dict[str, Any]) -> str:
        """Cria chave para duplicata exata"""
        codigo = str(entry.get("codigoFornecedor", "N/A")).strip()
        data = entry.get("data", "")
        nota = str(entry.get("notaSerie", "N/A")).strip()
        valor = entry.get("valorContabil", "0,00")

        return f"{codigo}|{data}|{nota}|{valor}"

    def _create_unique_key(self, entry: Dict[str, Any]) -> str:
        """Cria chave única para rastreamento"""
        return self._create_exact_key(entry)

    def _format_duplicate_group(
        self, entries: List[Dict[str, Any]], tipo: str, motivo: str
    ) -> Dict[str, Any]:
        """Formata grupo de duplicatas"""
        first = entries[0]

        return {
            "codigoFornecedor": first.get("codigoFornecedor", "N/A"),
            "fornecedor": first.get("fornecedor", ""),
            "data": first.get("data", ""),
            "notaSerie": first.get("notaSerie", "N/A"),
            "valorContabil": first.get("valorContabil", "0,00"),
            "valor": first.get("valor", "0,00"),
            "tipo": tipo,
            "motivo": motivo,
            "ocorrencias": len(entries),
            "chaveDuplicata": self._create_exact_key(first),
            "detalhes": [
                {
                    "posicao": entry.get("posicao", "N/A"),
                    "codigoFornecedor": entry.get("codigoFornecedor", "N/A"),
                    "fornecedor": entry.get("fornecedor", ""),
                    "data": entry.get("data", ""),
                    "notaSerie": entry.get("notaSerie", "N/A"),
                    "valorContabil": entry.get("valorContabil", "0,00"),
                    "diferencaDias": self._calc_date_diff(
                        first.get("data"), first.get("data")
                    ),
                }
                for entry in entries
            ],
        }

    def _calc_date_diff(self, date1: str, date2: str) -> int:
        """Calcula diferença em dias entre duas datas"""

        try:
            d1 = datetime.strptime(date1, "%d/%m/%Y")
            d2 = datetime.strptime(date2, "%d/%m/%Y")
            return abs((d2 - d1).days)
        except:
            return 0

    def _empty_result(self, total: int) -> Dict[str, Any]:
        """Retorna resultado vazio"""
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
