import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../../firebase/firebase";
import LoadingAnimation from "../../components/LoadingAnimation";
import { normalizeUserRows } from "./userHelpers";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    let active = true;
    setLoading(true);
    setError("");

    Promise.allSettled([
      getDocs(collection(db, "Users")),
      getDocs(collection(db, "users")),
    ])
      .then((results) => {
        if (!active) return;

        const allRows = [];
        const seenIds = new Set();

        results.forEach((result, idx) => {
          if (result.status !== "fulfilled") return;

          const collectionName = idx === 0 ? "Users" : "users";
          const rows = result.value.docs.map((d) => ({ id: d.id, ...d.data() }));
          normalizeUserRows(rows, collectionName).forEach((row) => {
            if (seenIds.has(row.id)) return;
            seenIds.add(row.id);
            allRows.push(row);
          });
        });

        allRows.sort((a, b) => {
          const aTime = Number(a.createdAt?.seconds || a.createdAt || 0);
          const bTime = Number(b.createdAt?.seconds || b.createdAt || 0);
          if (aTime !== bTime) return bTime - aTime;
          return a._displayName.localeCompare(b._displayName);
        });

        setUsers(allRows);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load users:", err);
        setUsers([]);
        setError("Unable to load users right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function updateUserRow(targetUser, patch) {
    if (!targetUser) return;
    setUpdating(true);
    setError("");
    try {
      const ref = doc(db, targetUser._collection, targetUser.id);
      await updateDoc(ref, {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((row) =>
          row.id === targetUser.id
            ? normalizeUserRows([{ ...row, ...patch }], row._collection)[0]
            : row
        )
      );
    } catch (err) {
      console.error("Failed to update user:", err);
      setError("Could not update selected user.");
    } finally {
      setUpdating(false);
    }
  }

  async function onToggleActive(targetUser) {
    if (!targetUser) return;
    const nextActive = !targetUser._active;
    await updateUserRow(targetUser, {
      isActive: nextActive,
      active: nextActive,
      status: nextActive ? "active" : "inactive",
    });
  }

  async function onToggleRole(targetUser) {
    if (!targetUser) return;
    const nextRole = targetUser._role === "admin" ? "user" : "admin";
    await updateUserRow(targetUser, {
      role: nextRole,
      isAdmin: nextRole === "admin",
    });
  }

  async function onRemoveUser(targetUser) {
    if (!targetUser) return;
    const ok = window.confirm(`Remove user ${targetUser._displayName}? This cannot be undone.`);
    if (!ok) return;

    setUpdating(true);
    setError("");
    try {
      await deleteDoc(doc(db, targetUser._collection, targetUser.id));
      setUsers((prev) => prev.filter((row) => row.id !== targetUser.id));
    } catch (err) {
      console.error("Failed to remove user:", err);
      setError("Could not remove selected user.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <div className="app-card-head">
          <h1 className="app-title">Users</h1>
          <p className="app-subtitle">All user records from Firestore users collections.</p>
        </div>

        {loading && <LoadingAnimation label="Loading users..." scope="inline" />}
        {!loading && error && <p className="app-error">{error}</p>}

        {!loading && users.length === 0 && (
          <div className="app-empty-inline">
            <p>No user documents found in Firestore `Users`/`users` collections.</p>
          </div>
        )}

        {users.length > 0 && (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id}>
                    <td>{row._displayName}</td>
                    <td>{row.email || "-"}</td>
                    <td>{row._role}</td>
                    <td>{row._active ? "active" : "inactive"}</td>
                    <td>
                      <Link to={`/app/users/${row.id}`} className="app-btn app-btn-outline">
                        View
                      </Link>
                    </td>
                    <td>
                      <div className="app-actions-row">
                        <button type="button" className="app-btn app-btn-outline" disabled={updating} onClick={() => onToggleActive(row)}>
                          {row._active ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" className="app-btn app-btn-outline" disabled={updating} onClick={() => onToggleRole(row)}>
                          {row._role === "admin" ? "Demote" : "Promote Admin"}
                        </button>
                        <button
                          type="button"
                          className="app-btn app-btn-solid"
                          disabled={updating || row.id === user?.uid}
                          onClick={() => onRemoveUser(row)}
                          title={row.id === user?.uid ? "You cannot remove the currently signed-in user." : "Remove user"}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
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
