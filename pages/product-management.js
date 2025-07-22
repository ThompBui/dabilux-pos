// pages/product-management.js
import dynamic from 'next/dynamic';
import React from 'react';

const ProductManagementClient = dynamic(
  () => import('../components/ProductManagementContent'),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"><p>Đang tải...</p></div>
  }
);

export default function ProductManagement() {
  return <ProductManagementClient />;
}