import PayOS from "@payos/node";
import { db } from '../../firebase-admin.js';

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = payos.verifyPaymentWebhook(req.body);
    const orderCode = String(webhookData.orderCode);
    const transactionRef = db.collection('transactions').doc(orderCode);

    if (webhookData.desc === 'success') {
        // CẬP NHẬT TRẠNG THÁI THÀNH 'PAID'
        await transactionRef.update({ status: 'PAID' });
        console.log(`Webhook: Đã xác nhận thanh toán cho đơn hàng: ${orderCode}`);
    } else {
        // CÓ THỂ CẬP NHẬT TRẠNG THÁI THÀNH 'CANCELLED' NẾU CẦN
        await transactionRef.update({ status: 'CANCELLED' });
        console.log(`Webhook: Thanh toán thất bại/hủy cho đơn hàng: ${orderCode}`);
    }

    // Phản hồi cho PayOS biết đã nhận được
    res.status(200).json({ success: true, message: "Webhook processed" });

  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
}