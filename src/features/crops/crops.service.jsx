import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const cropsCol = collection(db, "crops");

export async function listActiveCrops() {
  const q = query(cropsCol, where("status", "==", "active"));

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function listActiveCropsWithMonitoring() {
  const crops = await listActiveCrops();

  const withMonitoring = await Promise.all(
    crops.map(async (crop) => {
      const seasonId = crop.seasonId || crop.id;
      if (!crop.farmId || !seasonId) return { ...crop, seasonSnapshot: null };
      const ownerUserId = crop.userId;
      if (!ownerUserId) return { ...crop, seasonSnapshot: null };

      try {
        const seasonRef = doc(db, "users", ownerUserId, "fields", crop.farmId, "seasons", seasonId);
        const seasonSnap = await getDoc(seasonRef);
        return {
          ...crop,
          seasonSnapshot: seasonSnap.exists() ? seasonSnap.data() : null,
        };
      } catch (error) {
        console.error("Failed to load season snapshot:", error);
        return { ...crop, seasonSnapshot: null };
      }
    })
  );

  return withMonitoring;
}
