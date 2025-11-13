from langchain.llms import Ollama

llm = Ollama(model="llama3")


def ai_extract_fields(text):
    prompt = f"""
    Extraia os seguintes campos deste texto e devolva em JSON:
    - Código
    - Data
    - Nota
    - Fornecedor

    Texto:
    {text}
    """
    return llm.invoke(prompt)
