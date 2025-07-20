import dynamic from 'next/dynamic';
import React from 'react';

// Import động component nội dung và vô hiệu hóa render phía server
const InventoryReceiptContent = dynamic(
  () => import('../components/InventoryReceiptContent'),
  {
    ssr: false, // Quan trọng: không render ở server
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
        <p className="text-lg font-semibold">Đang tải trang nhập kho...</p>
      </div>
    ),
  }
);

export default function InventoryReceiptPage() {
  return <InventoryReceiptContent />;
}