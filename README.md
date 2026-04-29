# SmartSpend AI 💡

<img width="1858" height="886" alt="image" src="https://github.com/user-attachments/assets/ab579d2f-7abb-4997-9e80-71ec8699eb32" />


SmartSpend AI is a polished Flask web app that turns raw expense CSVs into clear financial insights, interactive charts, and shareable analysis snapshots.

- Website 1: https://smart-spend-ai-two.vercel.app/
- Website 2: https://smartspend-ai-production.up.railway.app/
- Website 3: https://smartspend-ai-6oiq.onrender.com/
  
It supports two modes:
- **Flask mode (full app):** server-side analytics + SQLite persistence.
- **Static preview mode:** quick Live Server demo using browser storage.

---

## Why this project stands out

- Modern, recruiter-friendly UI (dark/light theme, animations, responsive layout).
- Strong analytics pipeline from uploaded CSV data.
- Multiple chart views for trends, categories, volatility, and momentum.
- Profile + analysis persistence with SQLite.
- API endpoints for profile and snapshot operations.

---

## Core features

### 1) Upload and analyze CSV files
- Upload CSV files with date + amount columns (category is optional).
- Data is cleaned, normalized, and transformed into analytics-ready structures.
- Returns dashboard-ready metrics and chart series.

### 2) Interactive dashboard
- KPI cards (total, average, prediction, anomalies).
- Trend, category, monthly comparison, scatter, cumulative, rolling, velocity, and volatility views.
- Focus mode for chart cards and rich hover tooltips.

### 3) Profile system
- Save profile details (name, email, occupation, avatar, theme).
- Load existing profile data by email.
- Avatar preview sync across profile/nav.

### 4) Persistence and APIs
- SQLite-backed tables:
  - `profiles`
  - `analyses`
- Analysis snapshots can be saved and revisited.

### 5) Download-ready sample data
- Built-in downloadable CSV endpoint using `data/sample_expenses_large.csv`.

---

## Tech stack

- **Backend:** Flask, Pandas, NumPy, scikit-learn, SQLite
- **Frontend:** HTML, CSS, JavaScript, Chart.js, Font Awesome
- **Deployment:** Gunicorn + Render

---

## Project structure

```text
smartspend-ai/
├─ app.py
├─ Procfile
├─ requirements.txt
├─ README.md
├─ index.html                      # Static Live Server preview page
├─ templates/
│  ├─ index.html                   # Flask homepage
│  ├─ dashboard.html               # Dashboard view rendered after upload
│  └─ profile.html                 # Profile page
├─ static/
│  ├─ css/
│  │  └─ style.css
│  ├─ js/
│  │  ├─ app.js
│  │  ├─ index-page.js
│  │  ├─ dashboard-page.js
│  │  └─ profile-page.js
│  └─ images/
│     ├─ anonymous-avatar.svg
│     └─ person_12259248.png
├─ data/
│  ├─ sample_expenses.csv
│  └─ sample_expenses_large.csv
└─ models/
   ├─ expense_model.pkl
   └─ kmeans_model.pkl
```

---

## Run locally

### A) Flask mode (recommended)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start app:
```bash
python app.py
```

3. Open:
- `http://127.0.0.1:5000`

### B) Static preview mode (Live Server)

1. Open project in VS Code.
2. Start Live Server from root `index.html`.
3. Use preview flow (localStorage only): sign in, upload CSV, inspect mock dashboard.

> Note: Static preview does not call Flask routes or DB APIs.

---

## API endpoints

- `GET /health`
- `GET /download/sample-csv`
- `POST /upload`
- `POST /api/profile`
- `GET /api/profile?email=<email>`
- `POST /api/analysis`

---

## CSV input expectations

Minimum required columns:
- A date/time-like column (`date`, `time`, etc.)
- An amount-like column (`amount`, `price`, `cost`, etc.)

Optional:
- Category/type/group column

If category is missing, records default to `General`.

---

## Deployment on Railway (step-by-step)

This repository now includes a `railway.json` file so Railway uses the correct web process automatically.

1. Push the project to GitHub.
2. In Railway, create a new project from your repo.
3. Railway will install dependencies from `requirements.txt`.
4. Railway will start the app with:
```bash
gunicorn --bind 0.0.0.0:$PORT app:app
```
5. Add environment variables:
- `SECRET_KEY` (required, secure random string)
- `SMARTSPEND_DB` (optional custom DB path/name)
- `MAX_UPLOAD_MB` (optional, default `8`)
6. Deploy and test `/health`, CSV upload, profile save/load, and analysis save.

---

## Deployment on Render (step-by-step)

1. Push project to GitHub.
2. Create a **Web Service** in Render from your repo.
3. Set **Build Command**:
```bash
pip install -r requirements.txt
```
4. Set **Start Command**:
```bash
gunicorn app:app
```
5. Add environment variables:
- `SECRET_KEY` (required, secure random string)
- `SMARTSPEND_DB` (optional custom DB path/name)
- `MAX_UPLOAD_MB` (optional, default `8`)
6. Set health check path to `/health`.
7. Deploy and test upload + dashboard + profile save flows.

---

## Troubleshooting

### Sample CSV not downloading in Live Server
Use the static file link from root preview (`./data/sample_expenses_large.csv`).
Flask route downloads (`/download/sample-csv`) require running the Flask app.

### Upload fails
- Ensure CSV has valid date/time and amount columns.
- Check file size against `MAX_UPLOAD_MB`.

### Render app boots but pages fail
- Confirm `gunicorn app:app` start command.
- Confirm dependencies installed from `requirements.txt`.

---

## Roadmap ideas

- OAuth-based Google sign-in backend integration
- User-specific analysis history page
- Export dashboard as PDF/PNG
- Budget-goal tracking and alerts
- Multi-currency support

---

## License

MIT (see `LICENSE`).
