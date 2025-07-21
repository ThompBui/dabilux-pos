import PayOS from "@payos/node";
import admin from 'firebase-admin'; // Import admin để dùng các hàm đặc biệt
import { db_server } from '../../lib/firebase-admin';
const payos = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookData = req.body;
console.log("\n\n--- NHẬN ĐƯỢC DỮ LIỆU WEBHOOK ---");
console.log("Data nhận được:", JSON.stringify(webhookData, null, 2));
console.log("---------------------------------\n\n");
  try {
    console.log("Đang xác thực Webhook...");
    const verifiedData = payos.verifyPaymentWebhookData(webhookData);
    console.log("Webhook đã được xác thực thành công:", verifiedData);

    if (verifiedData.code === '00') {
      const orderCode = verifiedData.orderCode;
      
      console.log(`Giao dịch ${orderCode} thành công. Bắt đầu cập nhật Firestore...`);
      
      // Sử dụng `db_server` để có quyền ghi vào DB từ server
      const transactionRef = db_server.collection('transactions').doc(String(orderCode));
      
      // Dùng cú pháp của Admin SDK để cập nhật
      await transactionRef.update({
        status: 'PAID',
        webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        payosData: verifiedData,
      });
      
      console.log(`Cập nhật Firestore cho giao dịch ${orderCode} thành công.`);
    } else {
      console.log(`Webhook nhận được nhưng giao dịch chưa thành công. Code: ${verifiedData.code}`);
    }

    return res.status(200).json({ success: true, message: 'Webhook received and processed.' });

  } catch (error) {
    console.error('Xác thực Webhook thất bại hoặc có lỗi xử lý:', error);
    return res.status(400).json({ error: 'Webhook verification failed or processing error.' });
  }
}