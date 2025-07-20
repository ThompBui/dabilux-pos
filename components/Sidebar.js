import React, { useState } from 'react';
import Link from 'next/link'; // BƯỚC 1: Import Link
import { useRouter } from 'next/router';
import { auth } from '../firebase';
import {
    Home, BarChart2, Settings, Users, ShoppingBag, FileText, LogOut, Box, ShoppingCart,
    Headset, X
} from 'lucide-react';

const SupportModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm relative">
                <button 
                    onClick={onClose} 
                    className="absolute top-3 right-3 p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-4">
                        <Headset size={32} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Thông tin Hỗ trợ</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                        Khi gặp sự cố hoặc cần tư vấn, vui lòng liên hệ:
                    </p>
                    <div className="text-left bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg w-full">
                        <p className="font-semibold">Đơn vị phát triển:</p>
                        <p className="text-lg text-indigo-600 dark:text-indigo-400 font-bold mb-2">Bùi Anh</p>
                        <p className="font-semibold">SĐT (Zalo) Hỗ trợ:</p>
                        <a href="tel:0374686626" className="text-lg text-indigo-600 dark:text-indigo-400 font-bold hover:underline">0374.686.626</a>
                    </div>
                    <button 
                        onClick={onClose}
                        className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
    );
};


const NavLink = ({ href, icon, label }) => {
    const router = useRouter();
    const isActive = router.pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isActive 
                ? 'bg-indigo-600 text-white font-semibold shadow-md' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
        >
            {icon} {label}
        </Link>
    );
};

export default function Sidebar() {
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    
    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.push('/login'); // Chuyển hướng về trang login sau khi đăng xuất
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
        }
    };

    const router = useRouter(); // Lấy router để dùng trong handleLogout

    return (
        <>
            <aside className="w-64 bg-white dark:bg-slate-800 p-6 shadow-lg fixed h-full border-r border-slate-200 dark:border-slate-700 z-30 flex flex-col">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-10">
                    BuiAnh POS
                </div>
                <nav className="space-y-3 flex-grow">
                    <NavLink href="/dashboard" icon={<Home size={20} />} label="Tổng quan" />
                    <NavLink href="/inventory-receipt" icon={<Box size={20} />} label="Nhập kho" />
                    <NavLink href="/product-management" icon={<ShoppingBag size={20} />} label="Quản lý sản phẩm" />
                    <NavLink href="/customer-management" icon={<Users size={20} />} label="Quản lý khách hàng" />
                    <NavLink href="/transaction-history" icon={<FileText size={20} />} label="Lịch sử giao dịch" />
                    <NavLink href="/analytics" icon={<BarChart2 size={20} />} label="Phân tích" />
                    <NavLink href="/settings" icon={<Settings size={20} />} label="Cài đặt" />
                    <NavLink href="/" icon={<ShoppingCart size={20} />} label="Bán hàng" />
                </nav>
                <div className="mt-auto border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                    <button 
                        onClick={() => setIsSupportModalOpen(true)}
                        className="flex items-center gap-3 p-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 w-full text-left transition-colors"
                    >
                        <Headset size={20} /> Hỗ trợ
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-3 p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 w-full text-left transition-colors"
                    >
                        <LogOut size={20} /> Đăng xuất
                    </button>
                </div>
            </aside>
             
            <SupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} />
        </>
    );
}