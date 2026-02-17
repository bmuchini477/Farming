import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { listActiveCropsWithMonitoring } from "./crops.service";
import { watchFarms } from "../farms/farms.service";
import ProgressRing from "../../components/ProgressRing";
import LoadingAnimation from "../../components/LoadingAnimation";
import {
  computeFieldHealthIndex,
  computeGrowthDeviation,
  computePestImpact,
  computeSoilHealth,
  computeWaterStress,
  computeWeatherSuitability,
} from "../../utils/fieldAnalytics";

function scoreColor(score) {
  if (score > 75) return "#148258";
  if (score >= 50) return "#c28a0e";
  return "#b42318";
}

function scoreCardsFromCrops(crops) {
  if (!crops.length) {
    return {
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

  crops.forEach((crop) => {
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
    soilHealthScore,
    weatherSuitabilityScore,
    growthScore,
    waterStressScore,
    pestImpactScore,
    fieldHealthIndex,
  };
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

export default function FieldAnalyticsPage() {
  const { user } = useAuth();
  const { farmId } = useParams();
  const navigate = useNavigate();

  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;

    setLoading(true);
    setError("");

    const unsubscribeFarms = watchFarms(
      (rows) => {
        if (!active) return;
        setFarms(rows);
      },
      (err) => {
        if (!active) return;
        console.error("Failed to load farms:", err);
        setError("Unable to load farms right now.");
        setFarms([]);
      }
    );

    listActiveCropsWithMonitoring()
      .then((rows) => {
        if (!active) return;
        setCrops(rows);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load crops:", err);
        setError((current) => current || "Unable to load crop monitoring data.");
        setCrops([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribeFarms();
    };
  }, [user]);

  const selectedFarm = useMemo(() => {
    if (!farms.length) return null;
    if (farmId) {
      return farms.find((farm) => farm.id === farmId) || null;
    }
    return farms[0];
  }, [farms, farmId]);

  const selectedFarmCrops = useMemo(() => {
    if (!selectedFarm) return [];
    return crops
      .filter((crop) => crop.farmId === selectedFarm.id)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }, [crops, selectedFarm]);

  useEffect(() => {
    if (!selectedFarm) return;
    if (farmId === selectedFarm.id) return;
    navigate(`/app/fields/${selectedFarm.id}/analytics`, { replace: true });
  }, [selectedFarm, farmId, navigate]);

  const scores = useMemo(() => scoreCardsFromCrops(selectedFarmCrops), [selectedFarmCrops]);

  const latestCrop = selectedFarmCrops[0] || null;
  const latestSnapshot = latestCrop?.seasonSnapshot || {};
  const latestSoil = latestSnapshot.latestSoilTest || {};
  const latestGrowth = latestSnapshot.latestGrowthRecord || {};
  const latestIrrigation = latestSnapshot.latestIrrigationLog || {};
  const latestPest = latestSnapshot.latestPestReport || {};

  const scoreCards = [
    { label: "Soil Health Score", value: scores.soilHealthScore },
    { label: "Weather Suitability", value: scores.weatherSuitabilityScore },
    { label: "Growth Score", value: scores.growthScore },
    { label: "Water Stress Index", value: scores.waterStressScore },
    { label: "Pest Impact", value: scores.pestImpactScore },
    { label: "Field Health Index", value: scores.fieldHealthIndex },
  ];
  const coordinatesText =
    Number.isFinite(Number(selectedFarm?.latitude)) && Number.isFinite(Number(selectedFarm?.longitude))
      ? `${Number(selectedFarm.latitude).toFixed(5)}, ${Number(selectedFarm.longitude).toFixed(5)}`
      : "-";

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">Full Field Analytics</h1>
            <p className="app-subtitle">Detailed monitoring analytics for one farm/field at a time.</p>
          </div>
          <div className="app-actions-row">
            <Link to="/app" className="app-btn app-btn-outline">Back to Dashboard</Link>
          </div>
        </div>

        <label className="app-field">
          <span>Select Farm/Field</span>
          <select
            className="app-select"
            value={selectedFarm?.id || ""}
            onChange={(e) => navigate(`/app/fields/${e.target.value}/analytics`)}
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name} ({farm.farmCode})
              </option>
            ))}
          </select>
        </label>

        {loading && <LoadingAnimation label="Loading full field analytics..." scope="inline" />}
        {!loading && error && <p className="app-error">{error}</p>}
      </section>

      {!loading && selectedFarm && (
        <>
          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">{selectedFarm.name} Performance Scores</h2>
              <p className="app-subtitle">Score breakdown from the latest season monitoring records for this field.</p>
            </div>

            <div className="app-score-grid">
              {scoreCards.map((card) => (
                <article key={card.label} className="app-stat-card app-stat-card-score">
                  <p>{card.label}</p>
                  <div className="app-score-row">
                    <ProgressRing percent={card.value} color={scoreColor(card.value)} />
                    <strong style={{ color: scoreColor(card.value) }}>{card.value}%</strong>
                  </div>
                  <div className="app-progress-bar app-progress-bar-score">
                    <span style={{ width: `${card.value}%`, background: scoreColor(card.value) }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Field Profile</h2>
            </div>
            <div className="app-stat-grid app-stat-grid-5">
              <article className="app-stat-card"><p>Farm ID</p><strong>{valueOrDash(selectedFarm.farmCode)}</strong></article>
              <article className="app-stat-card"><p>Location</p><strong>{valueOrDash(selectedFarm.location)}</strong></article>
              <article className="app-stat-card"><p>Field Size (ha)</p><strong>{valueOrDash(selectedFarm.sizeHectares)}</strong></article>
              <article className="app-stat-card"><p>Coordinates</p><strong>{coordinatesText}</strong></article>
              <article className="app-stat-card"><p>Active Crops</p><strong>{selectedFarmCrops.length}</strong></article>
            </div>
          </section>

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Latest Monitoring Snapshot</h2>
              <p className="app-subtitle">Latest soil, growth, irrigation, and pest data captured for this field.</p>
            </div>

            <div className="app-grid-2">
              <article className="app-analytics-card">
                <h3>Soil Test</h3>
                <div className="app-analytics-body">
                  <p><strong>Organic Matter:</strong> {valueOrDash(latestSoil.organicMatter)}</p>
                  <p><strong>Electrical Conductivity:</strong> {valueOrDash(latestSoil.electricalConductivity)}</p>
                  <p><strong>Soil Temperature:</strong> {valueOrDash(latestSoil.soilTemperature)}</p>
                  <p><strong>Soil Moisture:</strong> {valueOrDash(latestSoil.soilMoisture)}</p>
                </div>
              </article>

              <article className="app-analytics-card">
                <h3>Growth Monitoring</h3>
                <div className="app-analytics-body">
                  <p><strong>NDVI Index:</strong> {valueOrDash(latestGrowth.ndviIndex)}</p>
                  <p><strong>Leaf Color Index:</strong> {valueOrDash(latestGrowth.leafColorIndex)}</p>
                  <p><strong>Plant Population/Sqm:</strong> {valueOrDash(latestGrowth.plantPopulationPerSqm)}</p>
                  <p><strong>Days After Planting:</strong> {valueOrDash(latestGrowth.daysAfterPlanting)}</p>
                </div>
              </article>

              <article className="app-analytics-card">
                <h3>Irrigation Log</h3>
                <div className="app-analytics-body">
                  <p><strong>Soil Moisture Before:</strong> {valueOrDash(latestIrrigation.soilMoistureBefore)}</p>
                  <p><strong>Soil Moisture After:</strong> {valueOrDash(latestIrrigation.soilMoistureAfter)}</p>
                  <p><strong>Water Amount (mm):</strong> {valueOrDash(latestIrrigation.waterAmountMm)}</p>
                </div>
              </article>

              <article className="app-analytics-card">
                <h3>Pest & Disease</h3>
                <div className="app-analytics-body">
                  <p><strong>Affected Area (%):</strong> {valueOrDash(latestPest.affectedAreaPercentage)}</p>
                  <p><strong>Severity Level:</strong> {valueOrDash(latestPest.severityLevel)}</p>
                  <p><strong>Action Taken:</strong> {valueOrDash(latestPest.actionTaken)}</p>
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
