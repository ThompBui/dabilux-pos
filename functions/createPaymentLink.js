const functions = require('firebase-functions');
const PayOS = require('@payos/node'); // Đảm bảo cài đặt PayOS trong functions/package.json

const payos = new PayOS(
  functions.config().payos.client_id, // Lấy từ cấu hình Functions
  functions.config().payos.api_key,
  functions.config().payos.checksum_key
);

exports.createPaymentLink = functions.https.onRequest(async (req, res) => {
  // Cho phép CORS nếu cần thiết (quan trọng cho frontend)
  res.set('Access-Control-Allow-Origin', 'https://poscuahang.web.app'); // Hoặc '*' cho dev
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderCode, amount, description, items, cancelUrl, returnUrl } = req.body;

  if (!orderCode || !amount || !description || !cancelUrl || !returnUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const paymentData = {
      orderCode: orderCode,
      amount: amount,
      description: description,
      items: items,
      cancelUrl: cancelUrl,
      returnUrl: returnUrl,
    };

    const paymentLink = await payos.createPaymentLink(paymentData);

    res.status(200).json({
      error: 0,
      message: "Success",
      data: paymentLink,
    });
  } catch (error) {
    console.error("Lỗi khi tạo link thanh toán PayOS:", error);
    res.status(500).json({
      error: -1,
      message: "Failed",
      data: null,
    });
  }
});