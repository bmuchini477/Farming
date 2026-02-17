import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeFirestore = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, verify specific Firestore data (isActive)
        const userRef = doc(db, "users", firebaseUser.uid);
        
        unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            // Merge auth user with firestore data
            const mergedUser = {
              ...firebaseUser,
              ...userData,
              // Ensure we don't lose key auth properties if needed, though spreading firebaseUser usually copies the necessary props.
              // Note: Protoype methods like getIdToken will be lost if we spread into a plain object.
              // It is safer to modify a copy or just attach specific fields.
              // For this app, let's attach the data we need directly to the object prototype or just return a mixed object if we don't call methods on 'user' often.
              // A safer way for existing logic (which often checks 'user.uid') is to keep the firebaseUser reference but strictly add the database fields.
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified,
            };
            
            setUser(mergedUser);
          } else {
            // Document doesn't exist yet (e.g. just created), fallback to auth user
            setUser(firebaseUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setUser(firebaseUser);
          setLoading(false);
        });

      } else {
        // User not signed in
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
