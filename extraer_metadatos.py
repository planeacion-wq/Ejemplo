#!/usr/bin/env python3
"""
Extrae títulos y metadatos de una lista de videos de YouTube usando la
YouTube Data API v3 y los guarda en CSV y JSON.

Uso:
    export YT_API_KEY="tu_api_key"
    python3 extraer_metadatos.py enlaces.txt

Donde enlaces.txt contiene un enlace de YouTube por línea.
"""
import os
import re
import sys
import json
import csv
from urllib.parse import urlparse, parse_qs

import requests

API_URL = "https://www.googleapis.com/youtube/v3/videos"


def extraer_id(url: str):
    """Devuelve el ID de un video de YouTube a partir de varias formas de URL."""
    url = url.strip()
    if not url:
        return None
    # youtu.be/<id>
    m = re.match(r"https?://youtu\.be/([\w-]{11})", url)
    if m:
        return m.group(1)
    # youtube.com/watch?v=<id>
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc:
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]
        # /shorts/<id>, /embed/<id>, /v/<id>
        m = re.search(r"/(shorts|embed|v)/([\w-]{11})", parsed.path)
        if m:
            return m.group(2)
    # Como último recurso, busca un patrón de 11 caracteres
    m = re.search(r"([\w-]{11})", url)
    return m.group(1) if m else None


def iso8601_a_hms(duracion: str) -> str:
    """Convierte una duración ISO8601 (PT1H2M3S) a HH:MM:SS."""
    if not duracion:
        return ""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duracion)
    if not m:
        return duracion
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    if h:
        return f"{h}:{mi:02d}:{s:02d}"
    return f"{mi}:{s:02d}"


def lotes(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def main():
    api_key = os.environ.get("YT_API_KEY")
    if not api_key:
        sys.exit("ERROR: define la variable de entorno YT_API_KEY con tu API key.")

    if len(sys.argv) < 2:
        sys.exit("Uso: python3 extraer_metadatos.py enlaces.txt")

    with open(sys.argv[1], encoding="utf-8") as f:
        urls = [ln.strip() for ln in f if ln.strip()]

    # Mapea ID -> URL original (preservando orden y detectando inválidos)
    ids = []
    invalidos = []
    id_a_url = {}
    for u in urls:
        vid = extraer_id(u)
        if vid:
            ids.append(vid)
            id_a_url.setdefault(vid, u)
        else:
            invalidos.append(u)

    if invalidos:
        print(f"[!] {len(invalidos)} enlaces no reconocidos:", *invalidos, sep="\n  ")

    print(f"[i] {len(ids)} IDs de video a consultar.")

    videos = []
    for lote in lotes(ids, 50):  # la API permite hasta 50 IDs por llamada
        params = {
            "key": api_key,
            "id": ",".join(lote),
            "part": "snippet,contentDetails,statistics",
        }
        r = requests.get(API_URL, params=params, timeout=30)
        if r.status_code != 200:
            sys.exit(f"ERROR API {r.status_code}: {r.text}")
        data = r.json()
        for item in data.get("items", []):
            sn = item.get("snippet", {})
            cd = item.get("contentDetails", {})
            st = item.get("statistics", {})
            videos.append({
                "id": item["id"],
                "url": id_a_url.get(item["id"], f"https://youtu.be/{item['id']}"),
                "titulo": sn.get("title", ""),
                "canal": sn.get("channelTitle", ""),
                "publicado": sn.get("publishedAt", "")[:10],
                "duracion": iso8601_a_hms(cd.get("duration", "")),
                "vistas": st.get("viewCount", ""),
                "likes": st.get("likeCount", ""),
                "tags": ", ".join(sn.get("tags", [])),
                "descripcion": sn.get("description", "").replace("\n", " ").strip(),
            })

    # Reporta IDs que la API no devolvió (privados/eliminados)
    devueltos = {v["id"] for v in videos}
    faltantes = [vid for vid in ids if vid not in devueltos]
    if faltantes:
        print(f"[!] {len(faltantes)} videos no devueltos (privados/eliminados):",
              *faltantes, sep="\n  ")

    # Guarda JSON
    with open("metadatos.json", "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)

    # Guarda CSV
    campos = ["titulo", "canal", "duracion", "publicado", "vistas",
              "likes", "tags", "url", "descripcion"]
    with open("metadatos.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for v in videos:
            w.writerow(v)

    print(f"[OK] {len(videos)} videos extraídos -> metadatos.json y metadatos.csv")


if __name__ == "__main__":
    main()
