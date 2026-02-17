// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCRhrfOMv6VRfvqCi6ZBUONBms5noTWk0w",
  authDomain: "students-project-4892c.firebaseapp.com",
  projectId: "students-project-4892c",
  storageBucket: "students-project-4892c.firebasestorage.app",
  messagingSenderId: "333655916071",
  appId: "1:333655916071:web:23b137337fc9a394245802",
  measurementId: "G-MH93TJE2VH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);