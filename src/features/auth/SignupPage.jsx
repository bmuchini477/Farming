import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import "../../AuthPages.css";

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getSignupErrorMessage(err) {
    switch (err?.code) {
      case "auth/email-already-in-use":
        return "Email is already in use.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/operation-not-allowed":
        return "Email/password sign-up is disabled in Firebase. Enable it in Authentication > Sign-in method.";
      case "auth/network-request-failed":
        return "Network error. Check your internet connection and try again.";
      default:
        return `Failed to create an account${err?.code ? ` (${err.code})` : ""}.`;
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const trimmedName = name.trim();

      if (trimmedName) {
        await updateProfile(userCredential.user, {
          displayName: trimmedName,
        });
      }

      await setDoc(
        doc(db, "users", userCredential.user.uid),
        {
          uid: userCredential.user.uid,
          email: userCredential.user.email || email.trim(),
          displayName: trimmedName || null,
          isAdmin: false,
          isActive: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await sendEmailVerification(userCredential.user);
      navigate("/verify-email");
    } catch (err) {
      console.error(err);
      setError(getSignupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <img src="/assets/authlogo.png" alt="FarmTrack logo" className="auth-card-logo" />
          <h2 className="auth-card-title">Create Account</h2>
          <p className="auth-card-subtitle">Set up your profile and start tracking your farm performance.</p>
        </div>

        <div className="auth-card-body">
          <form onSubmit={onSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                required
                className="auth-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                type="email"
                required
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                required
                className="auth-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login" className="auth-link">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
