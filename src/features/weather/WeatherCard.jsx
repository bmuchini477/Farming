import { useEffect, useState } from "react";
import { fetchDailyWeather } from "./weather.service";
import LoadingAnimation from "../../components/LoadingAnimation";

const DEFAULT_LABEL = "Harare";

export default function WeatherCard({ coords, locationLabel }) {
  const [data, setData] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchDailyWeather(coords)
      .then((days) => {
        if (!cancelled) {
          setData(days.slice(0, 3));
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "Weather failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coords]);

  return (
    <div className="app-card">
      <div className="app-card-head app-card-head-split">
        <h3 className="app-title-sm">Weather Forecast</h3>
        <span className="app-pill">{locationLabel || DEFAULT_LABEL}</span>
      </div>

      {err && <div className="app-error">{err}</div>}
      {!err && loading && <LoadingAnimation label="Loading forecast..." scope="inline" />}

      {!loading && (
        <div className="app-table-wrap">
          <table className="app-table" style={{ minWidth: "0" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Temperature</th>
                <th>Rain</th>
              </tr>
            </thead>
            <tbody>
              {data.map((w) => (
                <tr key={w.date}>
                  <td>{w.date}</td>
                  <td>{w.minTemp} to {w.maxTemp} C</td>
                  <td>{w.rain} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
