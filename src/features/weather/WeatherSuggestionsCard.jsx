import { useEffect, useMemo, useState } from "react";
import { fetchDailyWeather } from "./weather.service";
import LoadingAnimation from "../../components/LoadingAnimation";

function buildSuggestions(currentDay, farmCrops) {
  if (!currentDay) return [];

  const suggestions = [];
  const cropNames = (farmCrops || []).map((crop) => crop.name).filter(Boolean);
  const cropsText = cropNames.length ? ` for ${cropNames.slice(0, 3).join(", ")}` : "";

  if (currentDay.rain >= 15) {
    suggestions.push(`Heavy rain expected${cropsText}. Delay irrigation and check drainage channels.`);
    suggestions.push("Inspect fields for waterlogging and fungal pressure after rainfall.");
  } else if (currentDay.rain >= 5) {
    suggestions.push(`Moderate rain expected${cropsText}. Reduce planned irrigation for today.`);
  } else {
    suggestions.push(`Low rain expected${cropsText}. Keep irrigation active based on soil moisture readings.`);
  }

  if (currentDay.maxTemp >= 34) {
    suggestions.push("High heat risk. Irrigate in early morning/evening and monitor crop stress.");
  } else if (currentDay.maxTemp <= 12) {
    suggestions.push("Cool conditions. Protect sensitive crops and avoid over-irrigation.");
  } else {
    suggestions.push("Temperature is within a workable range for normal field operations.");
  }

  return suggestions;
}

export default function WeatherSuggestionsCard({ coords, locationLabel, farmCrops }) {
  const [currentDay, setCurrentDay] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");

    fetchDailyWeather(coords)
      .then((days) => {
        if (!active) return;
        setCurrentDay(days[0] || null);
      })
      .catch((err) => {
        if (!active) return;
        setCurrentDay(null);
        setError(err?.message || "Could not load weather suggestions.");
      });

    return () => {
      active = false;
    };
  }, [coords]);

  const suggestions = useMemo(() => buildSuggestions(currentDay, farmCrops), [currentDay, farmCrops]);

  return (
    <div className="app-card">
      <div className="app-card-head app-card-head-split">
        <h3 className="app-title-sm">Today&apos;s Suggestions</h3>
        <span className="app-pill">{locationLabel || "Farm"}</span>
      </div>

      {error && <p className="app-error">{error}</p>}

      {!error && !currentDay && <LoadingAnimation label="Loading weather suggestions..." scope="inline" />}

      {currentDay && (
        <div className="app-analytics-body">
          <p><strong>Date:</strong> {currentDay.date}</p>
          <p><strong>Temperature:</strong> {currentDay.minTemp} to {currentDay.maxTemp} C</p>
          <p><strong>Rain:</strong> {currentDay.rain} mm</p>
          {suggestions.map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      )}
    </div>
  );
}
