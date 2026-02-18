import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../LandingPage.css";
import LoadingAnimation from "../../components/LoadingAnimation";

const DEFAULT_COORDS = { latitude: -17.8, longitude: 31.0 };

function weatherLabelFromCode(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed";
}

function getFieldHealth(temp, code) {
  if (temp == null || code == null) return "Unknown";
  const harshWeather = [65, 67, 82, 86, 95, 96, 99];

  if (harshWeather.includes(code)) return "Low";
  if (temp >= 18 && temp <= 30 && code <= 3) return "Excellent";
  if (temp >= 12 && temp <= 34) return "Good";
  return "Moderate";
}

export default function LandingPage() {
  const [weather, setWeather] = useState({
    loading: true,
    temp: null,
    label: null,
    fieldHealth: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async (coords) => {
      try {
        const params = new URLSearchParams({
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          current: "temperature_2m,weather_code",
          timezone: "auto",
        });

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        const data = await res.json();
        const current = data?.current;

        if (!cancelled && current) {
          const temp = current.temperature_2m;
          const code = current.weather_code;

          setWeather({
            loading: false,
            temp,
            label: weatherLabelFromCode(code),
            fieldHealth: getFieldHealth(temp, code),
          });
        }
      } catch {
        if (!cancelled) {
          setWeather((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          fetchWeather({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => fetchWeather(DEFAULT_COORDS),
        { timeout: 8000 }
      );
    } else {
      fetchWeather(DEFAULT_COORDS);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (weather.loading) {
    return <LoadingAnimation label="Preparing your farming dashboard..." scope="viewport" />;
  }

  return (
    <div className="lp-page">
      <div className="lp-backdrop" />

      <header className="lp-header lp-container">
        <h1 className="lp-logo">
          <img src="/assets/Slogo.png" alt="FarmTrack logo" className="lp-logo-img" />
        </h1>
        <div className="lp-header-actions">
          <Link to="/login" className="lp-btn lp-btn-outline">
            Sign In
          </Link>
          <Link to="/signup" className="lp-btn lp-btn-solid">
            Sign Up
          </Link>
        </div>
      </header>

      <main className="lp-container">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-chip">Modern farm management</span>
            <h2>Smart Farming. Clear Growth. Better Yields.</h2>
            <p>
              Track crop cycles, planting and harvesting dates, weather, and analytics in one clear
              dashboard designed for daily farm decisions.
            </p>

            <div className="lp-metrics">
              <div className="lp-metric">
                <strong>120+</strong>
                <span>farms onboarded</span>
              </div>
              <div className="lp-metric">
                <strong>24/7</strong>
                <span>season monitoring</span>
              </div>
              <div className="lp-metric">
                <strong>1 app</strong>
                <span>full crop visibility</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-media">
            <img
              src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80"
              alt="Green crops in a farm field"
            />
            <div className="lp-media-badge">
              <p>Current Weather</p>
              <strong>{weather.temp != null ? `${Math.round(weather.temp)}°C | ${weather.label}` : "Weather unavailable"}</strong>
              <span className="lp-badge-meta">Field Health: {weather.fieldHealth || "Unknown"}</span>
            </div>
          </div>
        </section>

        <section className="lp-features">
          <article className="lp-feature-card">
            <span className="lp-feature-icon" aria-hidden="true">{"\uD83C\uDF31"}</span>
            <h3>Crop Cycle Tracking</h3>
            <p>Monitor each phase with clear day counts, growth stages, and timelines.</p>
          </article>

          <article className="lp-feature-card">
            <span className="lp-feature-icon" aria-hidden="true">{"\uD83C\uDF26\uFE0F"}</span>
            <h3>Weather Forecasting</h3>
            <p>Daily and weekly weather insights linked directly to active crops.</p>
          </article>

          <article className="lp-feature-card">
            <span className="lp-feature-icon" aria-hidden="true">{"\uD83D\uDCCA"}</span>
            <h3>Reports and History</h3>
            <p>Review past seasons and generate performance reports in seconds.</p>
          </article>

          <article className="lp-feature-card">
            <span className="lp-feature-icon" aria-hidden="true">{"\uD83E\uDD16"}</span>
            <h3>Farming Assistant</h3>
            <p>Get practical recommendations tailored to your crop and location.</p>
          </article>
        </section>

        <section className="lp-cta">
          <h2>Start Growing Smarter Today</h2>
          <p>Set up your account and begin tracking your crop performance with clarity.</p>
          <div className="lp-cta-actions">
            <Link to="/signup" className="lp-btn lp-btn-solid">
              Create Free Account
            </Link>
            <Link to="/login" className="lp-btn lp-btn-outline">
              Go to Login
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <p>&copy; {new Date().getFullYear()} FarmTrack. All rights reserved.</p>
      </footer>
    </div>
  );
}


