import { useAuth } from "../auth/AuthProvider";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || "Farmer";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileDetails = user
    ? [
        { label: "Display Name", value: user.displayName || "-" },
        { label: "Email", value: user.email || "-" },
        { label: "User ID", value: user.uid },
        { label: "Phone", value: user.phoneNumber || "-" },
        { label: "Email Verified", value: user.emailVerified ? "Yes" : "No" },
        { label: "Account Created", value: formatDateTime(user.metadata?.creationTime) },
        { label: "Last Sign In", value: formatDateTime(user.metadata?.lastSignInTime) },
      ]
    : [];

  return (
    <div className="profile-page-shell">
      <section className="profile-card">
        <div className="profile-card-accent" />
        <div className="profile-card-content">
          <header className="profile-card-header">
            <div className="profile-avatar" aria-hidden="true">
              {initials}
            </div>
            <div>
              <p className="profile-kicker">Account Center</p>
              <h1 className="profile-title">My Profile</h1>
              <p className="profile-subtitle">Your account information from the current signed-in session.</p>
            </div>
          </header>

          {!user && (
            <div className="app-empty-inline">
              <p>No user is currently signed in.</p>
            </div>
          )}

          <div className="profile-info-grid">
            {profileDetails.map((item) => (
              <article className="profile-info-item" key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
