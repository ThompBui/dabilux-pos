// pages/dashboard.js
import dynamic from 'next/dynamic';
import React from 'react';

// Import động component và vô hiệu hóa server-side rendering (SSR)
const DashboardClient = dynamic(
  () => import('../components/DashboardContent'), // Đường dẫn đến tệp mới
  {
    ssr: false, // Rất quan trọng: không render ở phía server
    loading: () => <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"><p>Đang tải...</p></div> // Hiển thị trạng thái tải
  }
);

export default function Dashboard() {
  return <DashboardClient />;
}