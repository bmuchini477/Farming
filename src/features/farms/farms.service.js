import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const farmsCol = collection(db, "farms");

export function generateFarmCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FARM-${stamp}-${random}`;
}

export async function createFarm(userId, payload) {
  return addDoc(farmsCol, {
    userId,
    name: payload.name,
    location: payload.location || "",
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    sizeHectares: Number(payload.sizeHectares || 0),
    managerName: payload.managerName || "",
    contactPhone: payload.contactPhone || "",
    soilType: payload.soilType || "",
    irrigationSetup: payload.irrigationSetup || "",
    waterSource: payload.waterSource || "",
    ownershipType: payload.ownershipType || "",
    accessRoad: payload.accessRoad || "",
    storageAvailable: payload.storageAvailable || "",
    notes: payload.notes || "",
    farmCode: payload.farmCode || generateFarmCode(),
    createdAt: Date.now(),
  });
}

export async function listFarms() {
  const snap = await getDocs(farmsCol);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function getFarm(id) {
  const ref = doc(db, "farms", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateFarm(id, data) {
  const ref = doc(db, "farms", id);
  return updateDoc(ref, {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteFarm(id) {
  const ref = doc(db, "farms", id);
  return deleteDoc(ref);
}

export function watchFarms(onData, onError) {
  return onSnapshot(
    farmsCol,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      onData(rows);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}
