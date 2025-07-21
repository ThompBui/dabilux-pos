import { useState, useEffect, useMemo } from 'react';
import { usePayOS } from '@payos/payos-checkout';

export default function CheckoutPage() {
  const [paymentLink, setPaymentLink] = useState(null);
  const [status, setStatus] = useState('INIT'); // INIT, LOADING, PAID, CANCELLED
  
  const [returnUrl, setReturnUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReturnUrl(window.location.href);
    }
  }, []);

  // --- Logic tạo link thanh toán ---
  const createPaymentLink = async () => {
    setStatus('LOADING');
    try {
      const response = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode: Date.now(),
          amount: 5000, // Số tiền tối thiểu PayOS yêu cầu là 1000 VND
          description: 'Thanh toán đơn hàng',
          items: [
            { name: "Sản phẩm test", quantity: 1, price: 5000 }
          ],
        }),
      });

      // SỬA LỖI: Kiểm tra xem yêu cầu HTTP có thành công không
      if (!response.ok) {
          const errorResult = await response.json();
          throw new Error(errorResult.error || `Yêu cầu thất bại với mã lỗi ${response.status}`);
      }

      const result = await response.json();

      // SỬA LỖI: Xử lý đúng cấu trúc dữ liệu trả về từ API của bạn
      // API của bạn đang trả về trực tiếp object của PayOS, không có trường "error" hay "data"
      if (result.checkoutUrl) {
        setPaymentLink(result.checkoutUrl);
      } else {
        // Nếu API thành công nhưng không trả về checkoutUrl
        throw new Error('Dữ liệu trả về không chứa checkoutUrl');
      }
    } catch (error) {
      console.error("Lỗi khi tạo link thanh toán:", error);
      alert(`Lỗi: ${error.message}`);
      setStatus('INIT');
    }
  };

  // --- Logic PayOS Hook ---
  const { open, exit } = usePayOS({
    RETURN_URL: returnUrl,
    CHECKOUT_URL: paymentLink,
    onSuccess: (event) => {
      console.log('Thanh toán thành công:', event);
      setStatus('PAID');
    },
    onCancel: (event) => {
      console.log('Thanh toán bị hủy:', event);
      setStatus('CANCELLED');
    },
    onExit: () => {
       console.log('Người dùng đã đóng popup.');
       setStatus('INIT');
    }
  });

  // Tự động mở popup khi có link thanh toán
  useEffect(() => {
    if (paymentLink && status === 'LOADING' && returnUrl) {
      open();
    }
  }, [paymentLink, status, open, returnUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6">Trang Thanh toán Test</h1>
        
        {status === 'PAID' ? (
          <div className="text-green-600">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h2 className="text-xl font-semibold">Thanh toán thành công!</h2>
            <p>Cảm ơn bạn đã mua hàng.</p>
          </div>
        ) : status === 'CANCELLED' ? (
          <div className="text-red-600">
             <h2 className="text-xl font-semibold">Thanh toán đã bị hủy.</h2>
             <button
                onClick={() => setStatus('INIT')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Thử lại
              </button>
          </div>
        ) : (
          <div>
            <p className="mb-6">Nhấn nút bên dưới để tiến hành thanh toán một đơn hàng trị giá 5,000 VND.</p>
            <button
              onClick={createPaymentLink}
              disabled={status === 'LOADING' || !returnUrl}
              className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
            >
              {status === 'LOADING' ? 'Đang xử lý...' : 'Thanh toán ngay'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
