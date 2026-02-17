import "./CropTimeline.css";

export default function CropTimeline({ stages, currentDay }) {
  // Find current stage index
  const currentIndex = stages.findIndex(
    (s) => currentDay >= s.fromDay && currentDay <= s.toDay
  );
  
  // If currentDay > last stage day, all are completed
  const lastStage = stages[stages.length - 1];
  const allCompleted = currentDay > lastStage.toDay;
  
  const effectiveIndex = allCompleted ? stages.length : (currentIndex === -1 ? 0 : currentIndex);

  return (
    <div className="app-crop-timeline">
      {stages.map((stage, index) => {
        let status = "pending";
        if (index < effectiveIndex) status = "completed";
        if (index === effectiveIndex) status = "active";
        // If all completed, last one is completed, not active
        if (allCompleted && index === stages.length - 1) status = "completed";

        return (
          <div key={stage.name} className={`timeline-step ${status}`}>
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>{stage.name}</h4>
              <span>Days {stage.fromDay}-{stage.toDay}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
