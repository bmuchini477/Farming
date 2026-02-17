export function formatDateTime(value) {
  if (!value) return "-";
  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

export function displayNameOf(userRow) {
  return (
    userRow.displayName ||
    userRow.name ||
    userRow.fullName ||
    userRow.firstName ||
    userRow.firstname ||
    userRow.email ||
    userRow.id
  );
}

export function roleOf(userRow) {
  if (typeof userRow.isAdmin === "boolean") {
    return userRow.isAdmin ? "admin" : "user";
  }
  return (userRow.role || "user").toLowerCase() === "admin" ? "admin" : "user";
}

export function activeOf(userRow) {
  if (typeof userRow.isActive === "boolean") return userRow.isActive;
  if (typeof userRow.active === "boolean") return userRow.active;
  if (typeof userRow.enabled === "boolean") return userRow.enabled;
  const status = (userRow.status || "").toLowerCase();
  if (status === "inactive" || status === "disabled") return false;
  return true;
}

export function normalizeUserRows(rows, collectionName) {
  return rows.map((row) => ({
    ...row,
    _collection: collectionName,
    _displayName: displayNameOf(row),
    _role: roleOf(row),
    _active: activeOf(row),
  }));
}
