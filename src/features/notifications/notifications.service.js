import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

function uniqueIds(ids = []) {
  return Array.from(new Set((ids || []).filter(Boolean)));
}

export function watchUserNotifications(userId, onRows) {
  if (!userId || typeof onRows !== "function") return () => {};
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snapshot) => {
    onRows(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return;
  await updateDoc(doc(db, "users", userId, "notifications", notificationId), {
    read: true,
    readAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function deleteAllReadNotifications(userId) {
  if (!userId) return 0;
  const notificationsRef = collection(db, "users", userId, "notifications");
  const readQuery = query(notificationsRef, where("read", "==", true));
  const readSnap = await getDocs(readQuery);
  if (readSnap.empty) return 0;

  const batch = writeBatch(db);
  readSnap.docs.forEach((item) => {
    batch.delete(item.ref);
  });
  await batch.commit();
  return readSnap.size;
}

export async function listKnownUserIds() {
  const [lowerResult, upperResult] = await Promise.allSettled([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "Users")),
  ]);

  const ids = [];
  if (lowerResult.status === "fulfilled") {
    lowerResult.value.docs.forEach((d) => ids.push(d.id));
  }
  if (upperResult.status === "fulfilled") {
    upperResult.value.docs.forEach((d) => ids.push(d.id));
  }
  return uniqueIds(ids);
}

export async function createNotificationsForUsers(userIds, payload = {}) {
  const targets = uniqueIds(userIds);
  if (!targets.length) return 0;

  const now = Date.now();
  const batch = writeBatch(db);

  targets.forEach((targetUserId) => {
    const targetCollection = collection(db, "users", targetUserId, "notifications");
    const targetDoc = doc(targetCollection);
    batch.set(targetDoc, {
      title: payload.title || "Notification",
      message: payload.message || "",
      type: payload.type || "general",
      route: payload.route || "",
      read: false,
      createdAt: now,
      updatedAt: now,
      actorId: payload.actorId || "",
      actorName: payload.actorName || "",
      meta: payload.meta || {},
    });
  });

  await batch.commit();
  return targets.length;
}
