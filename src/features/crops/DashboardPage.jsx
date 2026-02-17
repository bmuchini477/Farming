import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAdminStatus } from "../auth/useAdminStatus";
import { listActiveCropsWithMonitoring } from "./crops.service";
import { watchFarms } from "../farms/farms.service";
import { stageForDay } from "./cropStages";
import ProgressRing from "../../components/ProgressRing";
import LoadingAnimation from "../../components/LoadingAnimation";
import WeatherCard from "../weather/WeatherCard";
import WeatherAlerts from "../weather/WeatherAlerts.jsx";
import {
  computeFieldHealthIndex,
  computeGrowthDeviation,
  computePestImpact,
  computeSoilHealth,
  computeWaterStress,
  computeWeatherSuitability,
} from "../../utils/fieldAnalytics";

function daysBetween(aISO, bISO) {
  const a = new Date(`${aISO}T00:00:00`).getTime();
  const b = new Date(`${bISO}T00:00:00`).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(isoDate) {
  if (!isoDate) return "-";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function decorateCrop(crop, todayISO) {
  const totalDays = Number(crop.totalDays || 0) || 1;
  const day = Math.min(totalDays, Math.max(0, daysBetween(crop.plantingDate, todayISO) + 1));
  const stage = stageForDay(day);
  const percent = Math.round((day / totalDays) * 100);
  const daysToHarvest = crop.expectedHarvestDate ? daysBetween(todayISO, crop.expectedHarvestDate) : null;

  return { ...crop, day, totalDays, stage, percent, daysToHarvest };
}

function scoreColor(score) {
  if (score > 75) return "#148258";
  if (score >= 50) return "#c28a0e";
  return "#b42318";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { isAdmin } = useAdminStatus(user);
  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [weatherFarmId, setWeatherFarmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const todayISO = new Date().toISOString().slice(0, 10);

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
    setLoadError("");

    const unsubscribeFarms = watchFarms(
      (farmRows) => {
        if (!active) return;
        setFarms(farmRows);

        const withCoords = farmRows.find((farm) => Number.isFinite(Number(farm.latitude)) && Number.isFinite(Number(farm.longitude)));
        if (withCoords) setWeatherFarmId((current) => current || withCoords.id);

        farmsLoaded = true;
        finishIfDone();
      },
      (error) => {
        if (!active) return;
        console.error("Failed to watch farms:", error);
        setFarms([]);
        setLoadError("Unable to load farms right now.");
        farmsLoaded = true;
        finishIfDone();
      }
    );

    listActiveCropsWithMonitoring()
      .then((cropRows) => {
        if (!active) return;
        setCrops(cropRows.map((crop) => decorateCrop(crop, todayISO)));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load crops:", error);
        setCrops([]);
        setLoadError((current) => current || "Unable to load crops right now.");
      })
      .finally(() => {
        cropsLoaded = true;
        finishIfDone();
      });

    return () => {
      active = false;
      unsubscribeFarms();
    };
  }, [user, todayISO]);

  const farmSnapshots = useMemo(() => {
    return farms.map((farm) => {
      const linked = crops
        .filter((crop) => crop.farmId === farm.id)
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      return {
        farm,
        currentCrop: linked[0] || null,
        activeCropCount: linked.length,
        averageProgress: linked.length ? Math.round(linked.reduce((sum, crop) => sum + crop.percent, 0) / linked.length) : 0,
      };
    });
  }, [farms, crops]);

  const overview = useMemo(() => {
    const activeCrops = crops.length;
    const farmsCount = farms.length;
    const upcomingHarvests = crops.filter((c) => {
      if (!c.expectedHarvestDate) return false;
      const days = daysBetween(todayISO, c.expectedHarvestDate);
      return days >= 0 && days <= 14;
    }).length;

    const averageCycleProgress = activeCrops
      ? Math.round(crops.reduce((sum, crop) => sum + crop.percent, 0) / activeCrops)
      : 0;

    const atRisk = crops.filter((crop) => crop.daysToHarvest !== null && crop.daysToHarvest < 0).length;

    return { farmsCount, activeCrops, upcomingHarvests, averageCycleProgress, atRisk };
  }, [crops, farms, todayISO]);

  const cropAnalytics = useMemo(() => {
    return [...crops].sort((a, b) => {
      if (a.daysToHarvest === null) return 1;
      if (b.daysToHarvest === null) return -1;
      return a.daysToHarvest - b.daysToHarvest;
    });
  }, [crops]);

  const monitoringByField = useMemo(() => {
    return farms.map((farm) => {
      const linkedCrops = crops.filter((crop) => crop.farmId === farm.id);

      if (!linkedCrops.length) {
        return {
          farm,
          activeCropCount: 0,
          soilHealthScore: 0,
          weatherSuitabilityScore: 0,
          growthScore: 0,
          waterStressScore: 0,
          pestImpactScore: 0,
          fieldHealthIndex: 0,
        };
      }

      const soilScores = [];
      const weatherScores = [];
      const growthScores = [];
      const waterScores = [];
      const pestScores = [];

      linkedCrops.forEach((crop) => {
        const snapshot = crop.seasonSnapshot || {};
        const latestSoil = snapshot.latestSoilTest || {};
        const latestGrowth = snapshot.latestGrowthRecord || {};
        const latestIrrigation = snapshot.latestIrrigationLog || {};
        const latestPest = snapshot.latestPestReport ? [snapshot.latestPestReport] : [];

        const soilScore = computeSoilHealth(latestSoil);
        const weatherScore = computeWeatherSuitability(
          {
            temperatureC: latestSoil.soilTemperature,
            rainfallMm: 20,
            humidityPct: 60,
            evapotranspirationMm: 4,
          },
          {
            temperature: { min: 18, max: 32 },
            rainfall: { min: 10, max: 45 },
            humidity: { min: 45, max: 80 },
          }
        );
        const growthScore = computeGrowthDeviation(latestGrowth, {
          targetNdvi: 0.75,
          targetLeafColor: 45,
          targetPopulationPerSqm: 8,
        });
        const waterScore = computeWaterStress(
          {
            temperatureC: latestSoil.soilTemperature,
            evapotranspirationMm: 4,
          },
          latestIrrigation
        );
        const pestScore = computePestImpact(latestPest);

        soilScores.push(soilScore);
        weatherScores.push(weatherScore);
        growthScores.push(growthScore);
        waterScores.push(waterScore);
        pestScores.push(pestScore);
      });

      const soilHealthScore = computeFieldHealthIndex(soilScores);
      const weatherSuitabilityScore = computeFieldHealthIndex(weatherScores);
      const growthScore = computeFieldHealthIndex(growthScores);
      const waterStressScore = computeFieldHealthIndex(waterScores);
      const pestImpactScore = computeFieldHealthIndex(pestScores);
      const fieldHealthIndex = computeFieldHealthIndex([
        soilHealthScore,
        weatherSuitabilityScore,
        growthScore,
        waterStressScore,
        pestImpactScore,
      ]);

      return {
        farm,
        activeCropCount: linkedCrops.length,
        soilHealthScore,
        weatherSuitabilityScore,
        growthScore,
        waterStressScore,
        pestImpactScore,
        fieldHealthIndex,
      };
    });
  }, [farms, crops]);

  const weatherFarmOptions = useMemo(() => {
    return farms.filter((farm) => Number.isFinite(Number(farm.latitude)) && Number.isFinite(Number(farm.longitude)));
  }, [farms]);

  const selectedWeatherFarm = useMemo(() => {
    return weatherFarmOptions.find((farm) => farm.id === weatherFarmId) || weatherFarmOptions[0] || null;
  }, [weatherFarmId, weatherFarmOptions]);

  const weatherCoords = useMemo(() => {
    if (!selectedWeatherFarm) return undefined;
    return { latitude: Number(selectedWeatherFarm.latitude), longitude: Number(selectedWeatherFarm.longitude) };
  }, [selectedWeatherFarm]);

  if (loading) {
    return (
      <div style={{ position: "relative", minHeight: "calc(100vh - 8rem)" }}>
        <LoadingAnimation label="Loading dashboard data..." scope="container" />
      </div>
    );
  }

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">Farm Analytics Dashboard</h1>
            <p className="app-subtitle">
              Track farms, current crops, cycle progress, growth stage, planting and harvesting dates from one analytics-focused view.
            </p>
          </div>

          <div className="app-actions-row">
            <Link to="/app" className="app-btn app-btn-outline">Dashboard</Link>
            {isAdmin && <Link to="/app/farms/new" className="app-btn app-btn-outline">Add Farm</Link>}
            {isAdmin && <Link to="/app/crops/new" className="app-btn app-btn-solid">Add Crop</Link>}
            <Link to="/app/monitoring" className="app-btn app-btn-outline">Monitoring Forms</Link>
            <Link to="/app/projection" className="app-btn app-btn-outline">Projection</Link>
            <Link to="/app/weather" className="app-btn app-btn-outline">Weather</Link>
            {isAdmin && <Link to="/app/users" className="app-btn app-btn-outline">Users</Link>}
            <Link to="/app/reports" className="app-btn app-btn-outline">View Reports</Link>
          </div>
        </div>

        <div className="app-stat-grid app-stat-grid-5">
          <article className="app-stat-card">
            <p>Total Farms</p>
            <strong>{overview.farmsCount}</strong>
          </article>
          <article className="app-stat-card">
            <p>Active Crops</p>
            <strong>{overview.activeCrops}</strong>
          </article>
          <article className="app-stat-card">
            <p>Harvest in 14 Days</p>
            <strong>{overview.upcomingHarvests}</strong>
          </article>
          <article className="app-stat-card">
            <p>Average Cycle Progress</p>
            <strong>{overview.averageCycleProgress}%</strong>
          </article>
          <article className="app-stat-card">
            <p>Past Harvest Date</p>
            <strong>{overview.atRisk}</strong>
          </article>
        </div>
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">
            <Link to="/app/fields/analytics" className="app-inline-link">Field Monitoring Analytics by Field</Link>
          </h2>
          <p className="app-subtitle">Each field has its own Soil, Weather, Growth, Water, Pest, and Overall health scores.</p>
        </div>

        {monitoringByField.length === 0 && <p className="app-muted">No fields yet. Add a farm and crop to view field analytics.</p>}

        <div className="app-crop-analytics-grid">
          {monitoringByField.map((field) => (
            <article key={field.farm.id} className="app-analytics-card">
              <div className="app-analytics-head">
                <div>
                  <h3>{field.farm.name}</h3>
                  <p>{field.activeCropCount} active crop(s)</p>
                </div>
                <ProgressRing percent={field.fieldHealthIndex} color={scoreColor(field.fieldHealthIndex)} />
              </div>

              <div className="app-stage-note">
                <Link to={`/app/fields/${field.farm.id}/analytics`} className="app-inline-link">Open full farm analytics</Link>
              </div>

              <div className="app-score-grid">
                {[
                  { label: "Soil Health", value: field.soilHealthScore },
                  { label: "Weather Suitability", value: field.weatherSuitabilityScore },
                  { label: "Growth Score", value: field.growthScore },
                  { label: "Water Stress", value: field.waterStressScore },
                  { label: "Pest Impact", value: field.pestImpactScore },
                  { label: "Field Health Index", value: field.fieldHealthIndex },
                ].map((score) => (
                  <div key={score.label} className="app-stat-card app-stat-card-score">
                    <p>{score.label}</p>
                    <div className="app-score-row">
                      <strong style={{ color: scoreColor(score.value) }}>{score.value}%</strong>
                    </div>
                    <div className="app-progress-bar app-progress-bar-score">
                      <span style={{ width: `${score.value}%`, background: scoreColor(score.value) }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">Farms and Current Crops</h2>
          <p className="app-subtitle">Quick links for all farms with the current crop, stage, and progress.</p>
        </div>

        {loadError && <p className="app-error">{loadError}</p>}

        {farms.length === 0 && (
          <div className="app-empty">
            <p>No farms yet. Add a farm, then add crops and cycle data for analytics.</p>
            {isAdmin && <Link to="/app/farms/new" className="app-btn app-btn-solid">Create First Farm</Link>}
          </div>
        )}

        <div className="app-farm-grid">
          {farmSnapshots.map(({ farm, currentCrop, activeCropCount, averageProgress }) => (
            <article key={farm.id} className="app-farm-card">
              <div className="app-farm-head">
                <div>
                  <h3>{farm.name}</h3>
                  <p>ID: {farm.farmCode}</p>
                  {farm.location && <p>{farm.location}</p>}
                </div>
                <span className="app-pill">{activeCropCount} active</span>
              </div>

              {!currentCrop && (
                <div className="app-empty-inline">
                  <p>No active crop in this farm yet.</p>
                  {isAdmin && <Link to="/app/crops/new" className="app-btn app-btn-outline">Add Crop</Link>}
                </div>
              )}

              {currentCrop && (
                <>
                  <Link to={`/app/crops/${currentCrop.id}`} className="app-crop-link">
                    <div className="app-crop-main">
                      <div>
                        <h4>{currentCrop.name}</h4>
                        <p>Planting: {formatDate(currentCrop.plantingDate)}</p>
                        <p>Harvest: {formatDate(currentCrop.expectedHarvestDate)}</p>
                        <p>Cycle: Day {currentCrop.day}/{currentCrop.totalDays}</p>
                        <p>Stage: {currentCrop.stage.name}</p>
                      </div>
                      <ProgressRing percent={currentCrop.percent} />
                    </div>
                  </Link>

                  <div className="app-progress-inline">
                    <div className="app-progress-bar">
                      <span style={{ width: `${currentCrop.percent}%` }} />
                    </div>
                    <small>{averageProgress}% average across farm crops</small>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">Crop Analytics</h2>
          <p className="app-subtitle">Current crops, cycle timing, stage details, and harvest readiness.</p>
        </div>

        {cropAnalytics.length === 0 && <p className="app-muted">No active crops yet. Add a crop to start cycle analytics.</p>}

        {cropAnalytics.length > 0 && (
          <div className="app-crop-analytics-grid">
            {cropAnalytics.map((crop) => (
              <article key={crop.id} className="app-analytics-card">
                <div className="app-analytics-head">
                  <div>
                    <h3>{crop.name}</h3>
                    <p>{crop.farmName || "Unassigned farm"}</p>
                  </div>
                  <ProgressRing percent={crop.percent} />
                </div>

                <div className="app-analytics-body">
                  <p><strong>Cycle:</strong> Day {crop.day}/{crop.totalDays}</p>
                  <p><strong>Stage:</strong> {crop.stage.name}</p>
                  <p><strong>Planting:</strong> {formatDate(crop.plantingDate)}</p>
                  <p><strong>Harvest:</strong> {formatDate(crop.expectedHarvestDate)}</p>
                  {crop.daysToHarvest !== null && (
                    <p>
                      <strong>Harvest countdown:</strong>{" "}
                      {crop.daysToHarvest >= 0 ? `${crop.daysToHarvest} days left` : `${Math.abs(crop.daysToHarvest)} days overdue`}
                    </p>
                  )}
                </div>

                <div className="app-progress-inline">
                  <div className="app-progress-bar">
                    <span style={{ width: `${crop.percent}%` }} />
                  </div>
                  <small>{crop.percent}% completed</small>
                </div>

                <div className="app-stage-note">
                  <p><strong>Current stage guidance:</strong> {crop.stage.tips.join(", ")}.</p>
                  <Link to={`/app/crops/${crop.id}`} className="app-inline-link">Open crop details</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">Weather Focus (Secondary)</h2>
          <p className="app-subtitle">Weather stays visible for planning while crop analytics remain the primary focus.</p>
        </div>
        {weatherFarmOptions.length > 0 && (
          <label className="app-field app-weather-farm-picker">
            <span>Weather Farm</span>
            <select className="app-select" value={selectedWeatherFarm?.id || ""} onChange={(e) => setWeatherFarmId(e.target.value)}>
              {weatherFarmOptions.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} ({farm.farmCode})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="app-grid-2">
          <WeatherCard coords={weatherCoords} locationLabel={selectedWeatherFarm?.location || selectedWeatherFarm?.name || "Harare"} />
          <WeatherAlerts crops={crops} coords={weatherCoords} />
        </div>
      </section>
    </div>
  );
}
