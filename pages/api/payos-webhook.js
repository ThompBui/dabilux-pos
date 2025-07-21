import PayOS from "@payos/node";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase"; // Hãy chắc chắn đường dẫn này đúng tới file firebase.js của bạn

// SỬA LỖI DỨT ĐIỂM: Khởi tạo PayOS bằng một OBJECT chứa các key
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export default async function handler(req, res) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookData = req.body;

  try {
    // 1. Xác thực dữ liệu từ PayOS gửi qua
    const verifiedData = payos.verifyPaymentWebhookData(webhookData);

    // Nếu xác thực thành công, verifiedData sẽ chứa thông tin giao dịch
    if (verifiedData) {
      console.log('Webhook đã được xác thực thành công:', verifiedData);

      // 2. Lấy orderCode từ dữ liệu đã xác thực
      const orderCode = verifiedData.orderCode;

      // 3. Cập nhật trạng thái đơn hàng trong Firestore
      const transactionRef = doc(db, 'transactions', String(orderCode));
      await updateDoc(transactionRef, {
        status: 'PAID', // Cập nhật trạng thái
        webhookReceivedAt: serverTimestamp(), // Ghi lại thời gian nhận webhook
        payosData: verifiedData, // Lưu lại toàn bộ dữ liệu từ PayOS để đối soát
      });
      
      console.log(`Giao dịch ${orderCode} đã được cập nhật thành PAID.`);

      // 4. Phản hồi thành công cho PayOS
      return res.status(200).json({ success: true, message: 'Webhook received and processed.' });
    }
  } catch (error) {
    console.error('Xác thực Webhook thất bại hoặc có lỗi xử lý:', error);
    // Nếu xác thực thất bại, trả về lỗi 400
    return res.status(400).json({ error: 'Webhook verification failed.' });
  }
  
  // Trường hợp dữ liệu không hợp lệ mà không gây ra lỗi
  return res.status(400).json({ error: 'Invalid data.' });
}
