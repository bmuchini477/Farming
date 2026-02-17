import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import {
  computeFieldHealthIndex,
  computeGrowthDeviation,
  computePestImpact,
  computeWaterStress,
} from "../../utils/fieldAnalytics";

function daysBetween(aISO, bISO) {
  const a = new Date(`${aISO}T00:00:00`).getTime();
  const b = new Date(`${bISO}T00:00:00`).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

const positiveRequired = {
  required: "This field is required.",
  valueAsNumber: true,
  min: { value: 0, message: "Value must be positive." },
};

const monitoringTabs = [
  { id: "growth", label: "Growth Monitoring", hint: "NDVI, leaf color, and plant population" },
  { id: "irrigation", label: "Irrigation Logs", hint: "Water applied and soil moisture change" },
  { id: "pest", label: "Pest Control", hint: "Incidence, severity, and treatment actions" },
  { id: "fumigation", label: "Fumigation", hint: "Plan and track fumigation operations" },
  { id: "soil", label: "Soil Test", hint: "Core soil quality measurements" },
];

export default function FieldMonitoringForms({ crop, onRecordSaved }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("growth");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState({
    soil: false,
    growth: false,
    irrigation: false,
    pest: false,
    fumigation: false,
  });

  const [latestScores, setLatestScores] = useState(() => {
    const saved = crop?.seasonSnapshot?.monitoringSummary || {};
    return {
      growthScore: Number(saved.growthScore || 0),
      waterStressScore: Number(saved.waterStressScore || 0),
      pestImpactScore: Number(saved.pestImpactScore || 0),
      fieldHealthIndex: Number(saved.fieldHealthIndex || 0),
    };
  });

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const soilForm = useForm({
    defaultValues: {
      organicMatter: "",
      electricalConductivity: "",
      soilTemperature: "",
      soilMoisture: "",
    },
  });
  const soilErrors = soilForm.formState.errors;

  const growthForm = useForm({
    defaultValues: {
      observedOn: todayISO,
      ndviIndex: "",
      leafColorIndex: "",
      plantPopulationPerSqm: "",
    },
  });
  const growthErrors = growthForm.formState.errors;

  const irrigationForm = useForm({
    defaultValues: {
      observedOn: todayISO,
      irrigationMethod: "Drip",
      soilMoistureBefore: "",
      soilMoistureAfter: "",
      waterAmountMm: "",
      notes: "",
    },
  });
  const irrigationErrors = irrigationForm.formState.errors;

  const pestForm = useForm({
    defaultValues: {
      observedOn: todayISO,
      affectedAreaPercentage: "",
      severityLevel: "3",
      actionTaken: "",
    },
  });
  const pestErrors = pestForm.formState.errors;

  const fumigationForm = useForm({
    defaultValues: {
      scheduledFor: todayISO,
      status: "planned",
      targetPest: "",
      productName: "",
      dosageMlPerHa: "",
      method: "Spray",
      notes: "",
    },
  });
  const fumigationErrors = fumigationForm.formState.errors;

  const seasonOwnerUserId = crop?.userId || user?.uid || "";
  const seasonRef = doc(db, "users", seasonOwnerUserId, "fields", crop.farmId, "seasons", crop.seasonId || crop.id);

  function baseRecord() {
    return {
      userId: user?.uid || "",
      fieldId: crop.farmId,
      seasonId: crop.seasonId || crop.id,
      cropId: crop.id,
      cropName: crop.name || "",
      timestamp: Date.now(),
    };
  }

  async function mergeSeasonSnapshot(partialData = {}, partialScores = {}) {
    const nextScores = {
      growthScore: Number(partialScores.growthScore ?? latestScores.growthScore ?? 0),
      waterStressScore: Number(partialScores.waterStressScore ?? latestScores.waterStressScore ?? 0),
      pestImpactScore: Number(partialScores.pestImpactScore ?? latestScores.pestImpactScore ?? 0),
    };

    const fieldHealthIndex = computeFieldHealthIndex([
      nextScores.growthScore,
      nextScores.waterStressScore,
      nextScores.pestImpactScore,
    ]);

    const summary = {
      ...nextScores,
      fieldHealthIndex,
    };

    await setDoc(
      seasonRef,
      {
        ...partialData,
        monitoringSummary: summary,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    setLatestScores(summary);
  }

  function finishSave() {
    if (typeof onRecordSaved === "function") {
      onRecordSaved();
    }
  }

  async function saveSoil(values) {
    if (!user) return;
    setSaving((current) => ({ ...current, soil: true }));
    setError("");
    setToast("");
    try {
      const payload = {
        ...baseRecord(),
        organicMatter: Number(values.organicMatter),
        electricalConductivity: Number(values.electricalConductivity),
        soilTemperature: Number(values.soilTemperature),
        soilMoisture: Number(values.soilMoisture),
      };

      await addDoc(collection(seasonRef, "soilTests"), payload);
      await mergeSeasonSnapshot({ latestSoilTest: payload });
      soilForm.reset();
      setToast("Soil test saved.");
      finishSave();
    } catch (err) {
      console.error(err);
      setError("Unable to save soil test.");
    } finally {
      setSaving((current) => ({ ...current, soil: false }));
    }
  }

  async function saveGrowth(values) {
    if (!user) return;
    setSaving((current) => ({ ...current, growth: true }));
    setError("");
    setToast("");

    const daysAfterPlanting = Math.max(0, daysBetween(crop.plantingDate, values.observedOn));

    try {
      const payload = {
        ...baseRecord(),
        observedOn: values.observedOn,
        ndviIndex: Number(values.ndviIndex),
        leafColorIndex: Number(values.leafColorIndex),
        plantPopulationPerSqm: Number(values.plantPopulationPerSqm),
        daysAfterPlanting,
      };

      const growthScore = computeGrowthDeviation(payload, {
        targetNdvi: 0.75,
        targetLeafColor: 45,
        targetPopulationPerSqm: 8,
      });

      const payloadWithScore = {
        ...payload,
        growthScore,
      };

      await addDoc(collection(seasonRef, "growthRecords"), payloadWithScore);
      await mergeSeasonSnapshot({ latestGrowthRecord: payloadWithScore }, { growthScore });
      growthForm.reset({ observedOn: todayISO, ndviIndex: "", leafColorIndex: "", plantPopulationPerSqm: "" });
      setToast("Growth monitoring record saved.");
      finishSave();
    } catch (err) {
      console.error(err);
      setError("Unable to save growth record.");
    } finally {
      setSaving((current) => ({ ...current, growth: false }));
    }
  }

  async function saveIrrigation(values) {
    if (!user) return;
    setSaving((current) => ({ ...current, irrigation: true }));
    setError("");
    setToast("");
    try {
      const payload = {
        ...baseRecord(),
        observedOn: values.observedOn,
        irrigationMethod: values.irrigationMethod,
        soilMoistureBefore: Number(values.soilMoistureBefore),
        soilMoistureAfter: Number(values.soilMoistureAfter),
        waterAmountMm: Number(values.waterAmountMm),
        notes: values.notes.trim(),
      };

      const waterStressScore = computeWaterStress({ evapotranspirationMm: 4 }, payload);

      const payloadWithScore = {
        ...payload,
        waterStressScore,
      };

      await addDoc(collection(seasonRef, "irrigationLogs"), payloadWithScore);
      await mergeSeasonSnapshot({ latestIrrigationLog: payloadWithScore }, { waterStressScore });
      irrigationForm.reset({
        observedOn: todayISO,
        irrigationMethod: "Drip",
        soilMoistureBefore: "",
        soilMoistureAfter: "",
        waterAmountMm: "",
        notes: "",
      });
      setToast("Irrigation log saved.");
      finishSave();
    } catch (err) {
      console.error(err);
      setError("Unable to save irrigation log.");
    } finally {
      setSaving((current) => ({ ...current, irrigation: false }));
    }
  }

  async function savePest(values) {
    if (!user) return;
    setSaving((current) => ({ ...current, pest: true }));
    setError("");
    setToast("");
    try {
      const payload = {
        ...baseRecord(),
        observedOn: values.observedOn,
        affectedAreaPercentage: Number(values.affectedAreaPercentage),
        severityLevel: Number(values.severityLevel),
        actionTaken: values.actionTaken.trim(),
      };

      const pestImpactScore = computePestImpact([payload]);

      const payloadWithScore = {
        ...payload,
        pestImpactScore,
      };

      await addDoc(collection(seasonRef, "pestReports"), payloadWithScore);
      await mergeSeasonSnapshot({ latestPestReport: payloadWithScore }, { pestImpactScore });
      pestForm.reset({ observedOn: todayISO, affectedAreaPercentage: "", severityLevel: "3", actionTaken: "" });
      setToast("Pest and disease report saved.");
      finishSave();
    } catch (err) {
      console.error(err);
      setError("Unable to save pest report.");
    } finally {
      setSaving((current) => ({ ...current, pest: false }));
    }
  }

  async function saveFumigation(values) {
    if (!user) return;
    setSaving((current) => ({ ...current, fumigation: true }));
    setError("");
    setToast("");
    try {
      const payload = {
        ...baseRecord(),
        scheduledFor: values.scheduledFor,
        status: values.status,
        targetPest: values.targetPest.trim(),
        productName: values.productName.trim(),
        dosageMlPerHa: Number(values.dosageMlPerHa),
        method: values.method,
        notes: values.notes.trim(),
      };

      await addDoc(collection(seasonRef, "fumigationSchedules"), payload);
      await mergeSeasonSnapshot({ latestFumigationSchedule: payload });
      fumigationForm.reset({
        scheduledFor: todayISO,
        status: "planned",
        targetPest: "",
        productName: "",
        dosageMlPerHa: "",
        method: "Spray",
        notes: "",
      });
      setToast("Fumigation schedule saved.");
      finishSave();
    } catch (err) {
      console.error(err);
      setError("Unable to save fumigation schedule.");
    } finally {
      setSaving((current) => ({ ...current, fumigation: false }));
    }
  }

  const activeTabMeta = monitoringTabs.find((tab) => tab.id === activeTab) || monitoringTabs[0];

  return (
    <section className="app-card">
      <div className="app-card-head">
        <h2 className="app-title-sm">Field Monitoring Forms</h2>
        <p className="app-subtitle">Capture soil, growth, irrigation, pest, and fumigation scheduling records for this crop season.</p>
      </div>

      <div className="app-stat-grid app-stat-grid-5 app-monitoring-score-grid" style={{ marginBottom: "0.8rem" }}>
        <article className="app-stat-card"><p>Growth Score</p><strong>{latestScores.growthScore}%</strong></article>
        <article className="app-stat-card"><p>Water Stress Score</p><strong>{latestScores.waterStressScore}%</strong></article>
        <article className="app-stat-card"><p>Pest Impact Score</p><strong>{latestScores.pestImpactScore}%</strong></article>
        <article className="app-stat-card"><p>Field Health Index</p><strong>{latestScores.fieldHealthIndex}%</strong></article>
        <article className="app-stat-card"><p>Last Update</p><strong>{new Date().toLocaleDateString()}</strong></article>
      </div>

      {toast && <div className="app-toast-success">{toast}</div>}
      {error && <div className="app-error">{error}</div>}

      <div className="app-monitoring-layout">
        <aside className="app-monitoring-tabs">
          {monitoringTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`app-monitoring-tab ${activeTab === tab.id ? "app-monitoring-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <strong>{tab.label}</strong>
              <small>{tab.hint}</small>
            </button>
          ))}
        </aside>

        <article className="app-analytics-card app-monitoring-form-card">
          <div className="app-card-head">
            <h3>{activeTabMeta.label}</h3>
            <p className="app-subtitle" style={{ marginTop: "0.2rem" }}>{activeTabMeta.hint}</p>
          </div>

        {activeTab === "soil" && (
          <form className="app-form-grid app-form-grid-compact" onSubmit={soilForm.handleSubmit(saveSoil)}>
            <label className="app-field">
              <span>Organic Matter</span>
              <input className="app-input" type="number" step="any" {...soilForm.register("organicMatter", positiveRequired)} />
              {soilErrors.organicMatter && <small className="app-error-text">{soilErrors.organicMatter.message}</small>}
            </label>
            <label className="app-field">
              <span>Electrical Conductivity</span>
              <input className="app-input" type="number" step="any" {...soilForm.register("electricalConductivity", positiveRequired)} />
              {soilErrors.electricalConductivity && <small className="app-error-text">{soilErrors.electricalConductivity.message}</small>}
            </label>
            <label className="app-field">
              <span>Soil Temperature</span>
              <input className="app-input" type="number" step="any" {...soilForm.register("soilTemperature", positiveRequired)} />
              {soilErrors.soilTemperature && <small className="app-error-text">{soilErrors.soilTemperature.message}</small>}
            </label>
            <label className="app-field">
              <span>Soil Moisture</span>
              <input className="app-input" type="number" step="any" {...soilForm.register("soilMoisture", positiveRequired)} />
              {soilErrors.soilMoisture && <small className="app-error-text">{soilErrors.soilMoisture.message}</small>}
            </label>
            <button type="submit" className="app-btn app-btn-solid app-monitoring-submit" disabled={saving.soil}>
              {saving.soil ? "Saving..." : "Save Soil Test"}
            </button>
          </form>
        )}

        {activeTab === "growth" && (
          <form className="app-form-grid app-form-grid-compact" onSubmit={growthForm.handleSubmit(saveGrowth)}>
            <label className="app-field">
              <span>Observation Date</span>
              <input
                className="app-input"
                type="date"
                {...growthForm.register("observedOn", { required: "Observation date is required." })}
              />
              {growthErrors.observedOn && <small className="app-error-text">{growthErrors.observedOn.message}</small>}
            </label>
            <label className="app-field">
              <span>NDVI Index</span>
              <input className="app-input" type="number" step="any" {...growthForm.register("ndviIndex", positiveRequired)} />
              {growthErrors.ndviIndex && <small className="app-error-text">{growthErrors.ndviIndex.message}</small>}
            </label>
            <label className="app-field">
              <span>Leaf Color Index</span>
              <input className="app-input" type="number" step="any" {...growthForm.register("leafColorIndex", positiveRequired)} />
              {growthErrors.leafColorIndex && <small className="app-error-text">{growthErrors.leafColorIndex.message}</small>}
            </label>
            <label className="app-field">
              <span>Plant Population Per Sqm</span>
              <input className="app-input" type="number" step="any" {...growthForm.register("plantPopulationPerSqm", positiveRequired)} />
              {growthErrors.plantPopulationPerSqm && <small className="app-error-text">{growthErrors.plantPopulationPerSqm.message}</small>}
            </label>
            <button type="submit" className="app-btn app-btn-solid app-monitoring-submit" disabled={saving.growth}>
              {saving.growth ? "Saving..." : "Save Growth Record"}
            </button>
          </form>
        )}

        {activeTab === "irrigation" && (
          <form className="app-form-grid app-form-grid-compact" onSubmit={irrigationForm.handleSubmit(saveIrrigation)}>
            <label className="app-field">
              <span>Observation Date</span>
              <input className="app-input" type="date" {...irrigationForm.register("observedOn", { required: "Date is required." })} />
              {irrigationErrors.observedOn && <small className="app-error-text">{irrigationErrors.observedOn.message}</small>}
            </label>
            <label className="app-field">
              <span>Irrigation Method</span>
              <select className="app-select" {...irrigationForm.register("irrigationMethod", { required: "Method is required." })}>
                <option value="Drip">Drip</option>
                <option value="Sprinkler">Sprinkler</option>
                <option value="Flood">Flood</option>
                <option value="Center Pivot">Center Pivot</option>
                <option value="Manual">Manual</option>
              </select>
              {irrigationErrors.irrigationMethod && <small className="app-error-text">{irrigationErrors.irrigationMethod.message}</small>}
            </label>
            <label className="app-field">
              <span>Soil Moisture Before</span>
              <input className="app-input" type="number" step="any" {...irrigationForm.register("soilMoistureBefore", positiveRequired)} />
              {irrigationErrors.soilMoistureBefore && <small className="app-error-text">{irrigationErrors.soilMoistureBefore.message}</small>}
            </label>
            <label className="app-field">
              <span>Soil Moisture After</span>
              <input className="app-input" type="number" step="any" {...irrigationForm.register("soilMoistureAfter", positiveRequired)} />
              {irrigationErrors.soilMoistureAfter && <small className="app-error-text">{irrigationErrors.soilMoistureAfter.message}</small>}
            </label>
            <label className="app-field">
              <span>Water Amount (mm)</span>
              <input className="app-input" type="number" step="any" {...irrigationForm.register("waterAmountMm", positiveRequired)} />
              {irrigationErrors.waterAmountMm && <small className="app-error-text">{irrigationErrors.waterAmountMm.message}</small>}
            </label>
            <label className="app-field app-field-wide">
              <span>Notes</span>
              <textarea className="app-textarea" rows={3} {...irrigationForm.register("notes")} />
            </label>
            <button type="submit" className="app-btn app-btn-solid app-monitoring-submit" disabled={saving.irrigation}>
              {saving.irrigation ? "Saving..." : "Save Irrigation"}
            </button>
          </form>
        )}

        {activeTab === "pest" && (
          <form className="app-form-grid app-form-grid-compact" onSubmit={pestForm.handleSubmit(savePest)}>
            <label className="app-field">
              <span>Observation Date</span>
              <input className="app-input" type="date" {...pestForm.register("observedOn", { required: "Date is required." })} />
              {pestErrors.observedOn && <small className="app-error-text">{pestErrors.observedOn.message}</small>}
            </label>
            <label className="app-field">
              <span>Affected Area Percentage</span>
              <input className="app-input" type="number" step="any" {...pestForm.register("affectedAreaPercentage", positiveRequired)} />
              {pestErrors.affectedAreaPercentage && <small className="app-error-text">{pestErrors.affectedAreaPercentage.message}</small>}
            </label>
            <label className="app-field">
              <span>Severity Level</span>
              <select className="app-select" {...pestForm.register("severityLevel", { required: "Severity level is required." })}>
                <option value="1">1 - Very Low</option>
                <option value="2">2 - Low</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - High</option>
                <option value="5">5 - Severe</option>
              </select>
              {pestErrors.severityLevel && <small className="app-error-text">{pestErrors.severityLevel.message}</small>}
            </label>
            <label className="app-field app-field-wide">
              <span>Action Taken</span>
              <textarea
                className="app-textarea"
                rows={3}
                {...pestForm.register("actionTaken", { required: "Action taken is required." })}
              />
              {pestErrors.actionTaken && <small className="app-error-text">{pestErrors.actionTaken.message}</small>}
            </label>
            <button type="submit" className="app-btn app-btn-solid app-monitoring-submit" disabled={saving.pest}>
              {saving.pest ? "Saving..." : "Save Pest Report"}
            </button>
          </form>
        )}

        {activeTab === "fumigation" && (
          <form className="app-form-grid app-form-grid-compact" onSubmit={fumigationForm.handleSubmit(saveFumigation)}>
            <label className="app-field">
              <span>Scheduled Date</span>
              <input className="app-input" type="date" {...fumigationForm.register("scheduledFor", { required: "Date is required." })} />
              {fumigationErrors.scheduledFor && <small className="app-error-text">{fumigationErrors.scheduledFor.message}</small>}
            </label>
            <label className="app-field">
              <span>Status</span>
              <select className="app-select" {...fumigationForm.register("status", { required: "Status is required." })}>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {fumigationErrors.status && <small className="app-error-text">{fumigationErrors.status.message}</small>}
            </label>
            <label className="app-field">
              <span>Target Pest/Disease</span>
              <input className="app-input" type="text" {...fumigationForm.register("targetPest", { required: "Target pest is required." })} />
              {fumigationErrors.targetPest && <small className="app-error-text">{fumigationErrors.targetPest.message}</small>}
            </label>
            <label className="app-field">
              <span>Product Name</span>
              <input className="app-input" type="text" {...fumigationForm.register("productName", { required: "Product name is required." })} />
              {fumigationErrors.productName && <small className="app-error-text">{fumigationErrors.productName.message}</small>}
            </label>
            <label className="app-field">
              <span>Dosage (ml/ha)</span>
              <input className="app-input" type="number" step="any" {...fumigationForm.register("dosageMlPerHa", positiveRequired)} />
              {fumigationErrors.dosageMlPerHa && <small className="app-error-text">{fumigationErrors.dosageMlPerHa.message}</small>}
            </label>
            <label className="app-field">
              <span>Application Method</span>
              <select className="app-select" {...fumigationForm.register("method", { required: "Method is required." })}>
                <option value="Spray">Spray</option>
                <option value="Fogging">Fogging</option>
                <option value="Soil Drench">Soil Drench</option>
                <option value="Seed Treatment">Seed Treatment</option>
                <option value="Manual">Manual</option>
              </select>
              {fumigationErrors.method && <small className="app-error-text">{fumigationErrors.method.message}</small>}
            </label>
            <label className="app-field app-field-wide">
              <span>Notes</span>
              <textarea className="app-textarea" rows={3} {...fumigationForm.register("notes")} />
            </label>
            <button type="submit" className="app-btn app-btn-solid app-monitoring-submit" disabled={saving.fumigation}>
              {saving.fumigation ? "Saving..." : "Save Fumigation"}
            </button>
          </form>
        )}
        </article>
      </div>
    </section>
  );
}
