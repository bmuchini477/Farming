import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import { listActiveCropsWithMonitoring } from "./crops.service";
import FieldMonitoringForms from "./FieldMonitoringForms";
import FirestoreHistoryTable from "./FirestoreHistoryTable";
import { resolveUserFirstNames } from "./historyUsers";
import LoadingAnimation from "../../components/LoadingAnimation";

function formatDate(isoDate) {
  if (!isoDate) return "-";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toISOFromTimestamp(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().slice(0, 10);
}

export default function FieldMonitoringHubPage() {
  const { user } = useAuth();

  const [crops, setCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState("");
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  const [history, setHistory] = useState({
    growth: [],
    irrigation: [],
    pest: [],
    fumigation: [],
  });

  useEffect(() => {
    if (!user) return;

    let active = true;

    listActiveCropsWithMonitoring()
      .then((rows) => {
        if (!active) return;
        setCrops(rows);
        if (!rows.length) {
          setSelectedCropId("");
          return;
        }
        setSelectedCropId((current) => {
          if (current && rows.some((crop) => crop.id === current)) return current;
          return rows[0].id;
        });
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load active crops:", err);
        setError("Unable to load crops for monitoring right now.");
        setCrops([]);
        setSelectedCropId("");
      })
      .finally(() => {
        if (active) setLoadingCrops(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const selectedCrop = useMemo(() => {
    if (!selectedCropId) return null;
    return crops.find((crop) => crop.id === selectedCropId) || null;
  }, [crops, selectedCropId]);

  useEffect(() => {
    if (!user || !selectedCrop) return;

    let active = true;
    setLoadingHistory(true);

    const seasonId = selectedCrop.seasonId || selectedCrop.id;
    const seasonOwnerUserId = selectedCrop.userId || user.uid;
    const seasonRef = doc(db, "users", seasonOwnerUserId, "fields", selectedCrop.farmId, "seasons", seasonId);

    Promise.all([
      getDocs(query(collection(seasonRef, "growthRecords"), orderBy("timestamp", "desc"), limit(5))),
      getDocs(query(collection(seasonRef, "irrigationLogs"), orderBy("timestamp", "desc"), limit(5))),
      getDocs(query(collection(seasonRef, "pestReports"), orderBy("timestamp", "desc"), limit(5))),
      getDocs(query(collection(seasonRef, "fumigationSchedules"), orderBy("timestamp", "desc"), limit(5))),
    ])
      .then(async ([growthSnap, irrigationSnap, pestSnap, fumigationSnap]) => {
        if (!active) return;

        const growthRows = growthSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const irrigationRows = irrigationSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const pestRows = pestSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const fumigationRows = fumigationSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const allRows = [...growthRows, ...irrigationRows, ...pestRows, ...fumigationRows];
        const nameMap = await resolveUserFirstNames(allRows.map((row) => row.userId), user);
        if (!active) return;

        const withMeta = (row) => ({
          ...row,
          fieldName: selectedCrop.fieldName || selectedCrop.farmName || selectedCrop.farmId || row.fieldId || "-",
          userFirstName: nameMap[row.userId] || "Unknown",
        });

        setHistory({
          growth: growthRows.map(withMeta),
          irrigation: irrigationRows.map(withMeta),
          pest: pestRows.map(withMeta),
          fumigation: fumigationRows.map(withMeta),
        });
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load monitoring history:", err);
        setError("Unable to load monitoring history for this crop.");
        setHistory({ growth: [], irrigation: [], pest: [], fumigation: [] });
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedCrop, refreshToken]);

  const overview = useMemo(() => {
    const recentGrowth = history.growth.slice(0, 7);
    const recentIrrigation = history.irrigation.slice(0, 7);
    const todayISO = new Date().toISOString().slice(0, 10);

    const daysWithData = new Set();
    [...history.growth, ...history.irrigation, ...history.pest].forEach((row) => {
      if (row.observedOn) {
        daysWithData.add(row.observedOn);
      } else {
        const iso = toISOFromTimestamp(row.timestamp);
        if (iso) daysWithData.add(iso);
      }
    });

    const upcomingFumigations = history.fumigation.filter(
      (row) => row.status === "planned" && row.scheduledFor && row.scheduledFor >= todayISO
    ).length;

    return {
      recentGrowthRecords: recentGrowth.length,
      avgNdvi: average(recentGrowth.map((row) => Number(row.ndviIndex || 0))),
      avgLeafColor: average(recentGrowth.map((row) => Number(row.leafColorIndex || 0))),
      avgPopulation: average(recentGrowth.map((row) => Number(row.plantPopulationPerSqm || 0))),
      avgWaterMm: average(recentIrrigation.map((row) => Number(row.waterAmountMm || 0))),
      loggedDays: daysWithData.size,
      upcomingFumigations,
    };
  }, [history]);

  return (
    <div className="app-page-stack">
      <section className="app-card app-monitoring-hero">
        <div className="app-monitoring-hero-head">
          <div>
            <h1 className="app-monitoring-hero-title">Monitoring Forms and Crop Histories</h1>
            <p className="app-monitoring-hero-subtitle">
              Capture daily growth, irrigation, pest control and fumigation scheduling records. Every crop keeps its own history.
            </p>
          </div>

          <div className="app-actions-row">
            <Link to="/app" className="app-btn app-btn-outline app-monitoring-hero-back">Back to Dashboard</Link>
          </div>
        </div>

        {error && <p className="app-error">{error}</p>}

        <div className="app-monitoring-hero-controls">
          {loadingCrops && <LoadingAnimation label="Loading crop seasons..." scope="inline" />}
          <label className="app-field app-monitoring-hero-field">
            <span>Select Crop Season</span>
            <select
              className="app-select"
              value={selectedCropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              disabled={loadingCrops || crops.length === 0}
            >
              {crops.length === 0 && <option value="">No active crops available</option>}
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name} - {crop.fieldName || crop.farmName || crop.farmId} ({formatDate(crop.plantingDate)} to {formatDate(crop.expectedHarvestDate)})
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedCrop && (
        <>
          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Monitoring Overview (Latest Data)</h2>
            </div>

            <div className="app-stat-grid app-stat-grid-5 app-monitoring-overview-grid">
              <article className="app-stat-card"><p>Recent Growth Logs</p><strong>{overview.recentGrowthRecords}</strong></article>
              <article className="app-stat-card"><p>Avg NDVI</p><strong>{overview.avgNdvi.toFixed(2)}</strong></article>
              <article className="app-stat-card"><p>Avg Leaf Color</p><strong>{overview.avgLeafColor.toFixed(1)}</strong></article>
              <article className="app-stat-card"><p>Avg Plant Pop/Sqm</p><strong>{overview.avgPopulation.toFixed(1)}</strong></article>
              <article className="app-stat-card"><p>Avg Irrigation (mm)</p><strong>{overview.avgWaterMm.toFixed(1)}</strong></article>
            </div>

            <div className="app-stage-note">
              <p><strong>Logged Days:</strong> {overview.loggedDays}</p>
              <p><strong>Upcoming Fumigations:</strong> {overview.upcomingFumigations}</p>
            </div>
          </section>

          <FieldMonitoringForms crop={selectedCrop} onRecordSaved={() => setRefreshToken((current) => current + 1)} />

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Growth Monitoring History</h2>
              <p className="app-subtitle">Latest 5 activities. Open Growth History from the sidebar for full records.</p>
            </div>
            <FirestoreHistoryTable rows={history.growth} loading={loadingHistory} type="growth" showDetails emptyMessage="No growth records yet for this crop." />
          </section>

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Irrigation Log History</h2>
              <p className="app-subtitle">Latest 5 activities. Open Irrigation History from the sidebar for full records.</p>
            </div>
            <FirestoreHistoryTable rows={history.irrigation} loading={loadingHistory} type="irrigation" showDetails emptyMessage="No irrigation logs yet for this crop." />
          </section>

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Pest Control History</h2>
              <p className="app-subtitle">Latest 5 activities. Open Pest History from the sidebar for full records.</p>
            </div>
            <FirestoreHistoryTable rows={history.pest} loading={loadingHistory} type="pest" showDetails emptyMessage="No pest reports yet for this crop." />
          </section>

          <section className="app-card">
            <div className="app-card-head">
              <h2 className="app-title-sm">Fumigation Schedule History</h2>
              <p className="app-subtitle">Latest 5 activities. Open Fumigation History from the sidebar for full records.</p>
            </div>
            <FirestoreHistoryTable rows={history.fumigation} loading={loadingHistory} type="fumigation" showDetails emptyMessage="No fumigation schedules yet for this crop." />
          </section>
        </>
      )}
    </div>
  );
}
