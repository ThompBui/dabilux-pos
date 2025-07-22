import React, { useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function ReceiptModal({ show, onClose, data }) {
    useEffect(() => {
        if (!show) return;
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, show]);

    const handlePrint = () => {
        const printContent = document.getElementById('receipt-content');
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert('Vui lòng cho phép pop-ups để in hóa đơn.');
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Hóa đơn</title>
                    <style>
                        body { font-family: 'monospace', sans-serif; margin: 0; padding: 1rem; color: #000; font-size: 14px; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .text-xl { font-size: 1.25rem; }
                        .text-2xl { font-size: 1.5rem; }
                        .mt-4 { margin-top: 1rem; }
                        .mb-4 { margin-bottom: 1rem; }
                        .mb-6 { margin-bottom: 1.5rem; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 0.5rem 0; }
                        .border-b { border-bottom: 1px dashed #999; }
                        .text-right { text-align: right; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
    };

    if (!show || !data) return null;

    // Convert Firestore Timestamp to Date if necessary
    const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm m-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <div id="receipt-content" className="p-6 text-black">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold">{data.storeInfo?.name || 'BuiAnh POS'}</h2>
                        <p className="text-sm">{data.storeInfo?.address || '123 Đường ABC, Từ Sơn, Bắc Ninh'}</p>
                        <h3 className="text-xl font-bold mt-4">HÓA ĐƠN BÁN LẺ</h3>
                    </div>
                    <div className="text-sm mb-4">
                        <p>Ngày: {createdAtDate.toLocaleString('vi-VN')}</p>
                        <p>Thu ngân: {data.createdBy}</p>
                        {data.customer && <p>Khách hàng: {data.customer.name} ({data.customer.phone})</p>}
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b">
                                <th className="py-2">Tên SP</th>
                                <th className="py-2 text-center">SL</th>
                                <th className="py-2 text-right">T.Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, index) => (
                                <tr key={index} className="border-b">
                                    <td className="py-2">{item.name}</td>
                                    <td className="py-2 text-center">{item.quantity}</td>
                                    <td className="py-2 text-right">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 text-sm">
                        <div className="flex justify-between">
                            <p>Tổng tiền hàng:</p>
                            <p className="font-semibold">{formatCurrency(data.subtotal)}</p>
                        </div>
                        <div className="flex justify-between">
                            <p>VAT (10%):</p>
                            <p className="font-semibold">{formatCurrency(data.tax)}</p>
                        </div>
                        {data.discountAmount > 0 && (
                            <div className="flex justify-between text-red-500">
                                <p>Giảm giá từ điểm:</p>
                                <p className="font-semibold">- {formatCurrency(data.discountAmount)}</p>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg mt-2 border-t pt-2">
                            <p>TỔNG CỘNG:</p>
                            <p>{formatCurrency(data.totalAfterDiscount)}</p>
                        </div>
                        {data.pointsEarned > 0 && (
                            <div className="flex justify-between text-sm mt-2">
                                <p>Điểm tích lũy:</p>
                                <p className="font-semibold">{data.pointsEarned}</p>
                            </div>
                        )}
                        {data.customer && data.customer.points !== undefined && (
                             <div className="flex justify-between text-sm">
                                <p>Tổng điểm sau GD:</p>
                                <p className="font-semibold">{data.customer.points}</p>
                            </div>
                        )}
                    </div>
                    <div className="text-center mt-6 text-sm">
                        <p>Cảm ơn quý khách!</p>
                    </div>
                </div>
                <div className="p-4 bg-gray-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 btn-action-outline">Đóng</button>
                    <button onClick={handlePrint} className="flex-1 btn-action bg-indigo-600 text-white">In hóa đơn</button>
                </div>
            </div>
        </div>
    );
};