import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";
import "../../AuthPages.css";

export default function AccountPendingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Redirect if active
  useEffect(() => {
    if (user?.isActive) {
      navigate("/app");
    }
  }, [user, navigate]);

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <img src="/assets/authlogo.png" alt="FarmTrack logo" className="auth-card-logo" />
          <h2 className="auth-card-title">Account Pending</h2>
          <p className="auth-card-subtitle">
            Welcome, <strong>{user?.displayName || user?.email}</strong>!
          </p>
        </div>

        <div className="auth-card-body">
          <div className="auth-form">
            <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 border border-amber-200">
               <h3 className="font-semibold mb-2">Activation Required</h3>
               <p className="text-sm">
                Your email is verified, but your account is currently pending administrative approval. 
                You will be able to access the dashboard once an administrator activates your account.
              </p>
            </div>

            <p className="text-sm text-slate-500 text-center mb-6">
              Please check back later or contact support if you believe this is an error.
            </p>
          </div>

          <div className="auth-footer">
            <button onClick={handleLogout} className="auth-link text-sm">
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
