import { useEffect, useState } from "react";
import { fetchDailyWeather } from "./weather.service";
import { generateWeatherAlerts } from "./weatherAlerts";
import { stageForDay } from "../crops/cropStages";

export default function WeatherAlerts({ crops, coords }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!crops || crops.length === 0) {
      setAlerts([]);
      return;
    }

    fetchDailyWeather(coords).then((weather) => {
      const enriched = crops.map((c) => ({
        name: c.name,
        stage: stageForDay(c.day).name,
      }));

      setAlerts(generateWeatherAlerts(weather, enriched));
    });
  }, [coords, crops]);

  return (
    <div className="app-card">
      <div className="app-card-head">
        <h3 className="app-title-sm">Weather Alerts</h3>
      </div>

      {alerts.length === 0 ? (
        <p className="app-muted">No weather risks detected for the next few days.</p>
      ) : (
        <div className="app-form-grid">
          {alerts.map((a, i) => (
            <div
              key={`${a.type}-${i}`}
              className={a.level === "danger" ? "app-error" : "app-empty-inline"}
            >
              <p>{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
