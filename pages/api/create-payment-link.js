// pages/api/create-payment-link.js
import PayOS from "@payos/node";

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

export default async function handler(req, res) {
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
    console.log("Data sending to PayOS:", JSON.stringify(paymentData, null, 2));

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
}