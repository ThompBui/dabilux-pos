import PayOS from "@payos/node";
import { db } from '../../firebase-admin'; // Đảm bảo đường dẫn này đúng với vị trí file firebase-admin.js của bạn

// Khởi tạo PayOS SDK với các biến môi trường của bạn
const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

export default async function handler(req, res) {
  // --- Bắt đầu xử lý yêu cầu GET cho mục đích kiểm tra URL ---
  if (req.method === 'GET') {
    console.log('Nhận được yêu cầu GET từ ứng dụng để kiểm tra webhook URL.');
    // Trả về mã trạng thái 200 OK để xác nhận URL webhook đang hoạt động.
    // KHÔNG xử lý bất kỳ dữ liệu thanh toán nào trong yêu cầu GET vì nó không an toàn và không phải mục đích.
    return res.status(200).json({ message: 'Webhook endpoint is alive for GET requests (for URL verification).' });
  }
  // --- Kết thúc xử lý yêu cầu GET ---


  // --- Bắt đầu xử lý các yêu cầu POST từ PayOS ---
  if (req.method !== 'POST') {
    // Nếu yêu cầu không phải là POST và cũng không phải GET (đã xử lý ở trên), trả về lỗi 405
    console.warn(`Webhook received unsupported method: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed. Only POST requests are supported for payment notifications.' });
  }

  // Nếu đến được đây, nghĩa là đây là một yêu cầu POST
  try {
    // Xác minh dữ liệu webhook từ PayOS
    const webhookData = payos.verifyPaymentWebhook(req.body);
    console.log('Webhook data received and verified:', webhookData);

    // Kiểm tra trạng thái thanh toán từ dữ liệu webhook
    if (webhookData.desc === 'success') {
        const orderCode = webhookData.orderCode;
        console.log(`Webhook: Đã nhận xác nhận thanh toán thành công cho đơn hàng: ${orderCode}`);

        // Cập nhật trạng thái đơn hàng trong Firestore
        const orderRef = db.collection('orders').doc(String(orderCode));
        await orderRef.update({
            status: 'PAID',
            updatedAt: admin.firestore.FieldValue.serverTimestamp() // Cập nhật thời gian
        });
        console.log(`Webhook: Đã cập nhật trạng thái đơn hàng ${orderCode} thành 'PAID' trong Firestore.`);

    } else {
        console.log(`Webhook: Thanh toán thất bại hoặc đang chờ cho đơn hàng: ${webhookData.orderCode}, Trạng thái: ${webhookData.desc}`);
        // Tùy chọn: Xử lý các trạng thái khác nếu cần (ví dụ: cập nhật 'PENDING', 'FAILED')
        // const orderRef = db.collection('orders').doc(String(webhookData.orderCode));
        // await orderRef.update({
        //     status: webhookData.desc === 'pending' ? 'PENDING' : 'FAILED',
        //     updatedAt: admin.firestore.FieldValue.serverTimestamp()
        // });
    }

    // Luôn trả về 200 OK cho PayOS sau khi xử lý thành công (hoặc ít nhất là đã nhận)
    // để PayOS không gửi lại thông báo
    return res.status(200).json({ success: true, message: 'Webhook notification processed.' });

  } catch (error) {
    console.error('Webhook verification or processing failed:', error.message);
    console.error('Error stack:', error.stack);
    // Trả về lỗi 400 nếu xác minh webhook thất bại (ví dụ: sai chữ ký)
    return res.status(400).json({ error: 'Webhook verification or processing failed.' });
  }
  // --- Kết thúc xử lý các yêu cầu POST ---
}