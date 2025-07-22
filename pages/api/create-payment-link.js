import PayOS from "@payos/node";

export default async function handler(req, res) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Lấy và kiểm tra các biến môi trường từ file .env.local
    const { PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, NEXT_PUBLIC_BASE_URL } = process.env;

    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
      console.error("LỖI CẤU HÌNH: Một hoặc nhiều biến môi trường của PayOS bị thiếu.");
      return res.status(500).json({ error: 'Server Configuration Error.' });
    }

    // 2. Lấy và xác thực dữ liệu từ body của request
    const { orderCode, amount, description, items } = req.body;

    if (!orderCode || !amount || !description || !items) {
      return res.status(400).json({ error: 'Thiếu các trường dữ liệu bắt buộc.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Giỏ hàng (items) phải là một mảng và không được rỗng.' });
    }
    
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: `Số tiền (amount) không hợp lệ.` });
    }

    // 3. Khởi tạo đối tượng PayOS
    // Lưu ý: new PayOS() yêu cầu 3 tham số theo đúng thứ tự
    const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

    // 4. Chuẩn bị dữ liệu để tạo link thanh toán
    const paymentData = {
      orderCode: Number(orderCode),
      amount: numericAmount,
      description: description,
      items: items,
      cancelUrl: `${NEXT_PUBLIC_BASE_URL }`, // Dùng biến môi trường, nếu không có thì fallback về localhost
      returnUrl: `${NEXT_PUBLIC_BASE_URL }`,
    };

    console.log("Đang gửi dữ liệu tới PayOS:", JSON.stringify(paymentData, null, 2));

    // 5. Gọi API của PayOS để tạo link
    const paymentLink = await payos.createPaymentLink(paymentData);

    // 6. Trả về kết quả thành công cho client
    return res.status(200).json({
      error: 0,
      message: 'Success',
      data: paymentLink, // paymentLink chứa qrCode, checkoutUrl...
    });

  } catch (error) {
    // Bắt và xử lý mọi lỗi xảy ra trong quá trình
    console.error("PayOS API Error:", error);
    return res.status(500).json({
        error: 'Failed to create payment link',
        details: error.message,
    });
  }
}