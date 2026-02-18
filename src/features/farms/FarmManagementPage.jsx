import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAdminStatus } from "../auth/useAdminStatus";
import { getFarm, updateFarm, deleteFarm } from "./farms.service";
import LoadingAnimation from "../../components/LoadingAnimation";

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

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">{isEditing ? "Edit Farm" : farm.name}</h1>
            <p className="app-subtitle">
              {isEditing ? "Modify farm information below." : `Farm Code: ${farm.farmCode}`}
            </p>
          </div>
          <div className="app-actions-row">
            <button 
              onClick={() => navigate(-1)} 
              className="app-btn app-btn-outline"
              disabled={saving}
            >
              Back
            </button>
            {isAdmin && !isEditing && (
              <>
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="app-btn app-btn-solid"
                >
                  Edit Farm
                </button>
                <button 
                  onClick={handleDelete} 
                  className="app-btn app-btn-danger"
                  style={{ backgroundColor: "#dc2626", color: "white" }}
                >
                  Delete Farm
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="app-card">
        {isEditing ? (
          <form onSubmit={handleUpdate} className="app-form">
            <div className="app-form-grid">
              <div className="app-form-group">
                <label>Farm Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ""}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="app-form-group">
                <label>Size (Hectares)</label>
                <input
                  type="number"
                  name="sizeHectares"
                  value={formData.sizeHectares || ""}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
              <div className="app-form-group">
                <label>Location / Province</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="app-form-group">
                <label>Manager Name</label>
                <input
                  type="text"
                  name="managerName"
                  value={formData.managerName || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="app-form-group">
                <label>Contact Phone</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="app-form-group">
                <label>Soil Type</label>
                <input
                  type="text"
                  name="soilType"
                  value={formData.soilType || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="app-form-group">
                <label>Water Source</label>
                <input
                  type="text"
                  name="waterSource"
                  value={formData.waterSource || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="app-form-group">
                <label>Ownership Type</label>
                <input
                  type="text"
                  name="ownershipType"
                  value={formData.ownershipType || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="app-form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes || ""}
                onChange={handleChange}
                rows="4"
              />
            </div>

            <div className="app-form-actions">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className="app-btn app-btn-outline"
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="app-btn app-btn-solid"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="app-details-grid">
            <article className="app-detail-item">
              <label>Location</label>
              <p>{farm.location || "Not specified"}</p>
            </article>
            <article className="app-detail-item">
              <label>Size</label>
              <p>{farm.sizeHectares} Hectares</p>
            </article>
            <article className="app-detail-item">
              <label>Manager</label>
              <p>{farm.managerName || "Not assigned"}</p>
            </article>
            <article className="app-detail-item">
              <label>Contact</label>
              <p>{farm.contactPhone || "No contact info"}</p>
            </article>
            <article className="app-detail-item">
              <label>Soil Type</label>
              <p>{farm.soilType || "Not specified"}</p>
            </article>
            <article className="app-detail-item">
              <label>Water Source</label>
              <p>{farm.waterSource || "Not specified"}</p>
            </article>
            <article className="app-detail-item">
              <label>Ownership</label>
              <p>{farm.ownershipType || "Not specified"}</p>
            </article>
            <article className="app-detail-item">
              <label>Created At</label>
              <p>{new Date(farm.createdAt).toLocaleDateString()}</p>
            </article>
            {farm.notes && (
              <article className="app-detail-item full-width" style={{ gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <p>{farm.notes}</p>
              </article>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
