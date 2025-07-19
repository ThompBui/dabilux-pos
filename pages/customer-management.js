// pages/customer-management.js
import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore'; // THAY ĐỔI: Sử dụng hook này
import { auth, db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Sidebar from '../components/Sidebar'; // Đảm bảo bạn đã import Sidebar
import {
    Search, Plus, Edit, Trash2, Users, AlertCircle, X, UserPlus
} from 'lucide-react';

// --- CÁC COMPONENT CON (MODAL) ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
                <div className="flex items-center space-x-3 mb-4"><AlertCircle size={24} className="text-orange-500" /><h3 className="text-xl font-semibold">{title}</h3></div>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300">Hủy</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

const CustomerFormModal = ({ customer, onClose, onSave, isOpen }) => {
    const [formData, setFormData] = useState(customer || { name: '', phone: '', points: 0 });
    React.useEffect(() => { setFormData(customer || { name: '', phone: '', points: 0 }); }, [customer, isOpen]);
    if (!isOpen) return null;
    const handleChange = (e) => { const { name, value } = e.target; setFormData({ ...formData, [name]: value }); };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) { alert('Vui lòng điền đủ Tên và SĐT.'); return; }
        await onSave({ ...formData, points: parseInt(formData.points, 10) || 0 });
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-slate-700"><h3 className="text-xl font-semibold">{customer ? 'Chỉnh sửa Khách hàng' : 'Thêm Khách hàng mới'}</h3><button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><X size={24} /></button></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label htmlFor="name" className="block text-sm font-medium mb-1">Tên khách hàng</label><input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div>
                    <div><label htmlFor="phone" className="block text-sm font-medium mb-1">Số điện thoại</label><input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div>
                    <div><label htmlFor="points" className="block text-sm font-medium mb-1">Điểm tích lũy</label><input type="number" id="points" name="points" value={formData.points} onChange={handleChange} className="w-full p-2 border rounded-md" min="0" /></div>
                    <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300">Hủy</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Lưu</button></div>
                </form>
            </div>
        </div>
    );
};


// --- COMPONENT CHÍNH ---
export default function CustomerManagement() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    // THAY ĐỔI: Sử dụng useCollectionData để lấy dữ liệu khách hàng
    const customersQuery = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const [customers, customersLoading, customersError] = useCollectionData(customersQuery, { idField: 'id' });

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToDelete, setCustomerToDelete] = useState(null);

    const filteredCustomers = useMemo(() => {
        // Thêm kiểm tra `customers` để đảm bảo nó là một mảng trước khi lọc
        if (!Array.isArray(customers)) return [];
        if (!searchTerm) return customers;

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return customers.filter(customer =>
            customer.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
            customer.phone?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [customers, searchTerm]);

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading, router]);

    const handleAddCustomer = useCallback(async (newCustomer) => {
        await addDoc(collection(db, 'customers'), { ...newCustomer, createdAt: serverTimestamp() });
    }, []);

    const handleEditCustomer = useCallback(async (updatedCustomer) => {
        if (!updatedCustomer.id) return;
        const customerRef = doc(db, 'customers', updatedCustomer.id);
        await updateDoc(customerRef, { ...updatedCustomer, updatedAt: serverTimestamp() });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (customerToDelete) {
            await deleteDoc(doc(db, 'customers', customerToDelete));
            setCustomerToDelete(null);
            setIsConfirmModalOpen(false);
        }
    }, [customerToDelete]);
    
    const openAddModal = () => { setSelectedCustomer(null); setIsFormModalOpen(true); };
    const openEditModal = (customer) => { setSelectedCustomer(customer); setIsFormModalOpen(true); };
    const openDeleteModal = (id) => { setCustomerToDelete(id); setIsConfirmModalOpen(true); };

    if (authLoading || customersLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><p>Đang tải dữ liệu khách hàng...</p></div>;
    }

    if (customersError) {
        return <div className="flex items-center justify-center h-screen text-red-500"><p>Lỗi tải dữ liệu: {customersError.message}</p></div>;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header>
                    <h1 className="text-3xl font-bold">Quản lý Khách hàng</h1>
                    <p className="text-slate-500 mt-1">Thêm, sửa, và tìm kiếm thông tin khách hàng.</p>
                </header>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-auto md:flex-grow">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm khách hàng theo tên hoặc SĐT..."
                                className="w-full max-w-md pl-10 pr-4 py-2 border rounded-lg bg-slate-50 dark:bg-slate-700"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={openAddModal} className="btn-action bg-indigo-600 text-white w-full md:w-auto">
                            <UserPlus size={18} />
                            <span>Thêm khách hàng</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Tên khách hàng</th>
                                    <th className="px-4 py-3 font-semibold">Số điện thoại</th>
                                    <th className="px-4 py-3 font-semibold text-center">Điểm</th>
                                    <th className="px-4 py-3 font-semibold text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 font-medium">{customer.name}</td>
                                            <td className="px-4 py-3 text-slate-500">{customer.phone}</td>
                                            <td className="px-4 py-3 text-center font-semibold">{customer.points}</td>
                                            <td className="px-4 py-3 flex justify-center items-center space-x-2">
                                                <button onClick={() => openEditModal(customer)} className="p-2 rounded-full text-blue-600 hover:bg-blue-100" title="Chỉnh sửa"><Edit size={18} /></button>
                                                <button onClick={() => openDeleteModal(customer.id)} className="p-2 rounded-full text-red-600 hover:bg-red-100" title="Xóa"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-400">Không tìm thấy khách hàng nào.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            <CustomerFormModal isOpen={isFormModalOpen} customer={selectedCustomer} onClose={() => setIsFormModalOpen(false)} onSave={selectedCustomer ? handleEditCustomer : handleAddCustomer} />
            <ConfirmModal isOpen={isConfirmModalOpen} title="Xác nhận xóa" message="Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác." onConfirm={confirmDelete} onCancel={() => setIsConfirmModalOpen(false)} />
        </div>
    );
}