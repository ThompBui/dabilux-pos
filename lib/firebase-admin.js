import admin from 'firebase-admin';

try {
  if (!admin.apps.length) {
    // SỬA LẠI ĐƯỜNG DẪN Ở ĐÂY, CHỈ CẦN MỘT DẤU CHẤM
    const serviceAccount = require('../firebase-service-account.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log("Firebase Admin SDK đã được khởi tạo.");
  }
} catch (error) {
  console.error('Lỗi khi khởi tạo Firebase Admin SDK:', error.stack);
}

const db_server = admin.firestore();

export { db_server };