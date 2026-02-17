import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

function toIsAdmin(userData) {
  if (!userData) return false;
  if (typeof userData.isAdmin === "boolean") return userData.isAdmin;
  return String(userData.role || "").toLowerCase() === "admin";
}

export function useAdminStatus(user) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setIsAdmin(false);
      setLoadingAdmin(false);
      return;
    }

    let active = true;
    setLoadingAdmin(true);

    Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "Users", user.uid))])
      .then(([lower, upper]) => {
        if (!active) return;
        const lowerData = lower.exists() ? lower.data() : null;
        const upperData = upper.exists() ? upper.data() : null;
        setIsAdmin(toIsAdmin(lowerData || upperData));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to resolve admin status:", error);
        setIsAdmin(false);
      })
      .finally(() => {
        if (!active) return;
        setLoadingAdmin(false);
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  return { isAdmin, loadingAdmin };
}
