// File: pages/api/payos-webhook.js
import PayOS from "@payos/node";
import { db } from "../../firebase-admin";

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  try {
    const verifiedData = payos.verifyPaymentWebhookData(req.body);
    
    if (verifiedData.code === "00") {
        const orderCode = verifiedData.data.orderCode;
        const transactionQuery = await db.collection('transactions').where('orderCode', '==', orderCode).limit(1).get();
        
        if (!transactionQuery.empty) {
            const transactionDoc = transactionQuery.docs[0];
            await transactionDoc.ref.update({ status: 'PAID', paidAt: new Date() });
        }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
}