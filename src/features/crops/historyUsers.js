import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

function firstToken(value) {
  if (!value || typeof value !== "string") return "";
  const token = value.trim().split(/\s+/)[0];
  return token || "";
}

function extractFirstName(data = {}) {
  return (
    firstToken(data.firstName) ||
    firstToken(data.firstname) ||
    firstToken(data.givenName) ||
    firstToken(data.name) ||
    firstToken(data.fullName) ||
    firstToken(data.displayName)
  );
}

async function readUserDoc(collectionName, userId) {
  try {
    const snap = await getDoc(doc(db, collectionName, userId));
    if (!snap.exists()) return "";
    return extractFirstName(snap.data());
  } catch (err) {
    console.error(`Failed to read ${collectionName}/${userId}:`, err);
    return "";
  }
}

export async function resolveUserFirstNames(userIds = [], currentUser = null) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  const pairs = await Promise.all(
    ids.map(async (userId) => {
      const fromUsers = await readUserDoc("Users", userId);
      const fromusers = fromUsers ? "" : await readUserDoc("users", userId);
      const fromAuth = currentUser?.uid === userId ? firstToken(currentUser?.displayName) : "";
      const firstName = fromUsers || fromusers || fromAuth || "Unknown";
      return [userId, firstName];
    })
  );

  return Object.fromEntries(pairs);
}

