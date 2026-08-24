"""
PEG Portfolio Cloud API + PWA
Serves REST API and the mobile app from one service.
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
STATIC = ROOT / "static"

app = FastAPI(title="PEG Portfolio API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load(name: str) -> dict | list:
    path = DATA / name
    if not path.exists():
        raise HTTPException(404, f"Missing {name}")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/health")
def health():
    return {"ok": True, "service": "peg-portfolio"}


@app.get("/api/portfolio")
def portfolio():
    return _load("app.json")


@app.get("/api/chart")
def chart():
    return _load("chart_data.json")


@app.get("/api/positions")
def positions():
    data = _load("app.json")
    return {
        "updated": data.get("last_update"),
        "total_value": data.get("total_value"),
        "return_pct": data.get("return_pct"),
        "positions": data.get("positions", []),
    }


@app.get("/api/top20")
def top20():
    data = _load("app.json")
    return {"updated": data.get("last_update"), "top20": data.get("top20", [])}


@app.get("/api/activity")
def activity():
    data = _load("app.json")
    trades = data.get("all_trades") or data.get("latest_activity") or []
    return {"trades": trades[-100:]}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


if STATIC.exists():
    app.mount("/static", StaticFiles(directory=STATIC), name="static")
    # Serve PWA assets at root paths used by index.html
    for sub in ("css", "js", "icons"):
        p = STATIC / sub
        if p.exists():
            app.mount(f"/{sub}", StaticFiles(directory=p), name=sub)


@app.get("/manifest.json")
def manifest():
    return FileResponse(STATIC / "manifest.json")


@app.get("/sw.js")
def sw():
    return FileResponse(STATIC / "sw.js", media_type="application/javascript")


@app.get("/icon.svg")
def icon_svg():
    return FileResponse(STATIC / "icon.svg", media_type="image/svg+xml")


@app.get("/icon-192.png")
def icon_192():
    path = STATIC / "icon-192.png"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


@app.get("/icon-512.png")
def icon_512():
    path = STATIC / "icon-512.png"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)
