import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK đã khởi tạo.");
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin SDK:', error.stack);
  }
}

const db_server = admin.firestore();

export { db_server };