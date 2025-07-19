// pages/transaction-history.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase'; // Đảm bảo đường dẫn đúng đến file firebase của bạn
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

import {
    Search, Home, BarChart2, Settings, Users, ShoppingBag, FileText, LogOut,
    Eye, Calendar ,ShoppingCart , X// Added Eye and Calendar icons
} from 'lucide-react';

// --- UTILITY & SUB-COMPONENTS ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Component: TransactionDetailModal (New for detailed view)
const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
    if (!isOpen || !transaction) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100">Chi tiết Hóa đơn: {transaction.id}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                        <X size={24} />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                    <div>
                        <p><span className="font-semibold">Ngày:</span> {new Date(transaction.createdAt?.toDate ? transaction.createdAt.toDate() : transaction.createdAt).toLocaleString('vi-VN')}</p>
                        <p><span className="font-semibold">Thu ngân:</span> {transaction.createdBy}</p>
                        {transaction.customer && (
                            <>
                                <p><span className="font-semibold">Khách hàng:</span> {transaction.customer.name}</p>
                                <p><span className="font-semibold">SĐT:</span> {transaction.customer.phone}</p>
                                <p><span className="font-semibold">Điểm cuối:</span> {transaction.customer.points}</p>
                            </>
                        )}
                    </div>
                    <div>
                        <p><span className="font-semibold">Tổng tiền hàng:</span> {formatCurrency(transaction.subtotal)}</p>
                        <p><span className="font-semibold">VAT:</span> {formatCurrency(transaction.tax)}</p>
                        {transaction.discountAmount > 0 && (
                            <p className="text-red-500"><span className="font-semibold">Giảm giá:</span> - {formatCurrency(transaction.discountAmount)}</p>
                        )}
                        <p className="font-bold text-lg"><span className="font-semibold">TỔNG CỘNG:</span> {formatCurrency(transaction.totalAfterDiscount)}</p>
                        <p><span className="font-semibold">Phương thức:</span> {transaction.paymentMethod}</p>
                        <p><span className="font-semibold">Điểm tích lũy:</span> {transaction.pointsEarned}</p>
                        <p><span className="font-semibold">Điểm đã dùng:</span> {transaction.pointsUsed}</p>
                    </div>
                </div>

                <h4 className="font-semibold text-lg mb-3 text-gray-800 dark:text-slate-100">Sản phẩm:</h4>
                <div className="overflow-x-auto max-h-60 mb-4">
                    <table className="min-w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-4 py-2">Tên SP</th>
                                <th className="px-4 py-2 text-center">SL</th>
                                <th className="px-4 py-2 text-right">Đơn giá</th>
                                <th className="px-4 py-2 text-right">T.Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transaction.items.map((item, index) => (
                                <tr key={item.id || index} className="border-b last:border-b-0 border-slate-200 dark:border-slate-700">
                                    <td className="px-4 py-2 font-medium">{item.name}</td>
                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Đóng</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN TRANSACTION HISTORY COMPONENT ---
export default function TransactionHistory() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    // State for bills data
    const [bills, setBills] = useState([]);
    const [billsLoading, setBillsLoading] = useState(true);
    const [billsError, setBillsError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Filter transactions based on search term and date range
    const filteredBills = useMemo(() => {
        if (!bills) return [];

        let currentFiltered = bills.filter(bill => {
            const customerName = bill.customer?.name ? String(bill.customer.name).toLowerCase() : '';
            const customerPhone = bill.customer?.phone ? String(bill.customer.phone).toLowerCase() : '';
            const createdBy = bill.createdBy ? String(bill.createdBy).toLowerCase() : '';
            const lowerCaseSearchTerm = searchTerm.toLowerCase();

            return customerName.includes(lowerCaseSearchTerm) ||
                   customerPhone.includes(lowerCaseSearchTerm) ||
                   createdBy.includes(lowerCaseSearchTerm);
        });

        if (startDate) {
            const start = new Date(startDate);
            currentFiltered = currentFiltered.filter(bill => {
                const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
                return billDate >= start;
            });
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Set to end of day
            currentFiltered = currentFiltered.filter(bill => {
                const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
                return billDate <= end;
            });
        }

        return currentFiltered;
    }, [bills, searchTerm, startDate, endDate]);

    // Authentication check
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lắng nghe dữ liệu hóa đơn từ Firestore bằng onSnapshot
    useEffect(() => {
        const billsColRef = collection(db, 'bills');
        const billsQueryOrdered = query(billsColRef, orderBy('createdAt', 'desc')); // Order by latest transaction

        const unsubscribe = onSnapshot(billsQueryOrdered, (snapshot) => {
            const billsData = snapshot.docs.map(doc => ({
                id: doc.id, // Explicitly get Document ID
                ...doc.data()
            }));
            setBills(billsData);
            setBillsLoading(false);
            console.log("--- BILLS LOADED FROM FIRESTORE (onSnapshot) ---");
            billsData.forEach((bill, index) => {
                console.log(`Bill ${index + 1}:`);
                console.log(bill);
                console.log(`  ID: ${bill.id}, Total: ${bill.totalAfterDiscount}, Customer: ${bill.customer?.name || 'N/A'}`);
            });
        }, (error) => {
            console.error("Error fetching bills:", error);
            setBillsError(error);
            setBillsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, []); // Runs once on mount

    const openDetailModal = (bill) => {
        setSelectedTransaction(bill);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setSelectedTransaction(null);
        setIsDetailModalOpen(false);
    };

    const handleLogout = useCallback(async () => {
        try {
            await auth.signOut();
            console.log("Đã đăng xuất thành công.");
            router.push('/login');
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
        }
    }, [auth, router]);

    // Show loading state
    if (authLoading || billsLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <p className="text-lg font-semibold">Đang tải lịch sử giao dịch...</p>
            </div>
        );
    }

    if (billsError) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-red-500">
                <p className="text-lg font-semibold">Lỗi tải dữ liệu: {billsError.message}</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            {/* Sidebar (Thanh điều hướng bên trái) */}
            <aside className="w-64 bg-white dark:bg-slate-800 p-6 shadow-lg fixed h-full border-r border-slate-200 dark:border-slate-700 z-30">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-8">BuiAnh POS</div>
                <nav className="space-y-4">
    <a href="/dashboard" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
        <Home size={20} /> Tổng quan
    </a>
   
    <a href="/product-management" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
        <ShoppingBag size={20} /> Quản lý sản phẩm
    </a>
    <a href="/customer-management" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
        <Users size={20} /> Quản lý khách hàng
    </a>
    <a href="/transaction-history" className="flex items-center gap-3 p-3 rounded-lg bg-indigo-500 text-white font-semibold">
        <FileText size={20} /> Lịch sử giao dịch
    </a >
    <a href="/analytics" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"> {/* Thêm dòng này */}
        <BarChart2 size={20} /> Phân tích
    </a>
    <a href="/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"> {/* Thêm dòng này */}
        <Settings size={20} /> Cài đặt
    </a>
    <button onClick={() => auth.signOut()} className="flex items-center gap-3 p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 w-full text-left">
        <LogOut size={20} /> Đăng xuất
    </button>
</nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 ml-64 p-8">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Lịch sử Giao dịch</h1>
                    <div className="flex items-center space-x-4">
                        {/* Có thể thêm các nút hành động khác ở đây nếu cần */}
                    </div>
                </header>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
                        <div className="relative flex-1 w-full">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo khách hàng, SĐT hoặc thu ngân..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex space-x-4 w-full md:w-auto">
                            <div className="relative flex-1">
                                <Calendar size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition-colors"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="relative flex-1">
                                <Calendar size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition-colors"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3">Mã HĐ</th>
                                    <th className="px-4 py-3">Ngày</th>
                                    <th className="px-4 py-3">Khách hàng</th>
                                    <th className="px-4 py-3">Thu ngân</th>
                                    <th className="px-4 py-3 text-right">Tổng tiền</th>
                                    <th className="px-4 py-3 text-center">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBills.length > 0 ? (
                                    filteredBills.map(bill => (
                                        <tr key={bill.id} className="border-b last:border-b-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-3 font-medium truncate max-w-[120px]">{bill.id}</td>
                                            <td className="px-4 py-3">{new Date(bill.createdAt?.toDate ? bill.createdAt.toDate() : bill.createdAt).toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3">{bill.customer?.name || 'Khách lẻ'}</td>
                                            <td className="px-4 py-3">{bill.createdBy}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(bill.totalAfterDiscount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => openDetailModal(bill)}
                                                    className="p-2 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-400">
                                            Không tìm thấy giao dịch nào.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                isOpen={isDetailModalOpen}
                onClose={closeDetailModal}
                transaction={selectedTransaction}
            />
        </div>
    );
}
