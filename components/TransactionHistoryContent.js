import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Sidebar from './Sidebar'; // Import Sidebar
import { Search, Eye, Calendar, X } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
    if (!isOpen || !transaction) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-xl font-semibold">Chi tiết Hóa đơn: {transaction.id}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                {/* Modal content here */}
                <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="btn-primary">Đóng</button>
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
    const [billsError, setBillsError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const filteredBills = useMemo(() => {
        if (!bills) return [];
        return bills.filter(bill => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const customerName = bill.customer?.name?.toLowerCase() || '';
            const createdBy = bill.createdBy?.toLowerCase() || '';
            let dateInRange = true;
            if(startDate) dateInRange = (bill.createdAt?.toDate() || new Date(bill.createdAt)) >= new Date(startDate);
            if(endDate) {
                 const end = new Date(endDate);
                 end.setHours(23,59,59,999);
                 dateInRange = dateInRange && (bill.createdAt?.toDate() || new Date(bill.createdAt)) <= end;
            }
            return (customerName.includes(lowerCaseSearchTerm) || createdBy.includes(lowerCaseSearchTerm)) && dateInRange;
        });
    }, [bills, searchTerm, startDate, endDate]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setBillsLoading(false);
        }, (error) => {
            setBillsError(error);
            setBillsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const openDetailModal = (bill) => {
        setSelectedTransaction(bill);
        setIsDetailModalOpen(true);
    };
    
    if (authLoading || billsLoading) {
        return <div className="flex items-center justify-center h-screen"><p>Đang tải...</p></div>;
    }
    if (billsError) {
        return <div className="flex items-center justify-center h-screen text-red-500"><p>Lỗi: {billsError.message}</p></div>;
    }
    if (!user) return null;

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold">Lịch sử Giao dịch</h1>
                </header>

                <section className="card">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo khách hàng hoặc thu ngân..."
                                className="input-field w-full pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex space-x-4 w-full md:w-auto">
                            <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="table-header">
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
                                {filteredBills.map(bill => (
                                    <tr key={bill.id} className="table-row">
                                        <td className="px-4 py-3 font-medium truncate max-w-xs">{bill.id}</td>
                                        <td className="px-4 py-3">{new Date(bill.createdAt?.toDate()).toLocaleString('vi-VN')}</td>
                                        <td className="px-4 py-3">{bill.customer?.name || 'Khách lẻ'}</td>
                                        <td className="px-4 py-3">{bill.createdBy}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(bill.totalAfterDiscount)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => openDetailModal(bill)} className="btn-icon-edit" title="Xem chi tiết"><Eye size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
            <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} transaction={selectedTransaction} />
        </div>
    );
}