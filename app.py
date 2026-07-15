import json
import os
import sqlite3
import requests
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from flask import Flask, jsonify, redirect, render_template, request, send_file
from sklearn.linear_model import LinearRegression
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, os.getenv("SMARTSPEND_DB", "smartspend.db"))
if os.getenv("VERCEL") and not os.getenv("SMARTSPEND_DB"):
    DB_PATH = os.path.join("/tmp", "smartspend.db")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me")
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db_conn()
    conn.execute("CREATE TABLE IF NOT EXISTS profiles (email TEXT PRIMARY KEY, name TEXT, occupation TEXT, avatar TEXT, theme TEXT DEFAULT 'dark', updated_at TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, total REAL, average REAL, prediction REAL, anomalies INTEGER, strongest_category TEXT, payload TEXT, created_at TEXT NOT NULL)")
    conn.commit()
    conn.close()

init_db()

def ok(data, status=200):
    return jsonify(data), status

def err(message, status=400):
    return jsonify({"error": message}), status

def normalize_category(raw):
    val = str(raw or "").strip().lower()
    aliases = {"uber": "Transport", "taxi": "Transport", "bus": "Transport", "fuel": "Transport", "rent": "Housing", "mortgage": "Housing", "grocery": "Groceries", "supermarket": "Groceries", "restaurant": "Dining", "coffee": "Dining", "netflix": "Subscriptions", "spotify": "Subscriptions", "electric": "Utilities", "water": "Utilities", "medical": "Healthcare", "pharmacy": "Healthcare", "tuition": "Education", "course": "Education"}
    for k, mapped in aliases.items():
        if k in val:
            return mapped
    return "General" if not val else val.title()

def compute_analytics(df, date_col, amount_col, category_col):
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[amount_col] = pd.to_numeric(df[amount_col], errors="coerce")
    df = df.dropna(subset=[date_col, amount_col]).sort_values(date_col)

    if df.empty:
        raise ValueError("No valid rows remain after cleaning.")

    df[amount_col] = df[amount_col].clip(lower=0)
    df["normalized_category"] = df[category_col].apply(normalize_category)

    total = round(float(df[amount_col].sum()), 2)
    average = round(float(df[amount_col].mean()), 2)

    monthly = df.set_index(date_col)[amount_col].resample("MS").sum().sort_index()
    months = monthly.index.strftime("%b %Y").tolist()
    monthly_values = monthly.round(2).tolist()

    prediction = 0.0
    if len(monthly_values) > 1:
        model = LinearRegression()
        x_axis = np.arange(len(monthly_values)).reshape(-1, 1)
        model.fit(x_axis, monthly_values)
        prediction = round(float(model.predict([[len(monthly_values)]])[0]), 2)

    category_totals = df.groupby("normalized_category")[amount_col].sum().sort_values(ascending=False)
    df["cumulative"] = df[amount_col].cumsum()
    df["rolling_avg"] = df[amount_col].rolling(window=4, min_periods=1).mean()
    df["velocity"] = df[amount_col].diff().fillna(0)
    volatility = df.groupby("normalized_category")[amount_col].std().fillna(0)

    fixed_set = {"Housing", "Utilities", "Subscriptions", "Education", "Insurance"}
    df["expense_type"] = df["normalized_category"].apply(lambda x: "Fixed" if x in fixed_set else "Variable")
    expense_split = df.groupby("expense_type")[amount_col].sum()

    std = float(df[amount_col].std()) if len(df) > 1 else 0.0
    threshold = float(df[amount_col].mean()) + (2 * std)
    anomalies = int((df[amount_col] > threshold).sum()) if std > 0 else 0

    strongest_category = category_totals.index[0] if len(category_totals) else "General"
    insight_items = [f"Your highest spend category is {strongest_category}.", f"Average transaction value is R {average:.2f}.", f"Forecasted next month spend: R {prediction:.2f}." if prediction else "Upload more monthly data for stronger forecasting.", f"Detected {anomalies} unusual transaction(s)."]

    return {"total": total, "average": average, "prediction": prediction, "anomalies": anomalies, "strongest_category": strongest_category, "insights": insight_items, "months": months, "monthly": monthly_values, "categories": category_totals.index.tolist(), "category_totals": category_totals.round(2).tolist(), "dates": df[date_col].dt.strftime("%Y-%m-%d").tolist(), "cumulative": df["cumulative"].round(2).tolist(), "rolling": df["rolling_avg"].round(2).tolist(), "velocity": df["velocity"].round(2).tolist(), "volatility_labels": volatility.index.tolist(), "volatility_values": volatility.round(2).tolist(), "expense_labels": expense_split.index.tolist(), "expense_values": expense_split.round(2).tolist(), "amounts": df[amount_col].round(2).tolist()}

