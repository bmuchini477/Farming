import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { stageForDay, defaultStages } from "./cropStages";
import FieldMonitoringForms from "./FieldMonitoringForms";
import LoadingAnimation from "../../components/LoadingAnimation";
import CropTimeline from "./CropTimeline";

function daysBetween(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export default function CropDetailPage() {
  const { id } = useParams();
  const [crop, setCrop] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    getDoc(doc(db, "crops", id)).then((snap) => {
      if (snap.exists()) setCrop({ id: snap.id, ...snap.data() });
    });
  }, [id]);

  if (!crop) {
    return (
      <div style={{ position: "relative", minHeight: "calc(100vh - 8rem)" }}>
        <LoadingAnimation label="Loading crop details..." scope="container" />
      </div>
    );
  }

  const day = Math.min(crop.totalDays, Math.max(0, daysBetween(crop.plantingDate, today) + 1));
  const percent = (day / crop.totalDays) * 100;
  const stage = stageForDay(day);

  return (
    <div className="app-page-stack">
      <section className="app-card">
        <h1 className="app-title">{crop.name}</h1>
        <p className="app-subtitle">
          Day {day}/{crop.totalDays} | Harvest {crop.expectedHarvestDate}
        </p>

        <div className="app-progress-inline">
          <div className="app-progress-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <small>{Math.round(percent)}% complete</small>
        </div>

        <div className="app-stage-note">
          <p><strong>Current Stage:</strong> {stage.name}</p>
          <p><strong>Guidance:</strong> {stage.tips.join(", ")}.</p>
        </div>
      </section>

      <section className="app-card">
        <div className="app-card-head">
          <h2 className="app-title-sm">Lifecycle Timeline</h2>
        </div>
        <CropTimeline stages={defaultStages} currentDay={day} />
      </section>

      <FieldMonitoringForms crop={crop} />
    </div>
  );
}
