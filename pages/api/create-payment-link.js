import PayOS from "@payos/node";

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderCode, amount, description } = req.body;

  if (!orderCode || !amount || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const paymentData = {
      orderCode: orderCode,
      amount: amount,
      description: description,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}`, // Link quay về khi hủy
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}`, // Link quay về khi thành công
    };

    const paymentLink = await payos.createPaymentLink(paymentData);
    
    res.status(200).json({
      error: 0,
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