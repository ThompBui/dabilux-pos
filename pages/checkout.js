import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePayOS } from '@payos/payos-checkout';

// Lấy URL trả về một lần duy nhất, tránh dùng state không cần thiết
const RETURN_URL = typeof window !== 'undefined' ? window.location.href : '';

export default function CheckoutPage() {
  // Thay vì chỉ lưu link, ta có thể lưu cả object data để sau này dùng thêm qrCode nếu muốn
  const [paymentData, setPaymentData] = useState(null); 
  const [status, setStatus] = useState('INIT'); // INIT, LOADING, PAID, CANCELLED
  
  // --- Logic tạo link thanh toán (sử dụng useCallback để tối ưu) ---
  const createPaymentLink = useCallback(async () => {
    setStatus('LOADING');
    try {
      const response = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode: Date.now(),
          amount: 5000,
          description: 'Thanh toán đơn hàng test',
          items: [
            { name: "Sản phẩm test", quantity: 1, price: 5000 }
          ],
        }),
      });

      if (!response.ok) {
          const errorResult = await response.json();
          throw new Error(errorResult.details || `Yêu cầu thất bại với mã lỗi ${response.status}`);
      }

      const result = await response.json();

      // ✅ SỬA LỖI QUAN TRỌNG: Truy cập vào `result.data`
      if (result.data && result.data.checkoutUrl) {
        setPaymentData(result.data); // Lưu cả object data
      } else {
        throw new Error('Dữ liệu trả về không chứa checkoutUrl');
      }
    } catch (error) {
      console.error("Lỗi khi tạo link thanh toán:", error);
      alert(`Lỗi: ${error.message}`);
      setStatus('INIT'); // Reset trạng thái nếu có lỗi
    }
  }, []); // useCallback với dependency rỗng vì nó không phụ thuộc state/props nào

  // --- Logic PayOS Hook ---
  const { open } = usePayOS({
    RETURN_URL: RETURN_URL,
    CHECKOUT_URL: paymentData?.checkoutUrl, // Lấy checkoutUrl từ state paymentData
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
       setStatus('INIT'); // Reset về trạng thái ban đầu để có thể thử lại
    }
  });

  // Tự động mở popup khi có link thanh toán
  useEffect(() => {
    if (paymentData && status === 'LOADING') {
      open();
    }
  }, [paymentData, status, open]);

  // --- Render UI ---
  const renderContent = () => {
    switch (status) {
      case 'PAID':
        return (
          <div className="text-green-600">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h2 className="text-xl font-semibold">Thanh toán thành công!</h2>
            <p>Cảm ơn bạn đã mua hàng.</p>
             <button
                onClick={() => {
                    setStatus('INIT');
                    setPaymentData(null);
                }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Thực hiện giao dịch khác
            </button>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="text-red-600">
             <h2 className="text-xl font-semibold">Thanh toán đã bị hủy.</h2>
             <button
                onClick={() => setStatus('INIT')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Thử lại
              </button>
          </div>
        );
      default: // INIT
        return (
          <div>
            <p className="mb-6">Nhấn nút bên dưới để tiến hành thanh toán một đơn hàng trị giá 5,000 VND.</p>
            <button
              onClick={createPaymentLink}
              disabled={status === 'LOADING'}
              className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {status === 'LOADING' ? 'Đang xử lý...' : 'Thanh toán ngay'}
            </button>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6">Trang Thanh toán Test</h1>
        {renderContent()}
      </div>
    </div>
  );
}