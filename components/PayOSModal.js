// components/PayOSModal.js

import { useState } from 'react';
import { QRCode } from 'qrcode.react';

export default function PayOSModal() {
  const [showModal, setShowModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePayNow = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode: Date.now(),
          amount: 100000,
          description: 'Thanh toán đơn hàng #123',
          items: [{ name: 'Sản phẩm A', quantity: 1, price: 100000 }],
        }),
      });

      const result = await res.json();
      if (result?.qrCode) {
        setQrCodeData(result.qrCode); // lưu QR để render
        setShowModal(true);
      } else {
        alert('Không lấy được mã QR!');
        console.error('Lỗi:', result);
      }
    } catch (err) {
      console.error('Lỗi tạo link:', err);
      alert('Có lỗi xảy ra khi tạo thanh toán');
    }
    setIsLoading(false);
  };

  return (
    <>
      <button
        onClick={handlePayNow}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {isLoading ? 'Đang tạo link...' : 'Thanh toán với PayOS'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 relative w-full max-w-md text-center">
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black text-xl"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-4">Quét mã để thanh toán</h2>
            <QRCode value={qrCodeData} size={256} />
          </div>
        </div>
      )}
    </>
  );
}
