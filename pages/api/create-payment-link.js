import PayOS from "@payos/node";

// SỬA LỖI DỨT ĐIỂM: Khởi tạo PayOS bằng một OBJECT chứa các key
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderCode, amount, description } = req.body;

  if (orderCode == null || amount == null || description == null) {
    return res.status(400).json({ error: 'Thiếu các trường dữ liệu bắt buộc: orderCode, amount, description' });
  }

  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: `Số tiền (amount) không hợp lệ. Phải là một số nguyên dương. Giá trị nhận được: ${amount}` });
  }
  
  try {
    const paymentData = {
      orderCode: Number(orderCode),
      amount: numericAmount,
      description: description,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout`, // Quay về trang checkout
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout`, // Quay về trang checkout
      items: req.body.items || [],
      
    };
    if (paymentData.items.length === 0) {
        return res.status(400).json({ error: 'Giỏ hàng không được để trống.' });
    }
    console.log("Đang gửi dữ liệu tới PayOS:", paymentData);

    const paymentLink = await payos.createPaymentLink(paymentData);

    // Trả về đúng cấu trúc mà frontend đang mong đợi
    res.status(200).json({
      error: 0,
      message: 'Success',
      data: paymentLink,
    });
  } catch (error) {
    console.error('PayOS API Error:', error);
    res.status(500).json({ 
        error: 'Failed to create payment link', 
        details: error.message,
        payosError: error.response ? error.response.data : null 
    });
  }
}
