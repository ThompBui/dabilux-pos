import PayOS from "@payos/node";
import { db } from '../../firebase-admin.js';

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export default async function handler(req, res) {
  // 1. Đảm bảo chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. XÁC MINH DỮ LIỆU WEBHOOK
    // Đây là bước quan trọng nhất. Nó kiểm tra chữ ký số để đảm bảo
    // yêu cầu đến từ PayOS và không bị giả mạo hoặc thay đổi.
    // Nếu xác minh thất bại, nó sẽ ném ra lỗi.
    const webhookData = payos.verifyPaymentWebhookData(req.body);
    

    const orderCode = String(webhookData.orderCode); // Lấy mã đơn hàng từ dữ liệu webhook

    // --- Bắt đầu phần CẬP NHẬT DATABASE CỦA BẠN ---
    // Ví dụ giả định bạn có một collection 'orders' trong database
    // và mỗi đơn hàng có một document ID chính là orderCode.

    // const orderRef = db.collection('orders').doc(orderCode); // Tham chiếu đến tài liệu đơn hàng

    if (webhookData.desc === 'success') {
      // 3. Xử lý khi thanh toán THÀNH CÔNG
      // Cập nhật trạng thái đơn hàng trong database của bạn thành 'PAID' hoặc 'COMPLETED'
      // Đồng thời lưu các thông tin giao dịch quan trọng nếu cần (reference, transactionDateTime, v.v.)
      // await orderRef.update({
      //   status: 'PAID',
      //   transactionReference: webhookData.reference,
      //   transactionDateTime: webhookData.transactionDateTime,
      //   // ... thêm các thông tin khác từ webhookData vào database của bạn
      // });
      console.log(`Webhook: Đã xác nhận thanh toán thành công cho đơn hàng: ${orderCode}`);

      // TODO: Thêm logic nghiệp vụ khác tại đây
      // - Gửi email xác nhận đơn hàng cho khách hàng
      // - Cập nhật số lượng sản phẩm trong kho
      // - Ghi log chi tiết giao dịch
      // - ...
    } else {
      // 4. Xử lý khi thanh toán THẤT BẠI hoặc BỊ HỦY
      // Cập nhật trạng thái đơn hàng trong database của bạn thành 'CANCELLED' hoặc 'FAILED'
      // await orderRef.update({
      //   status: 'CANCELLED',
      //   cancellationReason: webhookData.desc,
      //   // ...
      // });
      console.log(`Webhook: Thanh toán thất bại/hủy cho đơn hàng: ${orderCode}. Lý do: ${webhookData.desc}`);

      // TODO: Thêm logic nghiệp vụ khác tại đây
      // - Gửi thông báo cho khách hàng về việc hủy đơn
      // - Hoàn tác các thay đổi nếu cần
    }

    // --- Kết thúc phần CẬP NHẬT DATABASE CỦA BẠN ---

    // 5. PHẢN HỒI LẠI CHO PAYOS ĐỂ XÁC NHẬN ĐÃ NHẬN WEBHOOK
    // Đây là BẮT BUỘC. Nếu bạn không trả về status 200 OK,
    // PayOS sẽ cho rằng webhook chưa được xử lý và sẽ thử gửi lại nhiều lần.
    res.status(200).json({ success: true, message: "Webhook processed" });

  } catch (error) {
    // 6. Xử lý lỗi trong quá trình xử lý webhook
    console.error('Webhook verification failed or processing error:', error);
    // Trả về lỗi 400 hoặc 401 nếu xác minh chữ ký thất bại
    // hoặc 500 nếu có lỗi trong quá trình xử lý database của bạn.
    // Điều này sẽ khiến PayOS thử gửi lại webhook.
    res.status(400).json({ error: 'Webhook processing failed', details: error.message });
  }
}