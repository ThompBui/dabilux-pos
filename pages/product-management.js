// pages/product-management.js
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Sidebar from '../components/Sidebar';
import { Search, Archive, ArchiveRestore, CheckCircle } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

export default function ProductManagement() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        // Lọc dựa trên trạng thái "showArchived"
        const visibleProducts = products.filter(p => {
            // Nếu showArchived là true, hiển thị tất cả. Nếu false, chỉ hiển thị những sản phẩm có isActive không phải là false.
            if (showArchived) return true;
            return p.isActive !== false;
        });

        if (!searchTerm) return visibleProducts;
        
        return visibleProducts.filter(product =>
            product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm, showArchived]);

    useEffect(() => {
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setProductsLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

    const showToast = (message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 2500);
    };

    const handlePriceChange = async (productId, newPrice) => {
        const priceValue = parseFloat(newPrice);
        if (isNaN(priceValue) || priceValue < 0) {
            showToast("Giá bán không hợp lệ.");
            // Tùy chọn: reset lại giá trị input về giá cũ
            return;
        }

        const productRef = doc(db, 'products', productId);
        try {
            await updateDoc(productRef, { price: priceValue });
            showToast("Cập nhật giá bán thành công!");
        } catch (error) {
            console.error("Lỗi cập nhật giá:", error);
            showToast("Lỗi: Không thể cập nhật giá.");
        }
    };

    const handleToggleArchive = async (productId, currentStatus) => {
        const productRef = doc(db, 'products', productId);
        const newStatus = currentStatus === false ? true : false;
        try {
            await updateDoc(productRef, { isActive: newStatus });
            showToast(newStatus ? "Khôi phục sản phẩm thành công!" : "Ẩn sản phẩm thành công!");
        } catch (error) {
            console.error("Lỗi khi cập nhật trạng thái:", error);
            showToast("Lỗi: Không thể cập nhật trạng thái.");
        }
    };
    
    if (authLoading || productsLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><p>Đang tải dữ liệu sản phẩm...</p></div>;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Quản lý Sản phẩm</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Xem, tìm kiếm, điều chỉnh giá bán và trạng thái sản phẩm.</p>
                </header>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-auto md:flex-grow">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên hoặc danh mục..."
                                className="w-full max-w-lg pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-center">
                            <input
                                type="checkbox"
                                id="showArchived"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="showArchived" className="text-sm text-slate-600 dark:text-slate-300">Hiển thị sản phẩm đã ẩn</label>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Ảnh</th>
                                    <th className="px-4 py-3 font-semibold">Tên sản phẩm</th>
                                    <th className="px-4 py-3 font-semibold text-center">Tồn kho</th>
                                    <th className="px-4 py-3 font-semibold text-right">Giá nhập</th>
                                    <th className="px-4 py-3 font-semibold text-left w-48">Giá bán (POS)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredProducts.map(product => (
                                    <tr key={product.id} className={`transition-colors 
                                        ${product.isActive === false ? 'bg-slate-100 dark:bg-slate-800 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'} 
                                        ${product.stock <= 0 && product.isActive !== false ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                        <td className="px-4 py-2"><img src={product.imageUrl || 'https://placehold.co/50x50/e2e8f0/64748b?text=Ảnh'} alt={product.name} className="w-12 h-12 object-cover rounded-md" /></td>
                                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{product.name}</td>
                                        <td className="px-4 py-2 text-center font-semibold">
                                            {product.stock > 0 ? 
                                                <span>{product.stock} {product.unit}</span> :
                                                <span className="badge badge-destructive">Hết hàng</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{formatCurrency(product.lastImportPrice)}</td>
                                        <td className="px-4 py-2">
                                            <input type="number" defaultValue={product.price} onBlur={(e) => handlePriceChange(product.id, e.target.value)} placeholder="Nhập giá bán" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500" />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button 
                                                onClick={() => handleToggleArchive(product.id, product.isActive)}
                                                className={`p-2 rounded-full transition-colors ${product.isActive === false ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                                title={product.isActive === false ? 'Khôi phục sản phẩm' : 'Ẩn sản phẩm'}
                                            >
                                                {product.isActive === false ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
            {toast.show && (<div className="fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 z-50"><CheckCircle size={20} /><span className="font-semibold">{toast.message}</span></div>)}
        </div>
    );
}