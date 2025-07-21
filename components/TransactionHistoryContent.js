import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import Sidebar from './Sidebar';
import { Search, Eye, Calendar, X, Loader2 } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
    if (!isOpen || !transaction) return null;

    const createdAtDate = transaction.createdAt?.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-semibold">Chi tiết Hóa đơn</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20} /></button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                        <div>
                            <p><span className="font-semibold text-slate-500">Mã HĐ:</span> {transaction.id}</p>
                            <p><span className="font-semibold text-slate-500">Ngày:</span> {createdAtDate.toLocaleString('vi-VN')}</p>
                            <p><span className="font-semibold text-slate-500">Thu ngân:</span> {transaction.createdBy}</p>
                        </div>
                        <div>
                            {transaction.customer ? (
                                <>
                                    <p><span className="font-semibold text-slate-500">Khách hàng:</span> {transaction.customer.name}</p>
                                    <p><span className="font-semibold text-slate-500">Điện thoại:</span> {transaction.customer.phone}</p>
                                </>
                            ) : (
                                <p><span className="font-semibold text-slate-500">Khách hàng:</span> Khách lẻ</p>
                            )}
                        </div>
                    </div>

                    <h4 className="font-semibold text-md mb-2">Sản phẩm đã mua:</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                            <thead className="table-header">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Tên SP</th>
                                    <th className="px-4 py-2 font-semibold text-center">SL</th>
                                    <th className="px-4 py-2 font-semibold text-right">Đơn giá</th>
                                    <th className="px-4 py-2 font-semibold text-right">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {transaction.items.map((item, index) => (
                                    <tr key={item.id || index}>
                                        <td className="px-4 py-2 font-medium">{item.name}</td>
                                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 text-right space-y-2 text-sm">
                        <div className="flex justify-end gap-4"><span className="text-slate-500">Tổng tiền hàng:</span> <span className="w-32 text-left font-medium">{formatCurrency(transaction.subtotal)}</span></div>
                        <div className="flex justify-end gap-4"><span className="text-slate-500">VAT (10%):</span> <span className="w-32 text-left font-medium">{formatCurrency(transaction.tax)}</span></div>
                        {transaction.discountAmount > 0 && <div className="flex justify-end gap-4 text-red-500"><span className="">Giảm giá (điểm):</span> <span className="w-32 text-left font-medium">- {formatCurrency(transaction.discountAmount)}</span></div>}
                        <div className="flex justify-end gap-4 text-lg font-bold"><span className="">TỔNG CỘNG:</span> <span className="w-32 text-left text-indigo-600 dark:text-indigo-400">{formatCurrency(transaction.totalAfterDiscount)}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function TransactionHistoryContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    
    const [bills, setBills] = useState([]);
    const [billsLoading, setBillsLoading] = useState(true);
    
    // State cho phân trang
    const [lastVisible, setLastVisible] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // State cho việc lọc
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // State cho modal
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Tải dữ liệu ban đầu
    useEffect(() => {
        if (!user) return;

        const fetchInitialBills = async () => {
            setBillsLoading(true);
            try {
                const billsRef = collection(db, 'bills');
                const q = query(billsRef, orderBy('createdAt', 'desc'), limit(25));
                
                const documentSnapshots = await getDocs(q);
                const billsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                setBills(billsData);
                const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length-1];
                setLastVisible(lastDoc);

                if (documentSnapshots.docs.length < 25) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            } catch (error) {
                console.error("Lỗi khi tải lịch sử giao dịch:", error);
            } finally {
                setBillsLoading(false);
            }
        };

        fetchInitialBills();
    }, [user]);

    // Tải thêm dữ liệu
    const fetchMoreBills = async () => {
        if (!hasMore || loadingMore || !lastVisible) return;
        setLoadingMore(true);
        try {
            const billsRef = collection(db, 'bills');
            const q = query(billsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(25));

            const documentSnapshots = await getDocs(q);
            const newBillsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            setBills(prevBills => [...prevBills, ...newBillsData]);
            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length-1];
            setLastVisible(lastDoc);

            if (documentSnapshots.docs.length < 25) {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Lỗi khi tải thêm giao dịch:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Lọc trên dữ liệu đã tải
    const filteredBills = useMemo(() => {
        return bills.filter(bill => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const customerName = bill.customer?.name?.toLowerCase() || '';
            const createdBy = bill.createdBy?.toLowerCase() || '';
            let dateInRange = true;
            const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                dateInRange = billDate >= start;
            }
            if (endDate) {
                 const end = new Date(endDate);
                 end.setHours(23, 59, 59, 999);
                 dateInRange = dateInRange && billDate <= end;
            }
            return (customerName.includes(lowerCaseSearchTerm) || createdBy.includes(lowerCaseSearchTerm)) && dateInRange;
        });
    }, [bills, searchTerm, startDate, endDate]);
    
    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

    if (authLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><p>Đang tải...</p></div>;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header><h1 className="text-3xl font-bold mb-8">Lịch sử Giao dịch</h1></header>
                <section className="card">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full md:flex-grow">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên khách hàng, thu ngân..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-field w-full pl-10"
                            />
                        </div>
                        <div className="flex w-full md:w-auto gap-4">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="table-header">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-left">Mã HĐ</th>
                                    <th className="px-4 py-3 font-semibold text-left">Ngày</th>
                                    <th className="px-4 py-3 font-semibold text-left">Khách hàng</th>
                                    <th className="px-4 py-3 font-semibold text-left">Thu ngân</th>
                                    <th className="px-4 py-3 font-semibold text-right">Tổng tiền</th>
                                    <th className="px-4 py-3 font-semibold text-center">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {billsLoading ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Đang tải dữ liệu...</td></tr>
                                ) : filteredBills.length > 0 ? (
                                    filteredBills.map(bill => (
                                        <tr key={bill.id} className="table-row">
                                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">{bill.id}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{new Date(bill.createdAt?.toDate()).toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3">{bill.customer?.name || 'Khách lẻ'}</td>
                                            <td className="px-4 py-3">{bill.createdBy}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(bill.totalAfterDiscount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => { setSelectedTransaction(bill); setIsDetailModalOpen(true); }} className="btn-icon-edit" title="Xem chi tiết">
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Không tìm thấy giao dịch nào.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div className="p-4 flex justify-center border-t border-slate-200 dark:border-slate-700">
                            <button onClick={fetchMoreBills} disabled={loadingMore} className="btn-action-outline disabled:opacity-50">
                                {loadingMore ? <><Loader2 className="animate-spin" size={18}/> Đang tải...</> : 'Tải thêm'}
                            </button>
                        </div>
                    )}
                </section>
            </main>
            <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} transaction={selectedTransaction} />
        </div>
    );
}