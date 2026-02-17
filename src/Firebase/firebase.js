import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRhrfOMv6VRfvqCi6ZBUONBms5noTWk0w",
  authDomain: "students-project-4892c.firebaseapp.com",
  projectId: "students-project-4892c",
  storageBucket: "students-project-4892c.firebasestorage.app",
  messagingSenderId: "333655916071",
  appId: "1:333655916071:web:23b137337fc9a394245802",
  measurementId: "G-MH93TJE2VH",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
