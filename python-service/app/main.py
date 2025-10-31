from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import tempfile
import os
from typing import Dict, Any
import traceback

from app.services.pdf_reader import PDFReader
from app.services.analyzer import DuplicateAnalyzer
from app.models import AnalysisResponse, AnalysisError

app = FastAPI(
    title="PDF Analysis Microservice",
    description="Serviço especializado em análise de duplicatas em lançamentos de notas fiscais",
    version="1.0.0",
)
FRONT_END_PRODUCTION = os.getenv("FRONT_END_PRODUCTION")
# CORS para integração com node.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:4000",
        str(FRONT_END_PRODUCTION),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pdf_reader = PDFReader()
analyzer = DuplicateAnalyzer()


@app.get("/")
async def root():
    """Health chek endpoit"""

    return {
        "status": "online",
        "service": "PDFAnalysis Microservice",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    """Endpoint de heath check detalhado"""

    return {"status": "healthy", "pdf_reader": "ready", "analyzer": "ready"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_pf(file: UploadFile = File(...)):
    """
    Analisa PDF e retorna duplicatas encontradas

    Args:
      file: Arquivo PDF enviado

    Returns:
      AnalysisResponse com dados estruturados e duplicatas
    """
    temp_path = None

    try:
        # validação do tipo de arquivo
        # if (
        #     not file.filename.lower().endswith(".pdf")
        #     or file.filename.lower().endswith(".docx")
        #     or file.filename.lower().endswith(".xlsx")
        #     or file.filename.lower().endswith(".txt")
        # ):
        #     raise HTTPException(
        #         status_code=400,
        #         detail="Apenas arquivos PDF, docx, xlsx e txt são suportados",
        #     )

        # passar tipo de arquivo que vai entrar na função
        file_extension = os.path.splitext(str(file.filename))[1]

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=file_extension
        ) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        print(f"Processando arquivo: {file.filename}")
        print(f"Tamanho: {len(content)} bytes")

        # ETAPA 1: Extração do PDF
        structured_data = pdf_reader.extract_from_pdf(temp_path)

        if not structured_data:
            raise HTTPException(
                status_code=422,
                detail="Não foi possível extrair dados estruturados do PDF",
            )

        print(f"✅ Extraídos {len(structured_data)} registros")

        # ETAPA 2: Análise de duplicatas
        analysis_result = analyzer.analyze_duplicates(structured_data)

        print(f"🎯 Análise concluída:")
        print(
            f"   - Duplicatas exatas: {analysis_result['summary']['duplicatasExatas']}"
        )
        print(
            f"   - Possíveis duplicatas: {analysis_result['summary']['possiveisDuplicatas']}"
        )
        print(f"   - Notas únicas: {analysis_result['summary']['notasUnicas']}")

        return JSONResponse(
            status_code=200,
            content={"success": True, "filename": file.filename, **analysis_result},
        )

    except HTTPException:
        raise

    except Exception as e:
        print(f"❌ Erro no processamento: {str(e)}")
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "type": type(e).__name__,
                "traceback": traceback.format_exc(),
            },
        )

    finally:
        # Cleanup
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception as e:
                print(f"⚠️ Erro ao remover arquivo temporário: {e}")


@app.post("/analyze/debug")
async def analyze_pdf_debug(file: UploadFile = File(...)):
    """
    Versão do debug que retorna dados brutos para diagnóstico
    """

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # extrai e retorna dadso brutos
        raw_text = pdf_reader.extract_raw_text(temp_path)
        structured_data = pdf_reader.extract_from_pdf(temp_path)

        return {
            "sucessess": True,
            "filename": file.filename,
            "raw_text_preview": (
                raw_text[:1000] + "..." if len(raw_text) > 1000 else raw_text
            ),
            "raw_text_length": len(raw_text),
            "structured_data_count": len(structured_data),
            "structured_data_sample": structured_data[:5] if structured_data else [],
            "lines_detected": len(raw_text.split("\n")),
        }

    except Exception as e:
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True, log_level="info")
