import sqlite3
import pandas as pd

# Load cleaned data
df = pd.read_csv("../data/cleaned_weather.csv")

# Create DB
conn = sqlite3.connect("weather.db")

# Store data
df.to_sql("observations", conn, if_exists="replace", index=False)

conn.close()

print("✅ Database created")