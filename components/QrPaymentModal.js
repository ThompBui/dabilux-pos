import React, { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

export default function QrPaymentModal({ isOpen, onClose, amount, checkoutUrl, qrCode, status }) {
    const [qrImage, setQrImage] = useState('');

    useEffect(() => {
        if (isOpen && qrCode) {
            QRCode.toDataURL(qrCode, { width: 256, margin: 2 }, (err, url) => {
                if (err) console.error(err);
                setQrImage(url);
            });
        }
    }, [isOpen, qrCode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm text-center p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2">Thanh toán qua QR Code</h3>
                <p className="text-slate-500 mb-4">Quét mã QR bằng ứng dụng ngân hàng của bạn</p>
                
                {status === 'PENDING' && qrImage && (
                    <>
                        <div className="bg-white p-4 rounded-lg inline-block">
                            <img src={qrImage} alt="Mã QR thanh toán" width="256" height="256" />
                        </div>
                        <p className="text-2xl font-bold text-indigo-600 mt-4">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}
                        </p>
                        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
                            Không quét được? Mở link thanh toán.
                        </a>
                    </>
                )}
                
                {status === 'LOADING' && (
                    <div className="h-[300px] flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="mt-4 text-slate-600">Đang tạo link thanh toán...</p>
                    </div>
                )}
                
                {status === 'PAID' && (
                    <div className="h-[300px] flex flex-col items-center justify-center text-green-500">
                        <CheckCircle size={64} />
                        <p className="mt-4 text-2xl font-bold">Thanh toán thành công!</p>
                        <p className="text-slate-500">Đang hoàn tất đơn hàng...</p>
                    </div>
                )}
                 {status === 'CANCELLED' && (
                    <div className="h-[300px] flex flex-col items-center justify-center text-red-500">
                        <AlertTriangle size={64} />
                        <p className="mt-4 text-2xl font-bold">Thanh toán đã hủy</p>
                        <button onClick={onClose} className="btn-primary mt-4">Đóng</button>
                    </div>
                )}
            </div>
        </div>
    );
}