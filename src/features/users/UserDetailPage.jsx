import { useEffect, useMemo, useState } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../../firebase/firebase";
import LoadingAnimation from "../../components/LoadingAnimation";
import { formatDateTime, normalizeUserRows } from "./userHelpers";

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError("");

    Promise.allSettled([
      getDoc(doc(db, "users", id)),
      getDoc(doc(db, "Users", id)),
    ])
      .then((results) => {
        if (!active) return;

        const lower = results[0];
        const upper = results[1];

        if (lower.status === "fulfilled" && lower.value.exists()) {
          setRow(normalizeUserRows([{ id: lower.value.id, ...lower.value.data() }], "users")[0]);
          return;
        }

        if (upper.status === "fulfilled" && upper.value.exists()) {
          setRow(normalizeUserRows([{ id: upper.value.id, ...upper.value.data() }], "Users")[0]);
          return;
        }

        setRow(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load user:", err);
        setError("Unable to load user details right now.");
        setRow(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const detailFields = useMemo(() => {
    if (!row) return [];
    return Object.keys(row)
      .filter((key) => !key.startsWith("_"))
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        value: row[key],
      }));
  }, [row]);

  async function updateUserRow(patch) {
    if (!row) return;
    setUpdating(true);
    setError("");
    try {
      await updateDoc(doc(db, row._collection, row.id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      setRow((current) => normalizeUserRows([{ ...current, ...patch }], current._collection)[0]);
    } catch (err) {
      console.error("Failed to update user:", err);
      setError("Could not update this user.");
    } finally {
      setUpdating(false);
    }
  }

  async function onToggleActive() {
    if (!row) return;
    const nextActive = !row._active;
    await updateUserRow({
      isActive: nextActive,
      active: nextActive,
      status: nextActive ? "active" : "inactive",
    });
  }

  async function onToggleRole() {
    if (!row) return;
    const nextRole = row._role === "admin" ? "user" : "admin";
    await updateUserRow({
      role: nextRole,
      isAdmin: nextRole === "admin",
    });
  }

  async function onRemoveUser() {
    if (!row) return;
    const ok = window.confirm(`Remove user ${row._displayName}? This cannot be undone.`);
    if (!ok) return;

    setUpdating(true);
    setError("");
    try {
      await deleteDoc(doc(db, row._collection, row.id));
      navigate("/app/users");
    } catch (err) {
      console.error("Failed to remove user:", err);
      setError("Could not remove this user.");
      setUpdating(false);
    }
  }

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head app-card-head-split">
          <div>
            <h1 className="app-title">User Detail</h1>
            <p className="app-subtitle">Complete record for selected user.</p>
          </div>
          <Link to="/app/users" className="app-btn app-btn-outline">
            Back to Users
          </Link>
        </div>

        {loading && <LoadingAnimation label="Loading user details..." scope="inline" />}
        {!loading && error && <p className="app-error">{error}</p>}

        {!loading && !error && !row && (
          <div className="app-empty-inline">
            <p>User record was not found in `users` or `Users`.</p>
          </div>
        )}

        {row && (
          <div className="app-grid-2">
            <article className="app-analytics-card">
              <h3>Summary</h3>
              <div className="app-analytics-body">
                <p><strong>Name:</strong> {row._displayName}</p>
                <p><strong>Email:</strong> {row.email || "-"}</p>
                <p><strong>Role:</strong> {row._role}</p>
                <p><strong>Status:</strong> {row._active ? "active" : "inactive"}</p>
                <p><strong>Created:</strong> {formatDateTime(row.createdAt)}</p>
                <p><strong>Updated:</strong> {formatDateTime(row.updatedAt)}</p>
                <p><strong>Collection:</strong> {row._collection}</p>
                <p><strong>Document ID:</strong> {row.id}</p>
              </div>
              <div className="app-actions-row">
                <button type="button" className="app-btn app-btn-outline" disabled={updating} onClick={onToggleActive}>
                  {row._active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="app-btn app-btn-outline" disabled={updating} onClick={onToggleRole}>
                  {row._role === "admin" ? "Demote" : "Promote Admin"}
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-solid"
                  disabled={updating || row.id === user?.uid}
                  onClick={onRemoveUser}
                  title={row.id === user?.uid ? "You cannot remove the currently signed-in user." : "Remove user"}
                >
                  Remove
                </button>
              </div>
            </article>

            <article className="app-analytics-card">
              <h3>All Stored Fields</h3>
              <div className="app-analytics-body">
                {detailFields.map((item) => (
                  <p key={item.key}>
                    <strong>{item.key}:</strong>{" "}
                    {typeof item.value === "object" ? JSON.stringify(item.value) : String(item.value ?? "-")}
                  </p>
                ))}
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
