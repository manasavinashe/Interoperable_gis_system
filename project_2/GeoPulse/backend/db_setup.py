import sqlite3
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "data", "cleaned_weather.csv")
DB_PATH  = os.path.join(BASE_DIR, "weather.db")

df = pd.read_csv(CSV_PATH)

conn = sqlite3.connect(DB_PATH)
df.to_sql("observations", conn, if_exists="replace", index=False)
conn.close()

print(f"✅ Database created at {DB_PATH} ({len(df)} rows)")