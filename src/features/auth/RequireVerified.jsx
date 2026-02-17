import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import LoadingAnimation from "../../components/LoadingAnimation";

export function RequireVerified({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingAnimation label="Checking verification..." fullPage size="lg" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  // Check if account is active (approved by admin)
  // Assuming 'isActive' is a boolean field in Firestore user document
  if (user.isActive === false) { 
      // Note: Strict check for false, or check if it's explicitly not true? 
      // User creation sets it to false. 
      return <Navigate to="/account-pending" replace />;
  }

  return children;
}
