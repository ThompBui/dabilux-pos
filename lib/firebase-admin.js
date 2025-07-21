// File: lib/firebase-admin.js

import admin from 'firebase-admin';

// Kiểm tra xem admin app đã được khởi tạo chưa để tránh lỗi
if (!admin.apps.length) {
  try {
    // Ưu tiên đọc từ biến môi trường (dành cho Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK đã khởi tạo từ biến môi trường.");
    } 
    // Nếu không có biến môi trường, đọc từ file (dành cho local)
    else {
      const serviceAccount = require('../../firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK đã khởi tạo từ file.");
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo Firebase Admin SDK:', error.stack);
  }
}

const db_server = admin.firestore();

export { db_server };