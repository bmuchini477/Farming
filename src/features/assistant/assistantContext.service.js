import { collection, doc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return null;
}

function pickFarm(row) {
  return {
    id: row.id,
    name: row.name || "",
    location: row.location || "",
    sizeHectares: Number(row.sizeHectares || 0),
    soilType: row.soilType || "",
    irrigationSetup: row.irrigationSetup || "",
    waterSource: row.waterSource || "",
    createdAt: toIsoDate(row.createdAt),
  };
}

function pickCrop(row) {
  return {
    id: row.id,
    userId: row.userId || "",
    farmId: row.farmId || "",
    farmName: row.farmName || "",
    name: row.name || row.cropName || "",
    variety: row.variety || "",
    status: row.status || "",
    plantingDate: row.plantingDate || "",
    expectedHarvestDate: row.expectedHarvestDate || "",
    createdAt: toIsoDate(row.createdAt),
    seasonId: row.seasonId || row.id,
  };
}

function summarizeCropPatterns(crops) {
  const byName = new Map();

  for (const crop of crops) {
    const name = (crop.name || "Unknown").trim() || "Unknown";
    const current = byName.get(name) || { total: 0, active: 0 };
    current.total += 1;
    if ((crop.status || "").toLowerCase() === "active") current.active += 1;
    byName.set(name, current);
  }

  return Array.from(byName.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

function compactRecord(id, data) {
  const out = { id, timestamp: toIsoDate(data.timestamp) };
  const allow = [
    "status",
    "notes",
    "ndvi",
    "leafColor",
    "plantPopulation",
    "soilMoistureBefore",
    "soilMoistureAfter",
    "waterVolumeLiters",
    "pestType",
    "diseaseType",
    "severity",
    "actionTaken",
  ];

  for (const key of allow) {
    const value = data[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }

  return out;
}

async function listShared(collectionName, userId, max = 80) {
  const constraints = [limit(max)];
  if (userId) {
    constraints.unshift(where("userId", "==", userId));
  }
  const snap = await getDocs(query(collection(db, collectionName), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listSeasonEvents(ownerUserId, farmId, seasonId, collectionName) {
  try {
    const seasonRef = doc(db, "users", ownerUserId, "fields", farmId, "seasons", seasonId);
    const snap = await getDocs(query(collection(seasonRef, collectionName), orderBy("timestamp", "desc"), limit(3)));
    return snap.docs.map((d) => compactRecord(d.id, d.data()));
  } catch {
    return [];
  }
}

export async function buildAssistantContext(userId) {
  if (!userId) {
    return {
      farmCount: 0,
      cropCount: 0,
      activeCropCount: 0,
      farms: [],
      crops: [],
      cropPatterns: [],
      monitoring: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const [farmsRaw, cropsRaw] = await Promise.all([
    listShared("farms", userId, 30),
    listShared("crops", userId, 80),
  ]);

  const farms = farmsRaw.map(pickFarm);
  const crops = cropsRaw.map(pickCrop).sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return right - left;
  });

  const activeCrops = crops.filter((crop) => (crop.status || "").toLowerCase() === "active");
  const monitoring = [];

  for (const crop of activeCrops.slice(0, 6)) {
    if (!crop.farmId || !crop.seasonId) continue;
    const ownerUserId = crop.userId || userId;
    if (!ownerUserId) continue;

    const [growthRecords, irrigationLogs, pestReports, fumigationSchedules] = await Promise.all([
      listSeasonEvents(ownerUserId, crop.farmId, crop.seasonId, "growthRecords"),
      listSeasonEvents(ownerUserId, crop.farmId, crop.seasonId, "irrigationLogs"),
      listSeasonEvents(ownerUserId, crop.farmId, crop.seasonId, "pestReports"),
      listSeasonEvents(ownerUserId, crop.farmId, crop.seasonId, "fumigationSchedules"),
    ]);

    monitoring.push({
      cropId: crop.id,
      cropName: crop.name,
      farmId: crop.farmId,
      growthRecords,
      irrigationLogs,
      pestReports,
      fumigationSchedules,
    });
  }

  return {
    farmCount: farms.length,
    cropCount: crops.length,
    activeCropCount: activeCrops.length,
    farms,
    crops,
    cropPatterns: summarizeCropPatterns(crops),
    monitoring,
    generatedAt: new Date().toISOString(),
  };
}
