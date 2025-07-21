import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import admin from 'firebase-admin';

// --- Cấu hình Firebase cho CLIENT (trình duyệt) ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Khởi tạo app cho CLIENT (chỉ khởi tạo nếu chưa có)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db_client = getFirestore(app); // Đây là DB cho client
const storage = getStorage(app);

// --- Cấu hình Firebase cho SERVER (API routes) bằng Service Account ---
// Đoạn code này chỉ chạy trên môi trường server
try {
  // Chỉ khởi tạo nếu chưa có admin app nào được tạo
  if (!admin.apps.length) {
    // Đọc thông tin từ file "chứng minh thư" của server
    // File này phải nằm ở thư mục gốc của dự án
    const serviceAccount = require('../../../firebase-service-account.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log("Firebase Admin SDK đã được khởi tạo thành công.");
  }
} catch (error) {
  console.error('Lỗi khi khởi tạo Firebase Admin SDK:', error.stack);
}

// Lấy instance Firestore cho SERVER
// Instance này có toàn quyền truy cập do dùng Service Account
const db_server = admin.firestore();

// Export các instance để sử dụng trong toàn bộ dự án
// Client sẽ dùng `db`, Server (trong API) sẽ dùng `db_server`
export { auth, db_client as db, storage, db_server };