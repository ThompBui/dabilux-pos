import PayOS from "@payos/node";

// Khởi tạo PayOS ĐÚNG CÁCH (dạng object)
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderCode, amount, description } = req.body;
const paymentDescription = description || `DH ${orderCode}`;
  if (!orderCode || !amount || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const paymentData = {
  orderCode: orderCode,
  amount: amount,
  description: paymentDescription,
  cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}`,
  returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}`,
  // 🚨 Đảm bảo 'items' luôn là một mảng, ngay cả khi rỗng 🚨
  items: req.body.items || [], // Nếu req.body.items là undefined, nó sẽ là []
};

    // Gọi phương thức tạo link thanh toán
    const paymentLink = await payos.createPaymentLink(paymentData);

    // Trả về dữ liệu cần thiết cho Frontend
    res.status(200).json({
      error: 0, // Dùng error: 0 cho thành công là một convention tốt
      message: 'Success',
      data: {
        bin: paymentLink.bin,
        accountNumber: paymentLink.accountNumber,
        accountName: paymentLink.accountName,
        amount: paymentLink.amount,
        description: paymentLink.description,
        orderCode: paymentLink.orderCode,
        qrCode: paymentLink.qrCode,
        checkoutUrl: paymentLink.checkoutUrl,
      },
    });
  } catch (error) {
    console.error('Failed to create payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
}