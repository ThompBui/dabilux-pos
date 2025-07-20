import dynamic from 'next/dynamic';
import React from 'react';

// Import động component nội dung và vô hiệu hóa render phía server
const TransactionHistoryContent = dynamic(
  () => import('../components/TransactionHistoryContent'),
  {
    ssr: false, // Quan trọng: không render ở server
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
        <p className="text-lg font-semibold">Đang tải lịch sử giao dịch...</p>
      </div>
    ),
  }
);

export default function TransactionHistoryPage() {
  return <TransactionHistoryContent />;
}