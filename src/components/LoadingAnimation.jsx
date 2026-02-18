import "./LoadingAnimation.css";

export default function LoadingAnimation({ label = "Loading", scope = "viewport" }) {
  let wrapClass = "app-loading-wrap";

  if (scope === "viewport") wrapClass += " app-loading-wrap-page";
  else if (scope === "container") wrapClass += " app-loading-wrap-container";
  else if (scope === "inline") wrapClass += " app-loading-wrap-inline";

  return (
    <div className={wrapClass} role="status" aria-live="polite" aria-label={label}>
      {(scope === "viewport" || scope === "container") && (
        <img 
          src="/assets/favcon.png" 
          alt="Loading..." 
          className="app-loading-logo"
        />
      )}
      <div className="app-loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {scope === "inline" && label && <span className="app-loading-label-inline">{label}</span>}
    </div>
  );
}
