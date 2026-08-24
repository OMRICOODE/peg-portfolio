# PEG Portfolio — Cloud API + App

Public URL (after deploy): `https://omricoode.github.io/peg-portfolio/`

## API

| Endpoint | Description |
|---|---|
| `GET /api/portfolio.json` | Full portfolio (Pages) |
| `GET /api/chart.json` | Chart ranges vs SPY |
| `GET /api/portfolio` | Same via FastAPI |
| `GET /api/chart` | Same via FastAPI |
| `GET /api/health` | Health (FastAPI only) |

## Update data locally then push

```bash
py peg_portfolio_monthly.py
py peg_cloud/sync_data.py
cd peg_cloud && git add -A && git commit -m "update portfolio" && git push
```

## Run FastAPI locally

```bash
cd peg_cloud
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```
