# PEG Cloud — sync data into static API + FastAPI data folder
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "peg_portfolio_app" / "data"
DATA = ROOT / "data"
STATIC_API = ROOT / "static" / "api"


def sync() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    STATIC_API.mkdir(parents=True, exist_ok=True)
    app = SRC / "app.json"
    chart = SRC / "chart_data.json"
    if not app.exists():
        raise SystemExit("Missing peg_portfolio_app/data/app.json — run peg_portfolio_monthly.py first")
    shutil.copy2(app, DATA / "app.json")
    shutil.copy2(app, STATIC_API / "portfolio.json")
    if chart.exists():
        shutil.copy2(chart, DATA / "chart_data.json")
        shutil.copy2(chart, STATIC_API / "chart.json")
    else:
        (DATA / "chart_data.json").write_text("{}", encoding="utf-8")
        (STATIC_API / "chart.json").write_text("{}", encoding="utf-8")
    print("Synced cloud data:")
    print(f"  {DATA / 'app.json'}")
    print(f"  {STATIC_API / 'portfolio.json'}")


if __name__ == "__main__":
    sync()
