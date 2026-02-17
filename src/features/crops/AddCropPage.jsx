import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../../firebase/firebase";
import { listFarms } from "../farms/farms.service";
import { listActiveCrops } from "./crops.service";
import ZimbabweMapPicker from "../farms/ZimbabweMapPicker";

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function isValidDate(value) {
  return !Number.isNaN(new Date(value).getTime());
}

async function upsertSeasonSnapshot(seasonRef, payload) {
  try {
    await updateDoc(seasonRef, payload);
  } catch (err) {
    if (err?.code === "not-found") {
      await setDoc(seasonRef, payload, { merge: true });
      return;
    }
    throw err;
  }
}

export default function AddCropPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [farms, setFarms] = useState([]);
  const [activeCrops, setActiveCrops] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [fieldCoordinates, setFieldCoordinates] = useState(null);
  const [showFieldMap, setShowFieldMap] = useState(false);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "Maize",
      variety: "",
      plantingDate: todayISO,
      totalDays: 120,
      expectedHarvestDate: addDays(todayISO, 120),
      notes: "",
      fieldSizeHectares: "",
      soilPh: "",
      soilType: "Loam",
      previousCrop: "",
      irrigationMethod: "Drip",
      pestPressure: "Moderate",
      commonPestsObserved: "",
      diseaseHistory: "",
      weedPressure: "Moderate",
    },
    mode: "onBlur",
  });

  const plantingDate = watch("plantingDate");
  const totalDays = watch("totalDays");
  const fieldSizeHectares = watch("fieldSizeHectares");
  const selectedFarm = useMemo(() => farms.find((farm) => farm.id === farmId) || null, [farms, farmId]);
  const selectedFieldSize = Number(fieldSizeHectares || 0);
  const farmCenter = useMemo(() => {
    if (!selectedFarm) return null;
    const lat = Number(selectedFarm.latitude);
    const lng = Number(selectedFarm.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [selectedFarm]);
  const farmBounds = useMemo(() => {
    if (!farmCenter) return null;
    const [lat, lng] = farmCenter;
    const span = 0.08;
    return [
      [lat - span, lng - span],
      [lat + span, lng + span],
    ];
  }, [farmCenter]);
  const farmCapacity = Number(selectedFarm?.sizeHectares || 0);
  const hectaresInUse = useMemo(() => {
    if (!farmId) return 0;
    return activeCrops
      .filter((crop) => crop.farmId === farmId)
      .reduce((sum, crop) => sum + Number(crop.fieldSizeHectares || 0), 0);
  }, [activeCrops, farmId]);
  const hasTrackedCapacity = farmCapacity > 0;
  const availableHectares = Math.max(0, farmCapacity - hectaresInUse);
  const isFarmFull = hasTrackedCapacity && availableHectares <= 0;
  const exceedsCapacity = hasTrackedCapacity && selectedFieldSize > availableHectares;

  useEffect(() => {
    if (!user) return;
    Promise.all([listFarms(), listActiveCrops()]).then(([farmRows, cropRows]) => {
      setFarms(farmRows);
      setActiveCrops(cropRows);
      if (farmRows.length && !farmId) setFarmId(farmRows[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!plantingDate || !totalDays) return;
    setValue("expectedHarvestDate", addDays(plantingDate, totalDays), { shouldValidate: true });
  }, [plantingDate, totalDays, setValue]);

  useEffect(() => {
    setFieldCoordinates(null);
    setShowFieldMap(false);
  }, [farmId]);

  async function saveCrop(values) {
    if (!user) return;

    if (!farmId) {
      setError("Select a farm first.");
      return;
    }
    if (!farmCenter) {
      setError("Selected farm has no map coordinates. Update the farm location first.");
      return;
    }
    if (!fieldCoordinates) {
      setError("Pin the field location from the map.");
      return;
    }
    if (hasTrackedCapacity && isFarmFull) {
      setError(`This farm is full (${farmCapacity} ha used). End an active crop before adding another.`);
      return;
    }
    if (hasTrackedCapacity && Number(values.fieldSizeHectares) > availableHectares) {
      setError(
        `Not enough free area. Available: ${availableHectares.toFixed(2)} ha, requested: ${Number(
          values.fieldSizeHectares
        ).toFixed(2)} ha.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setToast("");

    const seasonId = doc(collection(db, "crops")).id;
    const cropRef = doc(db, "crops", seasonId);
    const seasonRef = doc(db, "users", user.uid, "fields", farmId, "seasons", seasonId);

    const cropPayload = {
      userId: user.uid,
      farmId,
      farmCode: selectedFarm?.farmCode || "",
      fieldName: selectedFarm?.name || "",
      farmName: selectedFarm?.name || "",
      seasonId,
      name: values.name.trim(),
      variety: values.variety.trim(),
      notes: values.notes.trim(),
      plantingDate: values.plantingDate,
      totalDays: Number(values.totalDays),
      expectedHarvestDate: values.expectedHarvestDate,
      fieldGpsLatitude: Number(fieldCoordinates.lat),
      fieldGpsLongitude: Number(fieldCoordinates.lng),
      fieldSizeHectares: Number(values.fieldSizeHectares),
      soilPh: Number(values.soilPh),
      soilType: values.soilType,
      previousCrop: values.previousCrop.trim(),
      irrigationMethod: values.irrigationMethod,
      pestPressure: values.pestPressure,
      commonPestsObserved: values.commonPestsObserved.trim(),
      diseaseHistory: values.diseaseHistory.trim(),
      weedPressure: values.weedPressure,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await setDoc(cropRef, cropPayload, { merge: true });
      await upsertSeasonSnapshot(seasonRef, {
        ...cropPayload,
        monitoringReady: true,
      });

      setToast("Crop and season profile saved.");
      setTimeout(() => navigate("/app"), 800);
    } catch (err) {
      console.error(err);
      setError("Unable to save crop. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page-stack">
      {toast && <div className="app-toast-success">{toast}</div>}
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">Add Crop</h1>
            <p className="app-subtitle">Attach each crop to a farm so the dashboard can track farm-level progress.</p>
          </div>
          <Link to="/app/farms/new" className="app-btn app-btn-outline">Need a farm first?</Link>
        </div>

        <form onSubmit={handleSubmit(saveCrop)} className="app-form-grid app-form-grid-compact">
          {error && <div className="app-error">{error}</div>}

          <label className="app-field">
            <span>Crop Name</span>
            <input className="app-input" {...register("name", { required: "Crop name is required." })} />
            {errors.name && <small className="app-error-text">{errors.name.message}</small>}
          </label>

          <label className="app-field">
            <span>Variety</span>
            <input
              className="app-input"
              placeholder="SC 719"
              {...register("variety", { required: "Variety is required." })}
            />
            {errors.variety && <small className="app-error-text">{errors.variety.message}</small>}
          </label>

          <label className="app-field">
            <span>Planting Date</span>
            <input
              type="date"
              className="app-input"
              {...register("plantingDate", {
                required: "Planting date is required.",
                validate: (value) => isValidDate(value) || "Enter a valid planting date.",
              })}
            />
            {errors.plantingDate && <small className="app-error-text">{errors.plantingDate.message}</small>}
          </label>

          <label className="app-field">
            <span>Farm</span>
            <select className="app-input" value={farmId} onChange={(e) => setFarmId(e.target.value)} required>
              {farms.length === 0 && <option value="">No farms available</option>}
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} ({farm.farmCode})
                </option>
              ))}
            </select>
            {selectedFarm && hasTrackedCapacity && (
              <small className={exceedsCapacity || isFarmFull ? "app-error-text" : "app-success-text"}>
                Free: {availableHectares.toFixed(2)} ha
              </small>
            )}
            {selectedFarm && !hasTrackedCapacity && (
              <small className="app-muted">Set farm size hectares in Add Farm to enable capacity limits.</small>
            )}
            {selectedFarm && exceedsCapacity && (
              <small className="app-error-text">
                Requested area exceeds remaining farm space by {(selectedFieldSize - availableHectares).toFixed(2)} ha.
              </small>
            )}
          </label>

          <label className="app-field">
            <span>Total Crop Cycle (days)</span>
            <input
              type="number"
              min="1"
              className="app-input"
              {...register("totalDays", {
                required: "Cycle length is required.",
                valueAsNumber: true,
                min: { value: 1, message: "Cycle length must be positive." },
              })}
            />
            {errors.totalDays && <small className="app-error-text">{errors.totalDays.message}</small>}
          </label>

          <label className="app-field">
            <span>Expected Harvest Date</span>
            <input
              type="date"
              className="app-input"
              {...register("expectedHarvestDate", {
                required: "Expected harvest date is required.",
                validate: (value) => isValidDate(value) || "Enter a valid harvest date.",
              })}
            />
            {errors.expectedHarvestDate && <small className="app-error-text">{errors.expectedHarvestDate.message}</small>}
          </label>

          <label className="app-field">
            <span>Field Size (Hectares)</span>
            <input
              type="number"
              step="any"
              className="app-input"
              {...register("fieldSizeHectares", {
                required: "Field size is required.",
                valueAsNumber: true,
                min: { value: 0.0000001, message: "Field size must be positive." },
              })}
            />
            {errors.fieldSizeHectares && <small className="app-error-text">{errors.fieldSizeHectares.message}</small>}
          </label>

          <label className="app-field">
            <span>Soil pH</span>
            <input
              type="number"
              step="0.1"
              className="app-input"
              {...register("soilPh", {
                required: "Soil pH is required.",
                valueAsNumber: true,
                min: { value: 0, message: "Soil pH must be positive." },
                max: { value: 14, message: "Soil pH must be 14 or lower." },
              })}
            />
            {errors.soilPh && <small className="app-error-text">{errors.soilPh.message}</small>}
          </label>

          <label className="app-field">
            <span>Soil Type</span>
            <select className="app-select" {...register("soilType", { required: "Soil type is required." })}>
              <option value="Loam">Loam</option>
              <option value="Clay">Clay</option>
              <option value="Sandy">Sandy</option>
              <option value="Silt">Silt</option>
            </select>
            {errors.soilType && <small className="app-error-text">{errors.soilType.message}</small>}
          </label>

          <label className="app-field">
            <span>Previous Crop</span>
            <input className="app-input" {...register("previousCrop", { required: "Previous crop is required." })} />
            {errors.previousCrop && <small className="app-error-text">{errors.previousCrop.message}</small>}
          </label>

          <label className="app-field">
            <span>Irrigation Method</span>
            <select className="app-select" {...register("irrigationMethod", { required: "Irrigation method is required." })}>
              <option value="Drip">Drip</option>
              <option value="Sprinkler">Sprinkler</option>
              <option value="Flood">Flood</option>
              <option value="Rainfed">Rainfed</option>
            </select>
            {errors.irrigationMethod && <small className="app-error-text">{errors.irrigationMethod.message}</small>}
          </label>

          <label className="app-field">
            <span>Pest Pressure</span>
            <select className="app-select" {...register("pestPressure", { required: "Pest pressure is required." })}>
              <option value="Low">Low</option>
              <option value="Moderate">Moderate</option>
              <option value="High">High</option>
            </select>
            {errors.pestPressure && <small className="app-error-text">{errors.pestPressure.message}</small>}
          </label>

          <label className="app-field">
            <span>Common Pests Observed</span>
            <input
              className="app-input"
              placeholder="Armyworm, aphids, cutworms..."
              {...register("commonPestsObserved", { required: "Common pests are required." })}
            />
            {errors.commonPestsObserved && <small className="app-error-text">{errors.commonPestsObserved.message}</small>}
          </label>

          <label className="app-field">
            <span>Disease History</span>
            <input
              className="app-input"
              placeholder="Rust, blight, mildew..."
              {...register("diseaseHistory", { required: "Disease history is required." })}
            />
            {errors.diseaseHistory && <small className="app-error-text">{errors.diseaseHistory.message}</small>}
          </label>

          <label className="app-field">
            <span>Weed Pressure</span>
            <select className="app-select" {...register("weedPressure", { required: "Weed pressure is required." })}>
              <option value="Low">Low</option>
              <option value="Moderate">Moderate</option>
              <option value="High">High</option>
            </select>
            {errors.weedPressure && <small className="app-error-text">{errors.weedPressure.message}</small>}
          </label>

          <label className="app-field">
            <span>Field Location (Map Pin)</span>
            <button
              type="button"
              className="app-btn app-btn-map-green"
              onClick={() => {
                if (!farmCenter) {
                  setError("Selected farm has no map coordinates. Update the farm location first.");
                  return;
                }
                setError("");
                setShowFieldMap(true);
              }}
            >
              Open Map
            </button>
            {fieldCoordinates && (
              <span className="app-pill app-pill-tight">
                {fieldCoordinates.lat.toFixed(5)}, {fieldCoordinates.lng.toFixed(5)}
              </span>
            )}
          </label>

          <label className="app-field app-field-wide">
            <span>Crop Notes</span>
            <textarea
              className="app-textarea"
              rows={3}
              placeholder="Optional observations, fertilizer plan, irrigation notes"
              {...register("notes")}
            />
          </label>

          <div className="app-actions-row app-field-wide">
            <Link to="/app" className="app-btn app-btn-outline">Cancel</Link>
            <button
              type="submit"
              disabled={saving || farms.length === 0 || isFarmFull || exceedsCapacity}
              className="app-btn app-btn-solid"
            >
              {saving ? "Saving..." : "Save Crop"}
            </button>
          </div>
        </form>
      </section>

      {showFieldMap && farmCenter && farmBounds && (
        <div className="app-map-modal">
          <div className="app-map-modal-content">
            <div className="app-card-head app-card-head-split">
              <div>
                <h2 className="app-title-sm">Pin Field Location</h2>
                <p className="app-subtitle">
                  Map is locked around <strong>{selectedFarm?.name || "selected farm"}</strong>. Click to pin field coordinates.
                </p>
              </div>
              <div className="app-actions-row">
                <button type="button" className="app-btn app-btn-outline" onClick={() => setShowFieldMap(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-solid"
                  onClick={() => setShowFieldMap(false)}
                  disabled={!fieldCoordinates}
                >
                  Use Pinned Location
                </button>
              </div>
            </div>

            <ZimbabweMapPicker
              value={fieldCoordinates}
              onPick={setFieldCoordinates}
              center={farmCenter}
              maxBounds={farmBounds}
              initialZoom={14}
              minZoom={13}
              maxZoom={20}
              showFullscreenToggle={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