def get_ai_dashboard_analysis(analytics):
    if not OPENROUTER_API_KEY:
        return {"error": "API not configured"}

    try:
        category_data = dict(zip(analytics['categories'], analytics['category_totals']))
        monthly_values = analytics['monthly']
        
        trend_direction = "stable"
        if len(monthly_values) > 2:
            prev_month = monthly_values[-2]
            curr_month = monthly_values[-1]
            if prev_month > 0:
                trend_pct = ((curr_month - prev_month) / prev_month) * 100
                trend_direction = "increasing" if trend_pct > 10 else ("decreasing" if trend_pct < -10 else "stable")

        volatility_data = dict(zip(analytics['volatility_labels'], analytics['volatility_values']))
        avg_volatility = np.mean(analytics['volatility_values']) if analytics['volatility_values'] else 0
        high_vol = [cat for cat, vol in volatility_data.items() if vol > avg_volatility * 1.5]

        fixed_amt = analytics['expense_values'][0] if analytics['expense_values'] else 0
        variable_amt = analytics['expense_values'][1] if len(analytics['expense_values']) > 1 else 0
        total = analytics['total']
        fixed_pct = (fixed_amt / total * 100) if total > 0 else 0
        variable_pct = (variable_amt / total * 100) if total > 0 else 0

        category_str = ', '.join([f"{cat}: R{tot:.0f}" for cat, tot in category_data.items()])
        volatile_str = ', '.join(high_vol) if high_vol else 'All categories stable'
        monthly_str = ' -> '.join([f"R{v:.0f}" for v in monthly_values[-4:]])

        prompt = f"""Generate comprehensive AI dashboard analysis for spending data. Return ONLY valid JSON, no additional text.

DATA SUMMARY:
- Total Spent: R{total}
- Average Transaction: R{analytics['average']}
- Monthly Forecast: R{analytics['prediction']}
- Anomalies: {analytics['anomalies']}
- Trend: {trend_direction}
- Categories: {category_str}
- Fixed vs Variable: {fixed_pct:.0f}% fixed, {variable_pct:.0f}% variable

RETURN THIS EXACT JSON STRUCTURE:
{{
  "kpi_descriptions": {{
    "total": "One sentence explaining what this total means for their finances",
    "average": "What this average tells about their spending patterns",
    "prediction": "What next month forecast indicates",
    "anomalies": "Meaning of these unusual transactions"
  }},
  "chart_descriptions": {{
    "trend": "Specific insight about their trend pattern - is it accelerating, stable, or decelerating?",
    "category": "Which category dominates and what this means",
    "monthly": "Month-to-month comparison insight",
    "scatter": "What their transaction distribution reveals",
    "cumulative": "Cumulative impact on their finances",
    "rolling": "Smoothed trend interpretation",
    "velocity": "How spending pace is changing",
    "volatility": "Which categories are unpredictable",
    "fixed_variable": "Budget flexibility assessment"
  }},
  "kpi_labels": {{
    "total": "Total Expenses",
    "average": "Avg Transaction",
    "prediction": "Next Month Est.",
    "anomalies": "Unusual Spends"
  }},
  "spending_insights": [
    {{
      "title": "Spending Pattern",
      "finding": "Specific observation about their spending",
      "implication": "What this means going forward"
    }},
    {{
      "title": "Budget Health",
      "finding": "Overall assessment",
      "implication": "Action to consider"
    }}
  ],
  "recommendations": [
    {{
      "priority": "HIGH",
      "action": "Specific action based on their data",
      "impact": "Expected financial impact"
    }}
  ],
  "executive_summary": "2-3 sentences summarizing their complete financial picture"
}}"""

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://smartspend-ai.vercel.app",
            "X-Title": "SmartSpend AI",
            "Content-Type": "application/json",
        }

        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 3000,
        }

        response = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=30)

        if response.status_code == 200:
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                try:
                    analysis = json.loads(content)
                    return analysis
                except json.JSONDecodeError:
                    return {"error": "Invalid JSON response"}
            return {"error": "No response from AI"}
        else:
            return {"error": f"API error {response.status_code}"}

    except requests.exceptions.Timeout:
        return {"error": "Request timeout"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/favicon.svg")
def favicon_svg():
    return send_file(os.path.join(BASE_DIR, "public", "favicon.svg"), mimetype="image/svg+xml")

@app.get("/favicon.ico")
def favicon_ico():
    return redirect("/favicon.svg", code=307)

@app.get("/profile")
def profile_page():
    return render_template("profile.html")

@app.get("/health")
def health():
    return ok({"status": "ok", "time": datetime.utcnow().isoformat()})

@app.get("/download/sample-csv")
def download_sample_csv():
    path = os.path.join(BASE_DIR, "data", "sample_expenses_large.csv")
    return send_file(path, mimetype="text/csv", as_attachment=True, download_name="sample_expenses_large.csv")

@app.post("/api/profile")
def save_profile():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return err("Email is required.")
    conn = db_conn()
    conn.execute("INSERT INTO profiles (email, name, occupation, avatar, theme, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, occupation=excluded.occupation, avatar=excluded.avatar, theme=excluded.theme, updated_at=excluded.updated_at", (email, (data.get("name") or "").strip(), (data.get("occupation") or "").strip(), data.get("avatar"), (data.get("theme") or "dark").strip(), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return ok({"status": "saved"})

@app.get("/api/profile")
def get_profile():
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return err("Email is required.")
    conn = db_conn()
    row = conn.execute("SELECT email, name, occupation, avatar, theme, updated_at FROM profiles WHERE email = ?", (email,)).fetchone()
    conn.close()
    return ok({"profile": dict(row) if row else None})

@app.post("/api/analysis")
def save_analysis():
    data = request.get_json(silent=True) or {}
    conn = db_conn()
    conn.execute("INSERT INTO analyses (email, total, average, prediction, anomalies, strongest_category, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ((data.get("email") or "").strip().lower() or None, float(data.get("total", 0)), float(data.get("average", 0)), float(data.get("prediction", 0)), int(data.get("anomalies", 0)), str(data.get("strongest_category", "General")), str(data.get("payload", "{}")), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return ok({"status": "analysis_saved"}, 201)

@app.post("/upload")
def upload():
    file = request.files.get("file")
    if not file:
        return err("No file uploaded.")
    try:
        df = pd.read_csv(file)
    except Exception:
        return err("Could not read CSV. Please upload a valid CSV file.")
    df.columns = [c.lower().strip() for c in df.columns]
    date_col = next((c for c in df.columns if "date" in c or "time" in c), None)
    amount_col = next((c for c in df.columns if any(k in c for k in ["amount", "price", "cost", "value"])), None)
    category_col = next((c for c in df.columns if any(k in c for k in ["category", "type", "group"])), None)
    if not date_col or not amount_col:
        return err("CSV must include date/time and amount columns.")
    if not category_col:
        df["category"] = "General"
        category_col = "category"
    try:
        analytics = compute_analytics(df, date_col, amount_col, category_col)
    except ValueError as exc:
        return err(str(exc))
    
    ai_analysis = get_ai_dashboard_analysis(analytics)
    analytics["ai_analysis"] = ai_analysis
    
    return render_template("dashboard.html", **analytics)

@app.errorhandler(413)
def too_large(_):
    return err(f"File too large. Max upload size is {MAX_UPLOAD_MB}MB.", 413)

@app.errorhandler(500)
def server_error(_):
    return err("Unexpected server error.", 500)

if __name__ == "__main__":
    app.run(debug=True)
