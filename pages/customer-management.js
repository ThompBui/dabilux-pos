// pages/customer-management.js
import dynamic from 'next/dynamic';
import React from 'react'; // Import React cho phần fallback div

// Import động component và vô hiệu hóa server-side rendering (SSR) cho nó
const CustomerManagementClient = dynamic(
  () => import('../components/CustomerManagementContent'),
  { ssr: false } // Đây là điểm mấu chốt: yêu cầu Next.js KHÔNG render component này ở phía máy chủ
);

export default function CustomerManagement() {
  return <CustomerManagementClient />;
}