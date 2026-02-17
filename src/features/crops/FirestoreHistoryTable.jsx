import { Link } from "react-router-dom";
import LoadingAnimation from "../../components/LoadingAnimation";

function toTitleCaseFromKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function isTimestampLike(key, value) {
  if (typeof value !== "number") return false;
  if (value < 100000000000) return false;
  return /(timestamp|updatedAt|createdAt|time)/i.test(key);
}

function formatCellValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";

  if (Array.isArray(value)) {
    if (!value.length) return "-";
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (isTimestampLike(key, value)) {
    return new Date(value).toLocaleString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

const TYPE_COLUMNS = {
  growth: ["date", "fieldName", "cropName", "userFirstName", "ndviIndex", "leafColorIndex", "plantPopulationPerSqm", "growthScore"],
  irrigation: [
    "date",
    "fieldName",
    "cropName",
    "userFirstName",
    "irrigationMethod",
    "soilMoistureBefore",
    "soilMoistureAfter",
    "waterAmountMm",
    "waterStressScore",
  ],
  pest: ["date", "fieldName", "cropName", "userFirstName", "affectedAreaPercentage", "severityLevel", "actionTaken", "pestImpactScore"],
  fumigation: ["date", "fieldName", "cropName", "userFirstName", "status", "pest", "productName", "dosage", "method"],
};

const HEADER_LABELS = {
  date: "Date",
  fieldName: "Field",
  userFirstName: "User",
  ndviIndex: "NDVI",
  leafColorIndex: "Leaf",
  plantPopulationPerSqm: "Plant Pop",
  growthScore: "Growth",
  irrigationMethod: "Method",
  soilMoistureBefore: "Moisture Before",
  soilMoistureAfter: "Moisture After",
  waterAmountMm: "Water",
  waterStressScore: "Water Stress",
  affectedAreaPercentage: "Affected %",
  severityLevel: "Severity",
  actionTaken: "Action",
  pestImpactScore: "Pest Impact",
  status: "Status",
  pest: "Pest",
  productName: "Product",
  dosage: "Dosage",
};

function formatDateValue(value) {
  if (!value) return "-";
  if (typeof value === "string") {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
    return value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return String(value);
}

function firstName(value) {
  if (!value || typeof value !== "string") return "";
  const token = value.trim().split(/\s+/)[0];
  return token || "";
}

function toDisplayRow(row = {}) {
  const dateValue = row.observedOn || row.scheduledFor || row.timestamp || row.date || "";

  return {
    ...row,
    date: formatDateValue(dateValue),
    fieldName: row.fieldName || row.farmName || row.fieldId || "-",
    userFirstName: row.userFirstName || firstName(row.userName) || firstName(row.displayName) || "-",
    pest: row.pest || row.targetPest || "-",
    dosage: row.dosage ?? row.dosageMlPerHa ?? "-",
  };
}

function deriveHeaders(rows) {
  const headers = [];
  const seen = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (key === "id") return;
      if (seen.has(key)) return;
      seen.add(key);
      headers.push(key);
    });
  });

  return headers;
}

export default function FirestoreHistoryTable({
  rows,
  loading,
  emptyMessage,
  maxRows,
  type,
  showDetails = false,
}) {
  if (loading) {
    return <LoadingAnimation label="Loading history..." scope="inline" />;
  }

  const sourceRows = Array.isArray(rows) ? rows : [];
  const displayRows = Number.isFinite(maxRows) ? sourceRows.slice(0, maxRows) : sourceRows;
  const displayData = displayRows.map((row) => toDisplayRow(row));
  const headers = TYPE_COLUMNS[type] || deriveHeaders(displayData).filter((key) => !["seasonId", "fieldId", "userId", "notes", "timestamp", "targetPest", "dosageMlPerHa"].includes(key));

  if (!displayData.length) {
    return <p className="app-muted">{emptyMessage || "No history records available."}</p>;
  }

  return (
    <div className="app-table-wrap">
      <table className="app-table app-history-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{HEADER_LABELS[header] || toTitleCaseFromKey(header)}</th>
            ))}
            {showDetails && <th>Details</th>}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, index) => (
            <tr key={row.id || `${row.timestamp || "row"}-${index}`}>
              {headers.map((header) => (
                <td key={`${row.id || index}-${header}`}>{formatCellValue(header, row[header])}</td>
              ))}
              {showDetails && (
                <td>
                  {row.id ? (
                    <Link
                      to={`/app/history/${type}/${row.id}?fieldId=${encodeURIComponent(row.fieldId || "")}&seasonId=${encodeURIComponent(row.seasonId || "")}`}
                      state={{ row }}
                      className="app-inline-link"
                    >
                      View
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
