// pages/api/payos-webhook.js

import PayOS from "@payos/node";
import admin from 'firebase-admin';
import { db_server } from "../../lib/firebase-admin"; // Đảm bảo đường dẫn này đúng

const payos = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookData = req.body;

  try {
    console.log("Đang xác thực Webhook...");
    const verifiedData = payos.verifyPaymentWebhookData(webhookData);
    console.log("Webhook đã được xác thực thành công.");

    if (verifiedData.code === '00') {
      console.log(`Giao dịch từ PayOS thành công. Bắt đầu tìm và cập nhật giao dịch PENDING trong Firestore...`);

      // --- SỬA LẠI CÚ PHÁP QUERY CHO ĐÚNG VỚI ADMIN SDK ---
      const transactionsRef = db_server.collection('transactions');
      const q = transactionsRef
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')
        .limit(1);

      const querySnapshot = await q.get();
      // ----------------------------------------------------

      if (querySnapshot.empty) {
        console.error("Lỗi nghiêm trọng: Không tìm thấy giao dịch nào ở trạng thái PENDING để cập nhật.");
        throw new Error("No pending transaction found to update.");
      }
      
      const transactionDoc = querySnapshot.docs[0];
      await transactionDoc.ref.update({
        status: 'PAID',
        webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        payosData: verifiedData,
      });
      
      console.log(`Cập nhật Firestore cho giao dịch ${transactionDoc.id} thành công.`);

    } else {
      console.log(`Webhook nhận được nhưng giao dịch chưa thành công. Code: ${verifiedData.code}`);
    }

    return res.status(200).json({ success: true, message: 'Webhook received and processed.' });

  } catch (error) {
    console.error('Xác thực Webhook thất bại hoặc có lỗi xử lý:', error);
    return res.status(400).json({ error: 'Webhook processing error.' });
  }
}