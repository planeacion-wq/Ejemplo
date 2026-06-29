#!/usr/bin/env python3
"""
Clasifica los videos extraídos (metadatos.json) por TEMÁTICA y NIVEL
(básico / intermedio / avanzado) usando reglas de palabras clave.

Genera:
  - clasificacion.csv  : tabla con tema y nivel asignado a cada video
  - ruta_aprendizaje.md: borrador de ruta ordenada por nivel y tema

Uso:
    python3 clasificar_videos.py
"""
import json
import csv
import unicodedata
from collections import defaultdict


def normaliza(texto: str) -> str:
    """minúsculas y sin acentos, para matchear palabras clave."""
    texto = texto.lower()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c))


# --- Reglas de TEMÁTICA: orden importa (primera coincidencia gana) ---
TEMAS = [
    ("Fundamentos / Introducción a la IA",
     ["que es la ia", "introduccion", "fundamentos", "conceptos basicos",
      "historia de la ia", "para principiantes", "desde cero"]),
    ("Machine Learning",
     ["machine learning", "aprendizaje automatico", "regresion", "clasificacion",
      "supervisado", "no supervisado", "scikit", "sklearn", "random forest"]),
    ("Deep Learning / Redes Neuronales",
     ["deep learning", "red neuronal", "redes neuronales", "tensorflow",
      "pytorch", "keras", "backpropagation", "cnn", "rnn"]),
    ("LLMs / IA Generativa",
     ["llm", "gpt", "chatgpt", "transformer", "generativa", "prompt",
      "fine-tuning", "fine tuning", "rag", "embeddings", "langchain", "claude",
      "gemini", "difusion", "stable diffusion", "midjourney"]),
    ("Procesamiento de Lenguaje Natural (NLP)",
     ["nlp", "procesamiento de lenguaje", "lenguaje natural", "tokeniz",
      "sentiment", "spacy", "nltk"]),
    ("Visión por Computador",
     ["vision", "imagen", "opencv", "deteccion de objetos", "yolo",
      "reconocimiento facial"]),
    ("Datos / Python / Herramientas",
     ["python", "pandas", "numpy", "data science", "ciencia de datos",
      "estadistica", "matematicas", "algebra", "jupyter"]),
    ("Ética / Aplicaciones / Negocio",
     ["etica", "sesgo", "aplicaciones", "negocio", "empresa", "futuro",
      "impacto", "casos de uso"]),
]

# --- Reglas de NIVEL ---
NIVEL_BASICO = ["introduccion", "para principiantes", "desde cero", "basico",
                "que es", "fundamentos", "primeros pasos", "tutorial basico",
                "conceptos", "beginner", "explicado facil"]
NIVEL_AVANZADO = ["avanzado", "advanced", "fine-tuning", "fine tuning",
                  "transformer", "arquitectura", "optimizacion", "produccion",
                  "deploy", "mlops", "investigacion", "paper", "from scratch",
                  "implementa", "matematicas de"]
# todo lo demás cae en "intermedio"


def clasifica_tema(texto: str) -> str:
    for tema, claves in TEMAS:
        if any(k in texto for k in claves):
            return tema
    return "Sin clasificar"


def clasifica_nivel(texto: str) -> str:
    if any(k in texto for k in NIVEL_BASICO):
        return "Básico"
    if any(k in texto for k in NIVEL_AVANZADO):
        return "Avanzado"
    return "Intermedio"


def main():
    with open("metadatos.json", encoding="utf-8") as f:
        videos = json.load(f)

    for v in videos:
        base = normaliza(" ".join([v.get("titulo", ""),
                                    v.get("tags", ""),
                                    v.get("descripcion", "")[:300]]))
        v["tema"] = clasifica_tema(base)
        v["nivel"] = clasifica_nivel(base)

    # CSV de clasificación
    campos = ["titulo", "tema", "nivel", "duracion", "canal", "url"]
    with open("clasificacion.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for v in videos:
            w.writerow(v)

    # Ruta de aprendizaje en Markdown
    orden_nivel = ["Básico", "Intermedio", "Avanzado"]
    por_nivel = defaultdict(lambda: defaultdict(list))
    for v in videos:
        por_nivel[v["nivel"]][v["tema"]].append(v)

    with open("ruta_aprendizaje.md", "w", encoding="utf-8") as f:
        f.write("# Ruta de Aprendizaje de IA\n\n")
        f.write(f"_Generada automáticamente a partir de {len(videos)} videos._\n\n")
        for nivel in orden_nivel:
            if nivel not in por_nivel:
                continue
            f.write(f"## Nivel {nivel}\n\n")
            for tema in sorted(por_nivel[nivel]):
                f.write(f"### {tema}\n\n")
                for v in por_nivel[nivel][tema]:
                    dur = f" _({v['duracion']})_" if v.get("duracion") else ""
                    f.write(f"- [{v['titulo']}]({v['url']}){dur}\n")
                f.write("\n")

    print(f"[OK] {len(videos)} videos clasificados -> clasificacion.csv y ruta_aprendizaje.md")


if __name__ == "__main__":
    main()
