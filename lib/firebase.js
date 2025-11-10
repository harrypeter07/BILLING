import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWrGX39xNmV5U80dulcFOCY51UvKeshqs",
  authDomain: "billingsolution.firebaseapp.com",
  projectId: "billingsolution",
  storageBucket: "billingsolution.firebasestorage.app",
  messagingSenderId: "865948802755",
  appId: "1:865948802755:web:27ba91edc375e726b1cc76",
  measurementId: "G-Q150FKH8X6"
};

const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser)
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Initialize Firestore
export const db = getFirestore(app);

export { app, analytics };


