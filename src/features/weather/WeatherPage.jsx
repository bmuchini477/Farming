import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import WeatherCard from "./WeatherCard";
import WeatherSuggestionsCard from "./WeatherSuggestionsCard";
import LoadingAnimation from "../../components/LoadingAnimation";

export default function WeatherPage() {
  const { user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;
    let farmsLoaded = false;
    let cropsLoaded = false;

    const finishIfDone = () => {
      if (!active) return;
      if (farmsLoaded && cropsLoaded) setLoading(false);
    };

    setLoading(true);
    setError("");

    const unsubscribeFarms = onSnapshot(
      collection(db, "farms"),
      (farmRows) => {
        if (!active) return;
        const rows = farmRows.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setFarms(rows);

        farmsLoaded = true;
        finishIfDone();
      },
      (err) => {
        if (!active) return;
        console.error("Failed to watch farms:", err);
        setFarms([]);
        setError("Unable to load farms right now.");
        farmsLoaded = true;
        finishIfDone();
      }
    );

    getDocs(query(collection(db, "crops"), where("status", "==", "active")))
      .then((cropRows) => {
        if (!active) return;
        setCrops(cropRows.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load crops:", err);
        setCrops([]);
        setError((current) => current || "Unable to load crops right now.");
      })
      .finally(() => {
        cropsLoaded = true;
        finishIfDone();
      });

    return () => {
      active = false;
      unsubscribeFarms();
    };
  }, [user]);

  const weatherFarmOptions = useMemo(() => {
    return farms.filter((farm) => Number.isFinite(Number(farm.latitude)) && Number.isFinite(Number(farm.longitude)));
  }, [farms]);

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head">
          <h1 className="app-title">Weather</h1>
          <p className="app-subtitle">Farm-by-farm forecast with suggestions based on current weather conditions.</p>
        </div>

        {loading && <LoadingAnimation label="Loading weather context..." scope="inline" />}
        {!loading && error && <p className="app-error">{error}</p>}
      </section>

      {!loading && weatherFarmOptions.length === 0 && (
        <section className="app-card">
          <div className="app-empty-inline">
            <p>No farm coordinates found. Add latitude and longitude on farms to see weather by farm.</p>
          </div>
        </section>
      )}

      {weatherFarmOptions.map((farm) => {
        const farmCrops = crops.filter((crop) => crop.farmId === farm.id);
        const coords = { latitude: Number(farm.latitude), longitude: Number(farm.longitude) };
        const locationLabel = farm.location || farm.name || "Farm";

        return (
          <section className="app-card" key={farm.id}>
            <div className="app-card-head app-card-head-split">
              <div>
                <h2 className="app-title-sm">{farm.name}</h2>
                <p className="app-subtitle">{farm.location || farm.farmCode || "Farm location"}</p>
              </div>
              <span className="app-pill">{farmCrops.length} active crop(s)</span>
            </div>

            <div className="app-grid-2">
              <WeatherCard coords={coords} locationLabel={locationLabel} />
              <WeatherSuggestionsCard coords={coords} locationLabel={locationLabel} farmCrops={farmCrops} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
