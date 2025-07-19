// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Đọc cấu hình từ biến môi trường
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

try {
  enableIndexedDbPersistence(db)
    .then(() => console.log("Firebase persistence enabled"))
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn("Firebase persistence failed, likely due to multiple open tabs.");
      } else if (err.code == 'unimplemented') {
        console.log("Firebase persistence is not available in this browser.");
      }
    });
} catch (error) {
    console.error("Error enabling Firebase persistence:", error);
}

export { auth, db, storage };