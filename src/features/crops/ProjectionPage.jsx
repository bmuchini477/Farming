import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAdminStatus } from "../auth/useAdminStatus";
import { listFarms } from "../farms/farms.service";
import { listActiveCrops } from "./crops.service";
import LoadingAnimation from "../../components/LoadingAnimation";

const cropColors = ["#2563eb", "#f59e0b", "#16a34a", "#be185d", "#0891b2", "#7c3aed", "#ea580c", "#15803d"];

function colorForCrop(name) {
  const key = String(name || "").toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return cropColors[hash % cropColors.length];
}

export default function ProjectionPage() {
  const { user } = useAuth();
  const { isAdmin } = useAdminStatus(user);
  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;
    setLoading(true);
    setError("");

    Promise.all([listFarms(), listActiveCrops()])
      .then(([farmRows, cropRows]) => {
        if (!active) return;
        setFarms(farmRows);
        setCrops(cropRows);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load projection:", err);
        setError("Unable to load projection right now.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const projectionRows = useMemo(() => {
    return farms.map((farm) => {
      const farmCapacity = Number(farm.sizeHectares || 0);
      const farmCrops = crops.filter((crop) => crop.farmId === farm.id);
      const byCropMap = new Map();

      farmCrops.forEach((crop) => {
        const cropName = crop.name?.trim() || "Unnamed crop";
        const fieldSize = Number(crop.fieldSizeHectares || 0);
        byCropMap.set(cropName, (byCropMap.get(cropName) || 0) + fieldSize);
      });

      const byCrop = [...byCropMap.entries()]
        .map(([name, hectares]) => ({
          name,
          hectares,
          color: colorForCrop(name),
        }))
        .sort((a, b) => b.hectares - a.hectares);

      const occupied = byCrop.reduce((sum, row) => sum + row.hectares, 0);
      const hasCapacity = farmCapacity > 0;
      const free = hasCapacity ? Math.max(0, farmCapacity - occupied) : 0;
      const overAllocated = hasCapacity ? Math.max(0, occupied - farmCapacity) : 0;
      const utilization = hasCapacity ? Math.min(100, Math.round((occupied / farmCapacity) * 100)) : 0;

      return {
        farm,
        byCrop,
        occupied,
        farmCapacity,
        hasCapacity,
        free,
        overAllocated,
        utilization,
      };
    });
  }, [crops, farms]);

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">Farm Projection</h1>
            <p className="app-subtitle">See hectare occupation per farm and per crop in a visual map-style layout.</p>
          </div>
          <div className="app-actions-row">
            <Link to="/app" className="app-btn app-btn-outline">Back to Dashboard</Link>
            {isAdmin && <Link to="/app/crops/new" className="app-btn app-btn-solid">Add Crop</Link>}
          </div>
        </div>
      </section>

      {loading && (
        <section className="app-card">
          <LoadingAnimation label="Loading projection..." scope="inline" />
        </section>
      )}
      {!loading && error && <section className="app-card"><p className="app-error">{error}</p></section>}

      {!loading && !error && projectionRows.length === 0 && (
        <section className="app-card">
          <div className="app-empty">
            <p>No farms available. Add a farm first to see projection.</p>
            {isAdmin && <Link to="/app/farms/new" className="app-btn app-btn-solid">Add Farm</Link>}
          </div>
        </section>
      )}

      {!loading && !error && projectionRows.map((row) => (
        <section key={row.farm.id} className="app-card">
          <div className="app-card-head app-card-head-split">
            <div>
              {isAdmin ? (
                <Link to={`/app/farms/${row.farm.id}`} className="app-title-link">
                  <h2 className="app-title-sm">{row.farm.name}</h2>
                </Link>
              ) : (
                <h2 className="app-title-sm">{row.farm.name}</h2>
              )}
              <p className="app-subtitle">
                {row.hasCapacity
                  ? `Occupied ${row.occupied.toFixed(2)} ha of ${row.farmCapacity.toFixed(2)} ha (${row.utilization}%).`
                  : `Occupied ${row.occupied.toFixed(2)} ha. Add farm size to enforce limits.`}
              </p>
            </div>
            <div className="app-stat-grid app-stat-grid-projection">
              <article className="app-stat-card">
                <p>Occupied</p>
                <strong>{row.occupied.toFixed(2)} ha</strong>
              </article>
              <article className="app-stat-card">
                <p>Free</p>
                <strong>{row.hasCapacity ? `${row.free.toFixed(2)} ha` : "-"}</strong>
              </article>
              <article className="app-stat-card">
                <p>Active Crops</p>
                <strong>{row.byCrop.length}</strong>
              </article>
            </div>
          </div>

          <div className="app-projection-map" role="img" aria-label={`Occupation map for ${row.farm.name}`}>
            {(row.byCrop.length === 0 || row.occupied <= 0) && <span className="app-projection-empty">No crop area allocated</span>}

            {row.byCrop.map((crop) => {
              const width = row.hasCapacity && row.farmCapacity > 0
                ? Math.max(2, (crop.hectares / row.farmCapacity) * 100)
                : Math.max(8, (crop.hectares / Math.max(1, row.occupied)) * 100);

              return (
                <div
                  key={`${row.farm.id}-${crop.name}`}
                  className="app-projection-segment"
                  style={{ width: `${width}%`, background: crop.color }}
                  title={`${crop.name}: ${crop.hectares.toFixed(2)} ha`}
                >
                  <span>{crop.name}</span>
                </div>
              );
            })}

            {row.hasCapacity && row.free > 0 && (
              <div
                className="app-projection-segment app-projection-segment-free"
                style={{ width: `${Math.max(2, (row.free / row.farmCapacity) * 100)}%` }}
                title={`Free area: ${row.free.toFixed(2)} ha`}
              >
                <span>Free</span>
              </div>
            )}
          </div>

          {row.overAllocated > 0 && (
            <p className="app-error app-projection-overflow">
              Over-allocated by {row.overAllocated.toFixed(2)} ha. This farm needs crop area correction.
            </p>
          )}

          <div className="app-projection-legend">
            {row.byCrop.map((crop) => (
              <span key={`${row.farm.id}-legend-${crop.name}`} className="app-projection-legend-item">
                <i style={{ background: crop.color }} />
                {crop.name}: {crop.hectares.toFixed(2)} ha
              </span>
            ))}
            {row.hasCapacity && row.free > 0 && (
              <span className="app-projection-legend-item">
                <i className="app-projection-legend-free" />
                Free: {row.free.toFixed(2)} ha
              </span>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
