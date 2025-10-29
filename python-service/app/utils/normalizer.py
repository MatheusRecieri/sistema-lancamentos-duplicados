import re
import unicodedata
from typing import Optional


#  normaliza texto
def normalize_text(text: str) -> str:
    """
    Normaliza o texto removendo acentos, convertendo para lowercase e padronizando espaçoes

    Args:

    text: Texto para normalizar

    Returns: texto normalizado
    """

    if not text:
        return ""

    # remove acentos
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")

    # lowercase
    text = text.lower()

    # Normaliza espaços
    text = re.sub(r"\s+", " ", text)

    # normaliza espaços
    text = re.sub(r"[^a-z0-9]\s", "", text)

    return text.strip()


def clean_monetary_value(value: str) -> str:
    """
    limpa  e formata o valor monetario para o padrão brasielito

    Atgs:
      value: valor a ser limpo
    Returns:
      valor formatado (Ex 1.500)
    """

    if not value:
        return "Não é um valor: 0,00"

    # Remove tudo exceto dígitos, vírgula e ponto
    clean_value = re.sub(r"[^\d,.]", "", str(value))

    if not clean_value:
        return "0,00"

    # detecta o formato
    # se tem ponto e virgula : 1500,00 (br) ou 1,500.00(us)

    if "." in clean_value and "," in clean_value:
        # verifica qual vem primeiro
        dot_pos = clean_value.index(".")
        comma_pos = clean_value.index(",")

        if dot_pos < comma_pos:
            clean_value = clean_value.replace(".", "").replace(",", ".")
        else:
            clean_value = clean_value.replace(".", "")

    elif "," in clean_value:
        clean_value = clean_value.replace(",", ".")

    # Converte para float e formata
    try:
        number = float(clean_value)
        # Formata com vírgula como separador decimal
        formatted = (
            f"{number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        )
        return formatted
    except ValueError:
        return "0,00"


def clean_date(date: str) -> str:
    """
    Limpa e formata data para padrão brasileiro DD/MM/YYYY

    Args:
        date: Data a ser limpa

    Returns:
        Data formatada (DD/MM/YYYY) ou string vazia se inválida
    """
    if not date:
        return ""

    # Extrai números da data
    date_match = re.search(r"(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})", str(date))

    if not date_match:
        return ""

    day, month, year = date_match.groups()

    # Padroniza
    day = day.zfill(2)
    month = month.zfill(2)

    # Converte ano de 2 dígitos para 4
    if len(year) == 2:
        year = "20" + year

    # Validação básica
    try:
        day_int = int(day)
        month_int = int(month)
        year_int = int(year)

        if not (1 <= day_int <= 31):
            return ""
        if not (1 <= month_int <= 12):
            return ""
        if not (1900 <= year_int <= 2100):
            return ""

        return f"{day}/{month}/{year}"

    except ValueError:
        return ""


def clean_supplier_name(name: str) -> str:
    """
    Limpa nome do fornecedor removendo termos legais redundantes

    Args:
        name: Nome do fornecedor

    Returns:
        Nome limpo
    """
    if not name:
        return "Desconhecido"

    # Remove termos legais comuns (mas preserva a identidade)
    # legal_terms = r'\b(LTDA|S\.?A\.?|ME|EPP|EIRELI)\b'
    # name = re.sub(legal_terms, '', name, flags=re.IGNORECASE)

    # Normaliza espaços
    name = re.sub(r"\s+", " ", name)

    return name.strip()[:100]  # Limita a 100 caracteres


def extract_document_number(text: str) -> Optional[str]:
    """
    Extrai número de documento (NF, Nota Fiscal, etc)

    Args:
        text: Texto para buscar número

    Returns:
        Número do documento ou None
    """
    patterns = [
        r"NF[\.\-\s]*(\d+)",
        r"NOTA[\.\-\s]*FISCAL[\.\-\s]*(\d+)",
        r"DOCUMENTO[\.\-\s]*(\d+)",
        r"(\d{6,})",  # Qualquer sequência de 6+ dígitos
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


def is_valid_cpf_cnpj(doc: str) -> bool:
    """
    Valida se string parece um CPF ou CNPJ

    Args:
        doc: Documento a validar

    Returns:
        True se parece válido
    """
    if not doc:
        return False

    # Remove caracteres não numéricos
    numbers = re.sub(r"\D", "", doc)

    # CPF: 11 dígitos
    # CNPJ: 14 dígitos
    return len(numbers) in [11, 14]
