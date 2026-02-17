import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { createFarm, generateFarmCode } from "./farms.service";
import ZimbabweMapPicker from "./ZimbabweMapPicker";

export default function AddFarmPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [sizeHectares, setSizeHectares] = useState("");
  const [managerName, setManagerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [soilType, setSoilType] = useState("Loam");
  const [irrigationSetup, setIrrigationSetup] = useState("Drip");
  const [waterSource, setWaterSource] = useState("Borehole");
  const [ownershipType, setOwnershipType] = useState("Owned");
  const [accessRoad, setAccessRoad] = useState("");
  const [storageAvailable, setStorageAvailable] = useState("Yes");
  const [notes, setNotes] = useState("");
  const [farmCode, setFarmCode] = useState(generateFarmCode());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      setError("Farm name is required.");
      return;
    }

    if (!coordinates) {
      setError("Pick a farm location on the Zimbabwe map.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createFarm(user.uid, {
        name: name.trim(),
        location: location.trim(),
        latitude: Number(coordinates.lat),
        longitude: Number(coordinates.lng),
        sizeHectares,
        managerName: managerName.trim(),
        contactPhone: contactPhone.trim(),
        soilType,
        irrigationSetup,
        waterSource,
        ownershipType,
        accessRoad: accessRoad.trim(),
        storageAvailable,
        notes: notes.trim(),
        farmCode,
      });
      navigate("/app");
    } catch (err) {
      console.error(err);
      setError("Unable to create farm. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head">
          <h1 className="app-title">Add Farm</h1>
          <p className="app-subtitle">Create a farm profile with a unique ID before adding crops.</p>
        </div>

        <form onSubmit={onSubmit} className="app-form-grid app-form-grid-compact">
          {error && <div className="app-error">{error}</div>}

          <label className="app-field">
            <span>Farm Name</span>
            <input
              className="app-input"
              placeholder="North Valley Farm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="app-field">
            <span>Location</span>
            <input
              className="app-input"
              placeholder="Harare, Ward 8"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>

          <label className="app-field">
            <span>Manager Name</span>
            <input
              className="app-input"
              placeholder="Tendai Ncube"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </label>

          <label className="app-field">
            <span>Contact Phone</span>
            <input
              className="app-input"
              placeholder="+263 77 000 0000"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </label>

          <label className="app-field">
            <span>Farm Size (hectares)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className="app-input"
              placeholder="10"
              value={sizeHectares}
              onChange={(e) => setSizeHectares(e.target.value)}
            />
          </label>

          <label className="app-field">
            <span>Soil Type</span>
            <select className="app-select" value={soilType} onChange={(e) => setSoilType(e.target.value)}>
              <option value="Loam">Loam</option>
              <option value="Clay">Clay</option>
              <option value="Sandy">Sandy</option>
              <option value="Silt">Silt</option>
            </select>
          </label>

          <label className="app-field">
            <span>Irrigation Setup</span>
            <select className="app-select" value={irrigationSetup} onChange={(e) => setIrrigationSetup(e.target.value)}>
              <option value="Drip">Drip</option>
              <option value="Sprinkler">Sprinkler</option>
              <option value="Flood">Flood</option>
              <option value="Rainfed">Rainfed</option>
            </select>
          </label>

          <label className="app-field">
            <span>Unique Farm ID</span>
            <div className="app-inline-row">
              <input className="app-input" value={farmCode} onChange={(e) => setFarmCode(e.target.value)} required />
              <button type="button" className="app-btn app-btn-outline" onClick={() => setFarmCode(generateFarmCode())}>
                Regenerate
              </button>
            </div>
          </label>

          <label className="app-field">
            <span>Water Source</span>
            <select className="app-select" value={waterSource} onChange={(e) => setWaterSource(e.target.value)}>
              <option value="Borehole">Borehole</option>
              <option value="River">River</option>
              <option value="Dam">Dam</option>
              <option value="Municipal">Municipal</option>
              <option value="Rainwater">Rainwater</option>
            </select>
          </label>

          <label className="app-field">
            <span>Ownership Type</span>
            <select className="app-select" value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)}>
              <option value="Owned">Owned</option>
              <option value="Leased">Leased</option>
              <option value="Shared">Shared</option>
            </select>
          </label>

          <label className="app-field">
            <span>Main Access Road</span>
            <input
              className="app-input"
              placeholder="Tarred, gravel, seasonal..."
              value={accessRoad}
              onChange={(e) => setAccessRoad(e.target.value)}
            />
          </label>

          <label className="app-field">
            <span>Storage Available</span>
            <select className="app-select" value={storageAvailable} onChange={(e) => setStorageAvailable(e.target.value)}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>

          <div className="app-field app-field-wide">
            <span>Map Location (Zimbabwe)</span>
            <div className="app-inline-row">
              <button
                type="button"
                className="app-btn app-btn-map-green"
                onClick={() => setShowMap((v) => !v)}
              >
                {showMap ? "Hide Location Map" : "Add Location"}
              </button>
              {coordinates && (
                <span className="app-pill app-pill-tight">
                  {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                </span>
              )}
            </div>

            {!coordinates && <p className="app-muted">Click "Add Location", then click on the map to pin the farm.</p>}

            {showMap && (
              <ZimbabweMapPicker
                value={coordinates}
                onPick={(picked) => {
                  setCoordinates(picked);
                  if (!location.trim()) {
                    setLocation(`Pinned: ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`);
                  }
                }}
              />
            )}
          </div>

          <label className="app-field app-field-wide">
            <span>Notes</span>
            <textarea
              className="app-textarea"
              placeholder="Soil type, irrigation setup, and other details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </label>

          <div className="app-actions-row app-field-wide">
            <Link to="/app" className="app-btn app-btn-outline">Cancel</Link>
            <button type="submit" className="app-btn app-btn-solid" disabled={saving}>
              {saving ? "Saving..." : "Save Farm"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
