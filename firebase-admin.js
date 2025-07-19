// firebase-admin.js
import admin from 'firebase-admin';

// Kiểm tra xem app đã được khởi tạo chưa để tránh lỗi re-initialize
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Thay thế `\\n` trở lại thành `\n` khi đọc từ env
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

// Export instance của firestore để dùng ở các file khác (như webhook)
const db = admin.firestore();
export { db };