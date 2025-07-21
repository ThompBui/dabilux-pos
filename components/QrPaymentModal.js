import React, { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'; // Đổi AlertTriangle thành X nếu muốn
import QRCode from 'qrcode';
// Import Modal component của bạn nếu bạn có
// import Modal from './Modal'; // Giả sử bạn có một component Modal chung

export default function QrPaymentModal({ isOpen, onClose, amount, checkoutUrl, qrCode, status }) {
    const [qrImage, setQrImage] = useState('');

    // Hàm định dạng tiền tệ (đảm bảo nó có sẵn hoặc định nghĩa ở đây)
    const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

    // Tạo QR code image URL từ qrCode data (nếu có)
    useEffect(() => {
        // Chỉ tạo QR code nếu modal mở và có qrCode data
        if (isOpen && qrCode) {
            QRCode.toDataURL(qrCode, { width: 256, margin: 2 }, (err, url) => {
                if (err) {
                    console.error("Lỗi khi tạo QR code:", err);
                    setQrImage(''); // Xóa QR nếu có lỗi
                } else {
                    setQrImage(url);
                }
            });
        } else {
            setQrImage(''); // Reset QR image khi modal đóng hoặc không có qrCode
        }
    }, [isOpen, qrCode]);

    // Nếu modal không mở thì không render gì cả
    if (!isOpen) return null;

    return (
        // Sử dụng cấu trúc modal của bạn.
        // Đây là ví dụ với overlay và nội dung nằm giữa màn hình.
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm text-center p-6" onClick={e => e.stopPropagation()}>
                {/* Nút đóng modal (chỉ hiển thị ở một số trạng thái) */}
                {(status === 'PAID' || status === 'CANCELLED' || status === 'ERROR') && (
                    <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                        <X size={24} />
                    </button>
                )}

                {/* Tiêu đề chung của modal */}
                <h3 className="text-xl font-bold mb-2">Thanh toán PayOS</h3>
                {status !== 'PAID' && status !== 'CANCELLED' && status !== 'ERROR' && (
                    <p className="text-slate-500 mb-4">Hoàn tất giao dịch qua PayOS</p>
                )}
                
                {/* 1. Trạng thái Đang tải (gọi backend) */}
                {(status === 'LOADING' || status === 'OPENING_POPUP') && (
                    <div className="h-[250px] flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="mt-4 text-slate-600">
                            {status === 'LOADING' ? 'Đang tạo link thanh toán...' : 'Đang mở cửa sổ thanh toán PayOS...'}
                        </p>
                        {status === 'OPENING_POPUP' && (
                            <p className="text-sm text-slate-500 mt-1">Vui lòng kiểm tra pop-up hoặc tab mới.</p>
                        )}
                    </div>
                )}
                
                {/* 2. Trạng thái Chờ thanh toán (Pop-up đã mở/có QR code) */}
                {/* Bao gồm PENDING (đã có link, chờ mở popup) và OPENED (popup đã mở) */}
                {(status === 'PENDING' || status === 'OPENED') && (
                    <>
                        {qrImage ? (
                            <div className="bg-white p-4 rounded-lg inline-block shadow">
                                <img src={qrImage} alt="Mã QR thanh toán" width="256" height="256" className="object-contain" />
                            </div>
                        ) : (
                            <div className="h-[256px] w-[256px] flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg mx-auto">
                                <Loader2 className="animate-spin text-slate-400" size={32} />
                            </div>
                        )}
                        
                        <p className="text-2xl font-bold text-indigo-600 mt-4">
                            {formatCurrency(amount)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            Quét mã QR bằng ứng dụng ngân hàng để thanh toán.
                        </p>
                        {checkoutUrl && (
                            <a
                                href={checkoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline mt-2 inline-block"
                            >
                                Không quét được? Mở link thanh toán.
                            </a>
                        )}
                        <p className="text-sm mt-4 text-slate-500 animate-pulse">Đang chờ xác nhận thanh toán...</p>

                        {/* Nút đóng modal tạm thời nếu người dùng muốn làm việc khác */}
                        <button onClick={onClose} className="btn-secondary mt-4">
                            Đóng (vẫn chờ thanh toán)
                        </button>
                    </>
                )}
                
                {/* 3. Trạng thái Thanh toán thành công */}
                {status === 'PAID' && (
                    <div className="h-[250px] flex flex-col items-center justify-center text-green-600">
                        <CheckCircle size={64} />
                        <p className="mt-4 text-2xl font-bold">Thanh toán thành công!</p>
                        <p className="text-slate-500 mt-2">Đang hoàn tất đơn hàng và in hóa đơn...</p>
                        <button onClick={onClose} className="btn-primary mt-4">
                            Hoàn tất
                        </button>
                    </div>
                )}

                {/* 4. Trạng thái Thanh toán bị hủy / Thất bại */}
                {status === 'CANCELLED' && (
                    <div className="h-[250px] flex flex-col items-center justify-center text-red-500">
                        <X size={64} /> {/* Hoặc AlertTriangle */}
                        <p className="mt-4 text-2xl font-bold">Thanh toán đã hủy</p>
                        <p className="text-slate-500 mt-2">Giao dịch đã bị hủy hoặc thất bại. Vui lòng thử lại.</p>
                        <button onClick={onClose} className="btn-primary mt-4">
                            Đóng
                        </button>
                    </div>
                )}

                {/* 5. Trạng thái Lỗi (Khi có lỗi từ API backend hoặc xử lý) */}
                {status === 'ERROR' && (
                    <div className="h-[250px] flex flex-col items-center justify-center text-red-500">
                        <AlertTriangle size={64} />
                        <p className="mt-4 text-2xl font-bold">Đã xảy ra lỗi!</p>
                        <p className="text-slate-500 mt-2">Không thể tạo hoặc xử lý giao dịch. Vui lòng thử lại.</p>
                        <button onClick={onClose} className="btn-primary mt-4">
                            Đóng
                        </button>
                    </div>
                )}

                {/* Trạng thái EXIT (người dùng đóng pop-up PayOS) có thể được xử lý ngầm,
                    hoặc bạn có thể hiển thị một thông báo khác nếu muốn.
                    Thông thường, ta vẫn chờ PAID/CANCELLED từ webhook.
                */}
            </div>
        </div>
    );
}