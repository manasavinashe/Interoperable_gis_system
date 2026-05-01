import pandas as pd

# 25 sensor stations — one per country, spread across all continents
# Each has ~710-713 readings in the raw dataset (full time series)
SENSORS = {
    # Asia
    "Tokyo":        "Japan",
    "New Delhi":    "India",
    "Beijing":      "China",
    "Bangkok":      "Thailand",
    "Singapore":    "Singapore",
    "Tehran":       "Iran",
    # Europe
    "Berlin":       "Germany",
    "Rome":         "Italy",
    "Warsaw":       "Poland",
    "Moscow":       "Russia",
    "London":       "United Kingdom",
    # Africa
    "Cairo":        "Egypt",
    "Nairobi":      "Kenya",
    "Dakar":        "Senegal",
    "Accra":        "Ghana",
    "Pretoria":     "South Africa",
    # Americas
    "Ottawa":       "Canada",
    "Mexico City":  "Mexico",
    "Lima":         "Peru",
    "Buenos Aires": "Argentina",
    "Montevideo":   "Uruguay",
    # Middle East
    "Riyadh":       "Saudi Arabia",
    "Muscat":       "Oman",
    # Oceania
    "Canberra":     "Australia",
    "Wellington":   "New Zealand",
}

df = pd.read_csv("GlobalWeatherRepository.csv")

# Filter to only our 25 stations
mask = pd.Series(False, index=df.index)
for city, country in SENSORS.items():
    mask |= ((df["location_name"] == city) & (df["country"] == country))
df = df[mask].copy()

# Pick the 5 parameters
df = df[[
    "location_name",
    "country",
    "latitude",
    "longitude",
    "last_updated",
    "temperature_celsius",
    "humidity",
    "wind_kph",
    "pressure_mb",
    "precip_mm",
]]

df = df.rename(columns={
    "last_updated":        "timestamp",
    "temperature_celsius": "temperature",
    "wind_kph":            "wind_speed",
    "pressure_mb":         "pressure",
    "precip_mm":           "precipitation",
})

df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values(["location_name", "timestamp"]).reset_index(drop=True)
df["sensor_id"] = df["location_name"] + "_" + df["country"]

df.to_csv("cleaned_weather.csv", index=False)

print(f"✅ Dataset created: {len(df)} rows, {df['sensor_id'].nunique()} sensors")
print(f"   Time range: {df['timestamp'].min()} → {df['timestamp'].max()}")
print(f"   Readings per sensor:")
print(df.groupby("sensor_id").size().to_string())
