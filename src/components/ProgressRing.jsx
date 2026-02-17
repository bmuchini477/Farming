export default function ProgressRing({ percent, color = "#148258" }) {
  const r = 18;
  const c = 2 * Math.PI * r;

  const pct = Math.min(100, Math.max(0, Number(percent || 0)));
  const dash = (pct / 100) * c;

  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} strokeWidth="6" fill="none" stroke="#dcefe4" />
      <circle
        cx="24"
        cy="24"
        r={r}
        strokeWidth="6"
        fill="none"
        stroke={color}
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 24 24)"
        strokeLinecap="round"
      />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fill="#2f3f46" fontWeight="700">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
