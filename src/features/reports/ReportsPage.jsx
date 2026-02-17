import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import Papa from "papaparse";
import { db } from "../../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import { stageForDay } from "../crops/cropStages";

const RECORD_TYPES = [
  { key: "soil", label: "Soil Tests", collectionName: "soilTests" },
  { key: "growth", label: "Growth Monitoring", collectionName: "growthRecords" },
  { key: "irrigation", label: "Irrigation Logs", collectionName: "irrigationLogs" },
  { key: "pest", label: "Pest Reports", collectionName: "pestReports" },
  { key: "fumigation", label: "Fumigation Schedules", collectionName: "fumigationSchedules" },
];

const RECORD_META_KEYS = new Set([
  "id",
  "recordType",
  "recordLabel",
  "farmId",
  "farmCode",
  "farmName",
  "cropId",
  "cropName",
  "seasonId",
  "fieldName",
  "fieldId",
  "userId",
  "timestamp",
]);

function daysBetween(aISO, bISO) {
  if (!aISO || !bISO) return 0;
  const a = new Date(`${aISO}T00:00:00`).getTime();
  const b = new Date(`${bISO}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return String(value);
}

function getRecordDate(record) {
  return record?.observedOn || record?.scheduledFor || (record?.timestamp ? formatDate(record.timestamp) : "-");
}

function formatMetric(value, digits = 1) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function summarizeRecordDetails(record) {
  return Object.entries(record)
    .filter(([key]) => !RECORD_META_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(" | ");
}

function buildFarmRecommendations(summary) {
  const recs = [];

  if (summary.cropCount === 0) recs.push("No active crops are linked to this farm. Add crop seasons to start data capture.");
  if (summary.totalRecords === 0) recs.push("No monitoring records captured yet. Start soil, growth, irrigation, pest, and fumigation logging.");
  if (summary.recordTotals.growth === 0) recs.push("No growth monitoring records found. Capture NDVI, leaf color, and population at least weekly.");
  if (summary.recordTotals.irrigation === 0) recs.push("No irrigation logs found. Track water applied and moisture change to optimize scheduling.");
  if (summary.recordTotals.pest === 0) recs.push("No pest reports logged. Run scouting checks and record severity plus affected area.");
  if (summary.avgGrowthScore > 0 && summary.avgGrowthScore < 60) recs.push("Growth score is below target. Review nutrient plan, recheck planting density, and inspect stress factors.");
  if (summary.avgWaterStressScore >= 60) recs.push("Water stress is elevated. Increase irrigation frequency checks and calibrate application volume.");
  if (summary.avgPestImpactScore >= 40) recs.push("Pest impact is high. Strengthen integrated pest management and verify treatment effectiveness.");
  if (summary.pendingFumigations > 0) recs.push(`There are ${summary.pendingFumigations} planned fumigation events. Confirm schedule readiness and safety controls.`);

  if (!recs.length) {
    recs.push("Monitoring metrics and records are in a healthy range. Keep the current capture cadence and continue weekly review.");
  }
  return recs;
}

function createPdfWriter(doc) {
  const marginX = 12;
  const marginBottom = 14;
  const lineHeight = 5.5;
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 14;

  const addNewPage = () => {
    doc.addPage();
    y = 14;
  };

  const ensureSpace = (lineCount = 1) => {
    const needed = lineCount * lineHeight;
    if (y + needed > pageHeight - marginBottom) {
      addNewPage();
    }
  };

  const write = (text, options = {}) => {
    const { bold = false, size = 10, indent = 0 } = options;
    const width = Math.max(30, usableWidth - indent);
    const lines = doc.splitTextToSize(String(text), width);
    
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    
    // Write lines one by one to handle pagination within long blocks
    lines.forEach((line) => {
      if (y + lineHeight > pageHeight - marginBottom) {
        addNewPage();
      }
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    });
  };

  const space = (height = 2) => {
    y += height;
    ensureSpace(0);
  };

  return { write, space, addNewPage };
}

export default function ReportsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [recordsByType, setRecordsByType] = useState({
    soil: [],
    growth: [],
    irrigation: [],
    pest: [],
    fumigation: [],
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState({});

  const todayISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) return;

    let active = true;
    setLoading(true);
    setError("");

    async function loadData() {
      try {
        const [farmSnap, cropSnap] = await Promise.all([getDocs(collection(db, "farms")), getDocs(collection(db, "crops"))]);
        if (!active) return;

        const farmRows = farmSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cropRows = cropSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFarms(farmRows);
        setCrops(cropRows);

        const tasks = [];
        cropRows.forEach((crop) => {
          const seasonOwnerUserId = crop.userId || user.uid;
          const seasonId = crop.seasonId || crop.id;
          if (!seasonOwnerUserId || !seasonId || !crop.farmId) return;

          const seasonRef = doc(db, "users", seasonOwnerUserId, "fields", crop.farmId, "seasons", seasonId);
          RECORD_TYPES.forEach((recordType) => {
            tasks.push(
              getDocs(collection(seasonRef, recordType.collectionName)).then((snap) => ({
                recordType,
                crop,
                rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
              }))
            );
          });
        });

        const settled = await Promise.allSettled(tasks);
        if (!active) return;

        const next = {
          soil: [],
          growth: [],
          irrigation: [],
          pest: [],
          fumigation: [],
        };

        settled.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const { crop, rows, recordType } = result.value;
          rows.forEach((row) => {
            next[recordType.key].push({
              ...row,
              recordType: recordType.key,
              recordLabel: recordType.label,
              farmId: crop.farmId || row.fieldId || "",
              farmCode: crop.farmCode || "",
              farmName: crop.farmName || crop.fieldName || "",
              cropId: crop.id,
              cropName: crop.name || row.cropName || "-",
              seasonId: crop.seasonId || crop.id,
              fieldName: crop.fieldName || crop.farmName || row.fieldName || "-",
            });
          });
        });

        Object.keys(next).forEach((key) => {
          next[key].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
        });

        setRecordsByType(next);
      } catch (err) {
        console.error("Failed to load report data:", err);
        if (active) setError("Unable to load full report data right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [user]);

  const reportData = useMemo(() => {
    const farmsMap = new Map(farms.map((farm) => [farm.id, farm]));
    const unassignedFarmId = "__unassigned__";
    const grouped = new Map();

    farms.forEach((farm) => {
      grouped.set(farm.id, {
        farmId: farm.id,
        farmName: farm.name || "Unnamed Farm",
        farmCode: farm.farmCode || "-",
        location: farm.location || "-",
        managerName: farm.managerName || "-",
        cropRows: [],
        recordRows: [],
      });
    });

    const flattenedRecords = Object.values(recordsByType).flat();
    const recordsByCropId = new Map();
    flattenedRecords.forEach((record) => {
      const key = record.cropId || "";
      if (!recordsByCropId.has(key)) recordsByCropId.set(key, []);
      recordsByCropId.get(key).push(record);
    });

    crops.forEach((crop) => {
      const farmId = crop.farmId || unassignedFarmId;
      if (!grouped.has(farmId)) {
        const fallbackFarm = farmsMap.get(farmId);
        grouped.set(farmId, {
          farmId,
          farmName: fallbackFarm?.name || crop.farmName || "Unassigned Farm",
          farmCode: fallbackFarm?.farmCode || crop.farmCode || "-",
          location: fallbackFarm?.location || "-",
          managerName: fallbackFarm?.managerName || "-",
          cropRows: [],
          recordRows: [],
        });
      }

      const totalDays = Math.max(1, toNumber(crop.totalDays));
      const currentDay = Math.min(totalDays, Math.max(0, daysBetween(crop.plantingDate, todayISO) + 1));
      const stage = stageForDay(currentDay).name;
      grouped.get(farmId).cropRows.push({
        cropId: crop.id,
        cropName: crop.name || "-",
        variety: crop.variety || "-",
        status: crop.status || "active",
        stage,
        dayCycle: `${currentDay}/${totalDays}`,
        plantingDate: crop.plantingDate || "-",
        expectedHarvestDate: crop.expectedHarvestDate || "-",
      });

      const cropRecords = recordsByCropId.get(crop.id) || [];
      grouped.get(farmId).recordRows.push(...cropRecords);
    });

    flattenedRecords.forEach((record) => {
      if (!record.farmId || grouped.has(record.farmId)) return;
      grouped.set(record.farmId, {
        farmId: record.farmId,
        farmName: record.farmName || "Unassigned Farm",
        farmCode: record.farmCode || "-",
        location: "-",
        managerName: "-",
        cropRows: [],
        recordRows: [record],
      });
    });

    const farmSummaries = Array.from(grouped.values())
      .map((farmGroup) => {
        const recordTotals = {
          soil: 0,
          growth: 0,
          irrigation: 0,
          pest: 0,
          fumigation: 0,
        };

        farmGroup.recordRows.forEach((row) => {
          if (recordTotals[row.recordType] !== undefined) recordTotals[row.recordType] += 1;
        });

        const growthScores = farmGroup.recordRows
          .filter((row) => row.recordType === "growth")
          .map((row) => toNumber(row.growthScore))
          .filter((value) => value > 0);
        const waterStressScores = farmGroup.recordRows
          .filter((row) => row.recordType === "irrigation")
          .map((row) => toNumber(row.waterStressScore))
          .filter((value) => value > 0);
        const pestImpactScores = farmGroup.recordRows
          .filter((row) => row.recordType === "pest")
          .map((row) => toNumber(row.pestImpactScore))
          .filter((value) => value > 0);

        const pendingFumigations = farmGroup.recordRows.filter(
          (row) => row.recordType === "fumigation" && row.status === "planned" && row.scheduledFor >= todayISO
        ).length;

        const totalRecords = Object.values(recordTotals).reduce((sum, value) => sum + value, 0);
        const summary = {
          ...farmGroup,
          cropCount: farmGroup.cropRows.length,
          totalRecords,
          recordTotals,
          avgGrowthScore: average(growthScores),
          avgWaterStressScore: average(waterStressScores),
          avgPestImpactScore: average(pestImpactScores),
          pendingFumigations,
        };

        return {
          ...summary,
          recommendations: buildFarmRecommendations(summary),
        };
      })
      .sort((a, b) => a.farmName.localeCompare(b.farmName));

    const globalTotals = farmSummaries.reduce(
      (acc, farm) => {
        acc.farms += 1;
        acc.crops += farm.cropCount;
        acc.records += farm.totalRecords;
        acc.soil += farm.recordTotals.soil;
        acc.growth += farm.recordTotals.growth;
        acc.irrigation += farm.recordTotals.irrigation;
        acc.pest += farm.recordTotals.pest;
        acc.fumigation += farm.recordTotals.fumigation;
        return acc;
      },
      { farms: 0, crops: 0, records: 0, soil: 0, growth: 0, irrigation: 0, pest: 0, fumigation: 0 }
    );

    const detailedRows = farmSummaries
      .flatMap((farm) => farm.recordRows.map((row) => ({ ...row, farmName: farm.farmName, farmCode: farm.farmCode })))
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

    return { farmSummaries, globalTotals, detailedRows };
  }, [crops, farms, recordsByType, todayISO]);

  async function generateAiAnalysis() {
    if (analyzing) return;
    setAnalyzing(true);
    setAiAnalysis({});

    try {
      const results = {};
      
      // Analyze each farm sequentially to avoid rate limits
      for (const farm of reportData.farmSummaries) {
        if(farm.totalRecords === 0 && farm.cropCount === 0) continue;

        const context = {
            farmCount: 1,
            farms: [{ name: farm.farmName, location: farm.location }],
            cropCount: farm.cropCount,
            activeCropCount: farm.cropRows.filter(c => c.status === 'active').length,
            crops: farm.cropRows.map(c => ({
                name: c.cropName,
                variety: c.variety,
                status: c.status,
                plantingDate: c.plantingDate,
                expectedHarvestDate: c.expectedHarvestDate
            })),
            monitoring: farm.recordRows.slice(0, 50).map(r => ({
                type: r.recordLabel,
                date: getRecordDate(r),
                details: summarizeRecordDetails(r)
            }))
        };

        const prompt = `Analyze the farming data for ${farm.farmName}. Identify trends in growth, irrigation, and pest control. Provide 3-5 specific, actionable high-level recommendations to improve yield and efficiency based on the provided records and crop stages. Do not include conversational fillers.`;
        
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, context }),
        });

        if (response.ok) {
          const data = await response.json();
          results[farm.farmId] = data.reply;
        }
      }
      setAiAnalysis(results);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      alert("Failed to generate AI analysis. Make sure the backend 'npm run api' is running.");
    } finally {
      setAnalyzing(false);
    }
  }

  function exportCSV() {
    const csvRows = reportData.detailedRows.map((row) => ({
      farmName: row.farmName,
      farmCode: row.farmCode,
      cropName: row.cropName,
      recordType: row.recordLabel,
      date: getRecordDate(row),
      timestamp: row.timestamp || "",
      details: summarizeRecordDetails(row),
      rawData: JSON.stringify(row),
    }));

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "farm-monitoring-full-report.csv";
    a.click();
  }

  const [isExporting, setIsExporting] = useState(false);

  // ... (existing code)

  async function exportPDF() {
    if (isExporting) return;
    setIsExporting(true);
    
    // Small timeout to allow UI to update before blocking main thread with PDF generation
    setTimeout(() => {
        try {
            const doc = new jsPDF();
            const writer = createPdfWriter(doc);

            writer.write("FarmTrack Consolidated Monitoring Report", { bold: true, size: 16 });
            writer.write(`Generated on: ${todayISO}`);
            writer.space(1);
            writer.write(
              `Farms: ${reportData.globalTotals.farms} | Crops: ${reportData.globalTotals.crops} | Total Records: ${reportData.globalTotals.records}`
            );
            writer.write(
              `Soil: ${reportData.globalTotals.soil} | Growth: ${reportData.globalTotals.growth} | Irrigation: ${reportData.globalTotals.irrigation} | Pest: ${reportData.globalTotals.pest} | Fumigation: ${reportData.globalTotals.fumigation}`
            );
            writer.space(2);

            reportData.farmSummaries.forEach((farm, farmIndex) => {
              if (farmIndex > 0) writer.addNewPage();
              
              // Farm Header - using same writer
              writer.write(`Farm: ${farm.farmName} (${farm.farmCode})`, { bold: true, size: 14 });
              writer.write(`Location: ${farm.location} | Manager: ${farm.managerName} | Records: ${farm.totalRecords}`);
              writer.space(1);

              // AI Analysis Section
              if (aiAnalysis[farm.farmId]) {
                writer.write("AI Analysis & Recommendations", { bold: true, size: 12 });
                writer.write(aiAnalysis[farm.farmId], { size: 10 });
                writer.space(1);
              } else {
                 writer.write("Automated Recommendations", { bold: true, size: 12 });
                 farm.recommendations.forEach((rec) => writer.write(`- ${rec}`, { indent: 2 }));
                 writer.space(1);
              }

              // Crop Cycles Table-like
              writer.write("Crop Cycle Summary", { bold: true, size: 12 });
              if (!farm.cropRows.length) {
                writer.write("- No crop cycles linked to this farm.", { indent: 2 });
              } else {
                farm.cropRows.forEach((cropRow) => {
                  writer.write(
                    `• ${cropRow.cropName} (${cropRow.variety})`,
                     { bold: true, indent: 2 }
                  );
                   writer.write(
                    `   Status: ${cropRow.status} | Stage: ${cropRow.stage} (Day ${cropRow.dayCycle})`,
                     { indent: 4, size: 9 }
                  );
                   writer.write(
                    `   Planted: ${cropRow.plantingDate} | Harvest: ${cropRow.expectedHarvestDate}`,
                     { indent: 4, size: 9 }
                  );
                });
              }
              writer.space(1);

              // Records Table-like
              writer.write("Captured Data Log", { bold: true, size: 12 });
              if (!farm.recordRows.length) {
                writer.write("- No records captured for this farm.", { indent: 2 });
              } else {
                // Group by record type for better readability
                const recordsByType = {};
                farm.recordRows.forEach(r => {
                    if(!recordsByType[r.recordLabel]) recordsByType[r.recordLabel] = [];
                    recordsByType[r.recordLabel].push(r);
                });

                Object.entries(recordsByType).forEach(([type, records]) => {
                    writer.write(type, { bold: true, indent: 2, size: 10 });
                    records.forEach(row => {
                        const date = getRecordDate(row);
                        const details = summarizeRecordDetails(row);
                        writer.write(`• ${date} | ${row.cropName}: ${details}`, { indent: 6, size: 9 });
                    });
                    writer.space(0.5);
                });
              }
            });

            doc.save("farm-monitoring-report.pdf");
        } catch (error) {
            console.error("PDF Export failed", error);
            setError("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    }, 100);
  }

  // ... (render)

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">Reports and Analysis</h1>
            <p className="app-subtitle">
              Grouped analysis across all farms with complete captured data, metrics, recommendations, and export-ready reports.
            </p>
          </div>
          <div className="app-actions-row">
            <button 
                onClick={generateAiAnalysis} 
                className="app-btn app-btn-outline" 
                disabled={loading || analyzing}
            >
                {analyzing ? "Analyzing..." : "Generate AI Analysis"}
            </button>
            <button 
                onClick={exportPDF} 
                className="app-btn app-btn-solid flex items-center gap-2" 
                disabled={loading || isExporting}
            >
                {isExporting ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Exporting...</span>
                    </>
                ) : (
                    "Export PDF"
                )}
            </button>
            <button onClick={exportCSV} className="app-btn app-btn-outline" disabled={loading}>Export CSV</button>
          </div>
        </div>

        {error && <p className="app-error">{error}</p>}

        <div className="app-stat-grid">
          <article className="app-stat-card"><p>Total Farms</p><strong>{reportData.globalTotals.farms}</strong></article>
          <article className="app-stat-card"><p>Active Crop Seasons</p><strong>{reportData.globalTotals.crops}</strong></article>
          <article className="app-stat-card"><p>Captured Records</p><strong>{reportData.globalTotals.records}</strong></article>
        </div>
      </section>

      {/* AI Analysis Display */}
      {Object.keys(aiAnalysis).length > 0 && (
        <section className="app-card">
            <div className="app-card-head">
                <h2 className="app-title-sm">AI Generated Insights</h2>
                <p className="app-subtitle">Deep analysis driven by farm data.</p>
            </div>
            <div className="app-grid-columns">
                {reportData.farmSummaries.map(farm => aiAnalysis[farm.farmId] ? (
                    <div key={farm.farmId} className="app-card-panel">
                        <h3 className="font-bold text-lg mb-2">{farm.farmName}</h3>
                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-line">
                            {aiAnalysis[farm.farmId]}
                        </div>
                    </div>
                ) : null)}
            </div>
        </section>
      )}

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">Farm Grouped Analysis</h2>
          <p className="app-subtitle">Each farm includes crop cycle health, monitoring totals, and recommendation highlights.</p>
        </div>

        {loading ? (
          <p className="app-muted">Loading report data...</p>
        ) : reportData.farmSummaries.length === 0 ? (
          <p className="app-muted">No farm or crop data available yet.</p>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Crops</th>
                  <th>Records</th>
                  <th>Growth Avg</th>
                  <th>Water Stress Avg</th>
                  <th>Pest Impact Avg</th>
                  <th>Top Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {reportData.farmSummaries.map((farm) => (
                  <tr key={farm.farmId}>
                    <td>{farm.farmName} ({farm.farmCode})</td>
                    <td>{farm.cropCount}</td>
                    <td>{farm.totalRecords}</td>
                    <td>{formatMetric(farm.avgGrowthScore)}</td>
                    <td>{formatMetric(farm.avgWaterStressScore)}</td>
                    <td>{formatMetric(farm.avgPestImpactScore)}</td>
                    <td>{farm.recommendations[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">All Captured Data</h2>
          <p className="app-subtitle">Complete records from soil, growth, irrigation, pest, and fumigation logs grouped in export output.</p>
        </div>

        {loading ? (
          <p className="app-muted">Loading captured records...</p>
        ) : reportData.detailedRows.length === 0 ? (
          <p className="app-muted">No captured records yet.</p>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Farm</th>
                  <th>Crop</th>
                  <th>Type</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {reportData.detailedRows.map((row, index) => (
                  <tr key={`${row.recordType}-${row.id || index}`}>
                    <td>{getRecordDate(row)}</td>
                    <td>{row.farmName} ({row.farmCode})</td>
                    <td>{row.cropName}</td>
                    <td>{row.recordLabel}</td>
                    <td>{summarizeRecordDetails(row) || "-"}</td>
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
