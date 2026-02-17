import { useState, useEffect } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";
import "../../AuthPages.css";

export default function EmailVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Redirect if already verified
  useEffect(() => {
    if (user?.emailVerified) {
      navigate("/app");
    }
  }, [user, navigate]);

  async function handleResend() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage("Verification email sent! Please check your inbox.");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a moment before trying again.");
      } else {
        setError("Failed to send verification email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckVerified() {
    setLoading(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        navigate("/app");
      } else {
        setError("Email not verified yet. Please check your inbox and click the link.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to check verification status.");
    } finally {
      setLoading(false);
    }
  }

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
          <h2 className="auth-card-title">Verify Your Email</h2>
          <p className="auth-card-subtitle">
            We've sent a verification email to <strong>{user?.email}</strong>.
          </p>
        </div>

        <div className="auth-card-body">
          <div className="auth-form">
             <p className="text-sm text-slate-600 mb-6 text-center">
              Please check your inbox and click the verification link to activate your account. 
              If you don't see it, check your spam folder.
            </p>

            {message && <div className="bg-emerald-50 text-emerald-700 p-3 rounded mb-4 text-sm">{message}</div>}
            {error && <div className="auth-error">{error}</div>}

            <button 
                onClick={handleCheckVerified} 
                disabled={loading} 
                className="auth-submit mb-3"
            >
              {loading ? "Checking..." : "I've Verified My Email"}
            </button>

            <button 
                onClick={handleResend} 
                disabled={loading} 
                className="w-full py-2.5 px-4 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Resend Verification Email
            </button>
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
