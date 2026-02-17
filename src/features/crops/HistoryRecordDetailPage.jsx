import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import { HISTORY_CONFIG } from "./historyConfig";
import { resolveUserFirstNames } from "./historyUsers";
import {
  createNotificationsForUsers,
  listKnownUserIds,
} from "../notifications/notifications.service";
import LoadingAnimation from "../../components/LoadingAnimation";

function toLabel(key) {
  const labels = {
    targetPest: "Pest",
    dosageMlPerHa: "Dosage",
    userId: "User ID",
    userFirstName: "User",
    fieldId: "Field ID",
    fieldName: "Field",
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && /(timestamp|time|date)/i.test(key) && value > 100000000000) {
    return new Date(value).toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function HistoryRecordDetailPage() {
  const { user } = useAuth();
  const { type, recordId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [row, setRow] = useState(location.state?.row || null);
  const [loading, setLoading] = useState(!location.state?.row);
  const [savingDone, setSavingDone] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const config = HISTORY_CONFIG[type] || HISTORY_CONFIG.growth;
  const showDoneAction = type === "irrigation" || type === "fumigation";

  const recordPath = useMemo(() => {
    const fieldId = row?.fieldId || searchParams.get("fieldId");
    const seasonId = row?.seasonId || searchParams.get("seasonId");
    if (!fieldId || !seasonId || !recordId || !user) return null;
    return doc(db, "users", user.uid, "fields", fieldId, "seasons", seasonId, config.collectionName, recordId);
  }, [row, searchParams, recordId, user, config.collectionName]);

  const alreadyDone = useMemo(() => {
    if (!row) return false;
    if (type === "irrigation") {
      return Boolean(row.irrigatorId || row.irrigationDoneOn || row.irrigationCompletedAt);
    }
    if (type === "fumigation") {
      return Boolean(row.fumigatorId || row.fumigationDoneOn || row.fumigationCompletedAt || row.status === "completed");
    }
    return false;
  }, [row, type]);

  useEffect(() => {
    if (!user || row) return;
    const fieldId = searchParams.get("fieldId");
    const seasonId = searchParams.get("seasonId");
    if (!fieldId || !seasonId || !recordId) {
      setLoading(false);
      setError("Missing identifiers to load this record.");
      return;
    }

    let active = true;
    setLoading(true);

    getDoc(doc(db, "users", user.uid, "fields", fieldId, "seasons", seasonId, config.collectionName, recordId))
      .then(async (snap) => {
        if (!active) return;
        if (!snap.exists()) {
          setError("Record not found.");
          setRow(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        const nameMap = await resolveUserFirstNames([data.userId], user);
        if (!active) return;
        setRow({
          ...data,
          fieldName: data.fieldName || data.fieldId || "-",
          userFirstName: nameMap[data.userId] || "Unknown",
        });
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load record details:", err);
        setError("Unable to load record details.");
        setRow(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, row, searchParams, recordId, config.collectionName]);

  const entries = useMemo(() => {
    if (!row) return [];
    return Object.entries(row).sort(([a], [b]) => a.localeCompare(b));
  }, [row]);

  async function markAsDone() {
    if (!showDoneAction || !user || !recordPath || !row) return;

    const actionLabel = type === "irrigation" ? "irrigation" : "fumigation";
    const confirmed = window.confirm(`Confirm this ${actionLabel} work is done?`);
    if (!confirmed) return;

    const todayISO = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const donePayload =
      type === "irrigation"
        ? {
            irrigatorId: user.uid,
            irrigationDoneOn: todayISO,
            irrigationCompletedAt: now,
            updatedAt: now,
          }
        : {
            fumigatorId: user.uid,
            fumigationDoneOn: todayISO,
            fumigationCompletedAt: now,
            status: "completed",
            updatedAt: now,
          };

    setSavingDone(true);
    setError("");
    setToast("");
    try {
      await updateDoc(recordPath, donePayload);
      try {
        const knownUserIds = await listKnownUserIds();
        const actorName = user.displayName || user.email || user.uid;
        const targetLabel = type === "irrigation" ? "Irrigation" : "Fumigation";
        const cropName = row.cropName || "Crop";
        const fieldName = row.fieldName || row.fieldId || "field";
        await createNotificationsForUsers(knownUserIds.length ? knownUserIds : [user.uid], {
          title: `${targetLabel} Completed`,
          message: `${targetLabel} for ${cropName} on ${fieldName} was marked as done by ${actorName}.`,
          type: `${type}_done`,
          actorId: user.uid,
          actorName,
          route: `/app/history/${type}/${recordId}?fieldId=${encodeURIComponent(row.fieldId || "")}&seasonId=${encodeURIComponent(row.seasonId || "")}`,
          meta: {
            recordId,
            type,
            fieldId: row.fieldId || "",
            seasonId: row.seasonId || "",
            cropId: row.cropId || "",
          },
        });
      } catch (notifyErr) {
        console.error("Failed to create notifications:", notifyErr);
      }
      setRow((current) => ({ ...(current || {}), ...donePayload }));
      setToast(`${config.label.replace(" History", "")} marked as done.`);
    } catch (err) {
      console.error("Failed to mark record as done:", err);
      setError(`Unable to mark ${actionLabel} as done.`);
    } finally {
      setSavingDone(false);
    }
  }

  return (
    <div className="app-page-stack">
      <section className="app-card app-monitoring-hero">
        <div className="app-monitoring-hero-head">
          <div>
            <h1 className="app-monitoring-hero-title">{config.label} Details</h1>
            <p className="app-monitoring-hero-subtitle">Full record information for this history entry.</p>
          </div>
          <div className="app-actions-row">
            {showDoneAction && row && (
              <button
                type="button"
                className="app-btn app-btn-solid"
                onClick={markAsDone}
                disabled={savingDone || alreadyDone || loading}
              >
                {savingDone ? "Updating..." : alreadyDone ? "Already Done" : "Mark as Done"}
              </button>
            )}
            <Link to={`/app/history/${type}`} className="app-btn app-btn-outline app-monitoring-hero-back">Back to {config.label}</Link>
          </div>
        </div>
      </section>

      <section className="app-card">
        {toast && <div className="app-toast-success">{toast}</div>}
        {loading && <LoadingAnimation label="Loading record details..." />}
        {error && <p className="app-error">{error}</p>}
        {!loading && !error && !row && <p className="app-muted">No data available for this record.</p>}

        {!loading && !error && row && (
          <div className="app-table-wrap">
            <table className="app-table app-history-table" style={{ minWidth: "0" }}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, value]) => (
                  <tr key={key}>
                    <td>{toLabel(key)}</td>
                    <td>{formatValue(key, value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
