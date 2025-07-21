import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.'); // Thêm log để dễ debug
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    console.error('Error stack:', error.stack);
  }
}

export const db = admin.firestore();