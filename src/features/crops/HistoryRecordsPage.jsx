import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import { listActiveCropsWithMonitoring } from "./crops.service";
import FirestoreHistoryTable from "./FirestoreHistoryTable";
import { resolveUserFirstNames } from "./historyUsers";
import { HISTORY_CONFIG } from "./historyConfig";
import LoadingAnimation from "../../components/LoadingAnimation";

function formatDate(isoDate) {
  if (!isoDate) return "-";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryRecordsPage() {
  const { user } = useAuth();
  const { type } = useParams();

  const config = HISTORY_CONFIG[type] || HISTORY_CONFIG.growth;

  const [crops, setCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState("");
  const [rows, setRows] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;

    listActiveCropsWithMonitoring()
      .then((cropRows) => {
        if (!active) return;
        setCrops(cropRows);

        if (!cropRows.length) {
          setSelectedCropId("");
          return;
        }

        setSelectedCropId((current) => {
          if (current && cropRows.some((crop) => crop.id === current)) return current;
          return cropRows[0].id;
        });
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load crops:", err);
        setError("Unable to load crops for this history page.");
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
    if (!user || !selectedCrop) {
      setRows([]);
      setLoadingRows(false);
      return;
    }

    let active = true;
    setLoadingRows(true);

    const seasonId = selectedCrop.seasonId || selectedCrop.id;
    const seasonOwnerUserId = selectedCrop.userId || user.uid;
    const seasonRef = doc(db, "users", seasonOwnerUserId, "fields", selectedCrop.farmId, "seasons", seasonId);

    getDocs(query(collection(seasonRef, config.collectionName), orderBy("timestamp", "desc")))
      .then(async (snap) => {
        if (!active) return;
        const dataRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nameMap = await resolveUserFirstNames(dataRows.map((row) => row.userId), user);
        if (!active) return;
        setRows(
          dataRows.map((row) => ({
            ...row,
            fieldName: selectedCrop.fieldName || selectedCrop.farmName || selectedCrop.farmId || row.fieldId || "-",
            userFirstName: nameMap[row.userId] || "Unknown",
          }))
        );
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load history rows:", err);
        setError("Unable to load history data right now.");
        setRows([]);
      })
      .finally(() => {
        if (active) setLoadingRows(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedCrop, config.collectionName]);

  return (
    <div className="app-page-stack">
      <section className="app-card app-monitoring-hero">
        <div className="app-monitoring-hero-head">
          <div>
            <h1 className="app-monitoring-hero-title">{config.label}</h1>
            <p className="app-monitoring-hero-subtitle">{config.subtitle}</p>
          </div>
          <div className="app-actions-row">
            <Link to="/app/monitoring" className="app-btn app-btn-outline app-monitoring-hero-back">Back to Monitoring</Link>
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

      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h2 className="app-title-sm">Full History Table</h2>
            <p className="app-subtitle">Showing only key fields. Open Details to view full record data.</p>
          </div>
          <span className="app-pill">{rows.length} record(s)</span>
        </div>

        <FirestoreHistoryTable
          rows={rows}
          loading={loadingRows}
          type={type}
          showDetails
          emptyMessage={`No ${config.label.toLowerCase()} records found for the selected crop.`}
        />
      </section>
    </div>
  );
}
