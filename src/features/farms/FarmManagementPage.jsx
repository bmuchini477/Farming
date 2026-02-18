import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAdminStatus } from "../auth/useAdminStatus";
import { getFarm, updateFarm, deleteFarm } from "./farms.service";
import LoadingAnimation from "../../components/LoadingAnimation";

function valueOrFallback(value, fallback = "Not specified") {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  return hasValue ? value : fallback;
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Not pinned";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function FarmManagementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminStatus(user);

  const [farm, setFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getFarm(id)
      .then((data) => {
        if (!data) {
          setError("Farm not found.");
        } else {
          setFarm(data);
          setFormData(data);
        }
      })
      .catch((err) => {
        console.error("Error fetching farm:", err);
        setError("Failed to load farm details.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await updateFarm(id, formData);
      setFarm(formData);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating farm:", err);
      alert("Failed to update farm details.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this farm? This action cannot be undone.")) return;
    
    setSaving(true);
    try {
      await deleteFarm(id);
      navigate("/app/projection");
    } catch (err) {
      console.error("Error deleting farm:", err);
      alert("Failed to delete farm.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page-stack">
        <section className="app-card">
          <LoadingAnimation label="Loading farm details..." scope="inline" />
        </section>
      </div>
    );
  }

  if (error || !farm) {
    return (
      <div className="app-page-stack">
        <section className="app-card">
          <div className="app-empty">
            <p className="app-error">{error || "Farm not found"}</p>
            <Link to="/app/projection" className="app-btn app-btn-outline">Back to Projection</Link>
          </div>
        </section>
      </div>
    );
  }

  const profileItems = [
    { label: "Farm Code", value: valueOrFallback(farm.farmCode, "Unassigned") },
    { label: "Location", value: valueOrFallback(farm.location) },
    { label: "Coordinates", value: formatCoordinates(farm.latitude, farm.longitude) },
    { label: "Field Size", value: `${Number(farm.sizeHectares || 0).toLocaleString()} ha` },
  ];

  const operationItems = [
    { label: "Soil Type", value: valueOrFallback(farm.soilType) },
    { label: "Water Source", value: valueOrFallback(farm.waterSource) },
    { label: "Irrigation Setup", value: valueOrFallback(farm.irrigationSetup) },
    { label: "Storage Available", value: valueOrFallback(farm.storageAvailable) },
    { label: "Ownership Type", value: valueOrFallback(farm.ownershipType) },
    { label: "Access Road", value: valueOrFallback(farm.accessRoad) },
  ];

  const contactItems = [
    { label: "Manager", value: valueOrFallback(farm.managerName, "Not assigned") },
    { label: "Contact Phone", value: valueOrFallback(farm.contactPhone, "No contact info") },
    { label: "Created", value: formatDate(farm.createdAt) },
    { label: "Last Updated", value: formatDate(farm.updatedAt) },
  ];

  return (
    <div className="app-page-stack">
      <section className="app-card farm-details-hero">
        <div className="app-card-head app-card-head-split farm-details-hero-head">
          <div>
            <p className="farm-details-kicker">Farm Details</p>
            <h1 className="app-title">{isEditing ? "Edit Farm Profile" : farm.name}</h1>
            <p className="app-subtitle">
              {isEditing
                ? "Update key farm information below and save changes when done."
                : "Structured summary of farm profile, operations, and contact information."}
            </p>
            <div className="farm-details-meta-row">
              <span className="app-pill">{valueOrFallback(farm.farmCode, "No farm code")}</span>
              <span className="app-pill">{valueOrFallback(farm.location)}</span>
            </div>
          </div>
          <div className="app-actions-row">
            <button onClick={() => navigate(-1)} className="app-btn app-btn-outline" disabled={saving}>
              Back
            </button>
            {isAdmin && !isEditing && (
              <>
                <button onClick={() => setIsEditing(true)} className="app-btn app-btn-solid">
                  Edit Farm
                </button>
                <button onClick={handleDelete} className="app-btn app-btn-danger" disabled={saving}>
                  Delete Farm
                </button>
              </>
            )}
          </div>
        </div>

        <div className="farm-details-stat-grid">
          <article className="app-stat-card">
            <p>Field Size</p>
            <strong>{`${Number(farm.sizeHectares || 0).toLocaleString()} ha`}</strong>
          </article>
          <article className="app-stat-card">
            <p>Manager</p>
            <strong>{valueOrFallback(farm.managerName, "Unassigned")}</strong>
          </article>
          <article className="app-stat-card">
            <p>Coordinates</p>
            <strong>{formatCoordinates(farm.latitude, farm.longitude)}</strong>
          </article>
          <article className="app-stat-card">
            <p>Last Updated</p>
            <strong>{formatDate(farm.updatedAt || farm.createdAt)}</strong>
          </article>
        </div>
      </section>

      <section className="app-card">
        {isEditing ? (
          <form onSubmit={handleUpdate} className="app-form-grid app-form-grid-compact">
            <label className="app-field">
              <span>Farm Name</span>
              <input className="app-input" type="text" name="name" value={formData.name || ""} onChange={handleChange} required />
            </label>
            <label className="app-field">
              <span>Size (Hectares)</span>
              <input className="app-input" type="number" name="sizeHectares" value={formData.sizeHectares || ""} onChange={handleChange} step="0.01" min="0" />
            </label>
            <label className="app-field">
              <span>Location / Province</span>
              <input className="app-input" type="text" name="location" value={formData.location || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Manager Name</span>
              <input className="app-input" type="text" name="managerName" value={formData.managerName || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Contact Phone</span>
              <input className="app-input" type="tel" name="contactPhone" value={formData.contactPhone || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Soil Type</span>
              <input className="app-input" type="text" name="soilType" value={formData.soilType || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Water Source</span>
              <input className="app-input" type="text" name="waterSource" value={formData.waterSource || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Irrigation Setup</span>
              <input className="app-input" type="text" name="irrigationSetup" value={formData.irrigationSetup || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Ownership Type</span>
              <input className="app-input" type="text" name="ownershipType" value={formData.ownershipType || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Storage Available</span>
              <input className="app-input" type="text" name="storageAvailable" value={formData.storageAvailable || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Access Road</span>
              <input className="app-input" type="text" name="accessRoad" value={formData.accessRoad || ""} onChange={handleChange} />
            </label>
            <label className="app-field">
              <span>Farm Code</span>
              <input className="app-input" type="text" name="farmCode" value={formData.farmCode || ""} onChange={handleChange} />
            </label>
            <label className="app-field app-field-wide">
              <span>Notes</span>
              <textarea className="app-textarea" name="notes" value={formData.notes || ""} onChange={handleChange} rows="4" />
            </label>
            <div className="app-actions-row app-field-wide">
              <button type="button" onClick={() => setIsEditing(false)} className="app-btn app-btn-outline" disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="app-btn app-btn-solid" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="farm-details-grid">
            <article className="farm-details-panel">
              <h2 className="farm-details-panel-title">Profile Snapshot</h2>
              <dl className="farm-details-list">
                {profileItems.map((item) => (
                  <div key={item.label} className="farm-details-row">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="farm-details-panel">
              <h2 className="farm-details-panel-title">Operations</h2>
              <dl className="farm-details-list">
                {operationItems.map((item) => (
                  <div key={item.label} className="farm-details-row">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="farm-details-panel">
              <h2 className="farm-details-panel-title">Management</h2>
              <dl className="farm-details-list">
                {contactItems.map((item) => (
                  <div key={item.label} className="farm-details-row">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </article>

            {farm.notes && (
              <article className="farm-details-panel farm-details-panel-full">
                <h2 className="farm-details-panel-title">Notes</h2>
                <p className="farm-details-notes">{farm.notes}</p>
              </article>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
