#  modelos de dadosa

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class FinancialEntry(BaseModel):
    """Entrada financeira individual"""

    codigoFornecedor: str = Field(..., description="Código do fornecedor")
    fornecedor: str = Field(..., description="Nome do fornecedor")
    data: str = Field(..., description="Data no formato DD/MM/YYYY")
    notaSerie: str = Field(..., description="Número da nota fiscal")
    valorContabil: str = Field(..., description="Valor contábil")
    valor: str = Field(..., description="Valor total")
    posicao: Optional[str] = Field(None, description="Posição no arquivo original")


class DuplicateDetail(BaseModel):
    """Detalhe de uma ocorrência de duplicata"""

    posicao: str = Field(..., description="Posição no arquivo")
    codigoFornecedor: str
    fornecedor: str
    data: str
    notaSerie: str
    valorContabil: str
    diferencaDias: Optional[int] = Field(
        0, description="Diferença em dias da primeira ocorrência"
    )


class Duplicate(BaseModel):
    """Grupo de duplicatas"""

    codigoFornecedor: str
    fornecedor: str
    data: str
    notaSerie: str
    valorContabil: str
    valor: str
    tipo: str = Field(..., description="DUPLICATA_EXATA ou POSSIVEL_DUPLICATA")
    motivo: str = Field(..., description="Razão da duplicação")
    ocorrencias: int = Field(..., description="Número de ocorrências")
    chaveDuplicata: str = Field(..., description="Chave única da duplicata")
    detalhes: List[DuplicateDetail] = Field(default_factory=list)


class AnalysisSummary(BaseModel):
    """Resumo da análise"""

    totalItensProcessados: int = Field(..., description="Total de itens no arquivo")
    itensValidos: int = Field(..., description="Itens válidos processados")
    duplicatasExatas: int = Field(..., description="Número de duplicatas exatas")
    possiveisDuplicatas: int = Field(..., description="Número de possíveis duplicatas")
    notasUnicas: int = Field(..., description="Número de notas únicas")


class AnalysisResponse(BaseModel):
    """Resposta completa da análise"""

    success: bool = Field(True, description="Status da operação")
    filename: str = Field(..., description="Nome do arquivo analisado")
    summary: AnalysisSummary
    duplicatas: List[Duplicate] = Field(default_factory=list)
    possiveisDuplicatas: List[Duplicate] = Field(default_factory=list)
    notasUnicas: List[FinancialEntry] = Field(default_factory=list)


class AnalysisError(BaseModel):
    """Resposta de erro"""

    success: bool = Field(False)
    error: str = Field(..., description="Mensagem de erro")
    detail: Optional[Dict[str, Any]] = Field(None, description="Detalhes adicionais")
