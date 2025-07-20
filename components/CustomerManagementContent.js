import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, limit, getDocs, startAfter } from 'firebase/firestore';
import Sidebar from './Sidebar';
import { Search, Edit, Trash2, Users, AlertCircle, X, UserPlus, Loader2 } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle size={24} className="text-orange-500" />
                    <h3 className="text-xl font-semibold">{title}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="btn-secondary">Hủy</button>
                    <button onClick={onConfirm} className="btn-danger">Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

const CustomerFormModal = ({ customer, onClose, onSave, isOpen }) => {
    const [formData, setFormData] = useState({ name: '', phone: '', points: 0 });
    
    useEffect(() => {
        if (isOpen) {
            setFormData(customer || { name: '', phone: '', points: 0 });
        }
    }, [customer, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            alert('Vui lòng điền đủ Tên và SĐT.');
            return;
        }
        await onSave({ ...formData, points: parseInt(formData.points, 10) || 0 });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-semibold">{customer ? 'Chỉnh sửa Khách hàng' : 'Thêm Khách hàng mới'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">Tên khách hàng</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="input-field" required />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium mb-1">Số điện thoại</label>
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="input-field" required />
                    </div>
                    <div>
                        <label htmlFor="points" className="block text-sm font-medium mb-1">Điểm tích lũy</label>
                        <input type="number" id="points" name="points" value={formData.points} onChange={handleChange} className="input-field" min="0" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                        <button type="submit" className="btn-primary">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default function CustomerManagementContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);

    // State cho phân trang
    const [lastVisible, setLastVisible] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToDelete, setCustomerToDelete] = useState(null);

    // Tải dữ liệu ban đầu
    useEffect(() => {
        if (!user) return;
        const fetchInitialCustomers = async () => {
            setCustomersLoading(true);
            try {
                const customersRef = collection(db, 'customers');
                const q = query(customersRef, orderBy('name', 'asc'), limit(25));

                const documentSnapshots = await getDocs(q);
                const customersData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setCustomers(customersData);
                const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
                setLastVisible(lastDoc);
                
                if (documentSnapshots.docs.length < 25) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            } catch(error) {
                console.error("Lỗi khi tải danh sách khách hàng:", error);
            } finally {
                setCustomersLoading(false);
            }
        };
        fetchInitialCustomers();
    }, [user]);

    // Tải thêm dữ liệu
    const fetchMoreCustomers = async () => {
        if (!hasMore || loadingMore || !lastVisible) return;
        setLoadingMore(true);
        try {
            const customersRef = collection(db, 'customers');
            const q = query(customersRef, orderBy('name', 'asc'), startAfter(lastVisible), limit(25));
            
            const documentSnapshots = await getDocs(q);
            const newCustomersData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setCustomers(prev => [...prev, ...newCustomersData]);
            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            setLastVisible(lastDoc);

            if (documentSnapshots.docs.length < 25) {
                setHasMore(false);
            }
        } catch(error) {
            console.error("Lỗi khi tải thêm khách hàng:", error);
        } finally {
            setLoadingMore(false);
        }
    };
    
    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return customers.filter(customer =>
            customer.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
            customer.phone?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [customers, searchTerm]);

    const handleAddCustomer = useCallback(async (newCustomer) => {
        await addDoc(collection(db, 'customers'), { ...newCustomer, createdAt: serverTimestamp() });
        // Optional: Refresh list after adding
    }, []);

    const handleEditCustomer = useCallback(async (updatedCustomer) => {
        if (!updatedCustomer.id) return;
        const customerRef = doc(db, 'customers', updatedCustomer.id);
        await updateDoc(customerRef, { ...updatedCustomer, updatedAt: serverTimestamp() });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (customerToDelete) {
            await deleteDoc(doc(db, 'customers', customerToDelete.id));
            setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
            setCustomerToDelete(null);
            setIsConfirmModalOpen(false);
        }
    }, [customerToDelete]);
    
    const openAddModal = () => { setSelectedCustomer(null); setIsFormModalOpen(true); };
    const openEditModal = (customer) => { setSelectedCustomer(customer); setIsFormModalOpen(true); };
    const openDeleteModal = (customer) => { setCustomerToDelete(customer); setIsConfirmModalOpen(true); };

    if (authLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><p>Đang tải...</p></div>;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header>
                    <h1 className="text-3xl font-bold">Quản lý Khách hàng</h1>
                    <p className="text-slate-500 mt-1">Thêm, sửa, và tìm kiếm thông tin khách hàng.</p>
                </header>
                <section className="card mt-8">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full md:flex-grow">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm khách hàng theo tên hoặc SĐT..."
                                className="input-field w-full max-w-md pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
        onClick={openAddModal} 
        className="btn-primary w-full md:w-auto flex-shrink-0"
    >
        <UserPlus size={18} />
        <span>Thêm khách hàng</span>
    </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                            <thead className="table-header">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-left">Tên khách hàng</th>
                                    <th className="px-4 py-3 font-semibold text-left">Số điện thoại</th>
                                    <th className="px-4 py-3 font-semibold text-center">Điểm</th>
                                    <th className="px-4 py-3 font-semibold text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {customersLoading ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-500">Đang tải danh sách khách hàng...</td></tr>
                                ) : filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <tr key={customer.id} className="table-row">
                                            <td className="px-4 py-3 font-medium">{customer.name}</td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{customer.phone}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">{customer.points}</td>
                                            <td className="px-4 py-3 flex justify-center items-center space-x-2">
                                                <button onClick={() => openEditModal(customer)} className="btn-icon-edit" title="Chỉnh sửa"><Edit size={18} /></button>
                                                <button onClick={() => openDeleteModal(customer)} className="btn-icon-delete" title="Xóa"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-500">Không tìm thấy khách hàng nào.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                     {hasMore && (
                        <div className="p-4 flex justify-center border-t border-slate-200 dark:border-slate-700">
                            <button onClick={fetchMoreCustomers} disabled={loadingMore} className="btn-action-outline disabled:opacity-50">
                                {loadingMore ? <><Loader2 className="animate-spin" size={18}/> Đang tải...</> : 'Tải thêm'}
                            </button>
                        </div>
                    )}
                </section>
            </main>

            <CustomerFormModal isOpen={isFormModalOpen} customer={selectedCustomer} onClose={() => setIsFormModalOpen(false)} onSave={selectedCustomer ? handleEditCustomer : handleAddCustomer} />
            <ConfirmModal isOpen={isConfirmModalOpen} title="Xác nhận xóa" message="Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác." onConfirm={confirmDelete} onCancel={() => setIsConfirmModalOpen(false)} />
        </div>
    );
}