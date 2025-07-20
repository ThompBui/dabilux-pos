import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, startAfter, doc, updateDoc } from 'firebase/firestore';
import Sidebar from './Sidebar';
import { Search, Archive, ArchiveRestore, CheckCircle, Loader2 } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const Toast = ({ message, show }) => {
    if (!show) return null;
    return (
        <div className="fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <CheckCircle size={20} />
            <span className="font-semibold">{message}</span>
        </div>
    );
};

export default function ProductManagementContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    
    // State cho phân trang
    const [lastVisible, setLastVisible] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });

    // Tải dữ liệu ban đầu
    useEffect(() => {
        if (!user) return;
        const fetchInitialProducts = async () => {
            setProductsLoading(true);
            try {
                const productsRef = collection(db, 'products');
                const q = query(productsRef, orderBy('name', 'asc'), limit(25));
                
                const documentSnapshots = await getDocs(q);
                const productsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                setProducts(productsData);
                const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length-1];
                setLastVisible(lastDoc);

                if (documentSnapshots.docs.length < 25) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            } catch(error) {
                console.error("Lỗi khi tải danh sách sản phẩm:", error);
            } finally {
                setProductsLoading(false);
            }
        };
        fetchInitialProducts();
    }, [user]);

    // Tải thêm dữ liệu
    const fetchMoreProducts = async () => {
        if (!hasMore || loadingMore || !lastVisible) return;
        setLoadingMore(true);
        try {
            const productsRef = collection(db, 'products');
            const q = query(productsRef, orderBy('name', 'asc'), startAfter(lastVisible), limit(25));
            
            const documentSnapshots = await getDocs(q);
            const newProductsData = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setProducts(prev => [...prev, ...newProductsData]);
            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length-1];
            setLastVisible(lastDoc);

            if (documentSnapshots.docs.length < 25) {
                setHasMore(false);
            }
        } catch(error) {
            console.error("Lỗi khi tải thêm sản phẩm:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const filteredProducts = useMemo(() => {
        const visibleProducts = products.filter(p => showArchived ? true : p.isActive !== false);
        if (!searchTerm) return visibleProducts;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return visibleProducts.filter(p =>
            p.name?.toLowerCase().includes(lowerCaseSearch) ||
            p.category?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [products, searchTerm, showArchived]);
    
    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

    const showToast = (message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 2500);
    };

    const handlePriceChange = async (productId, newPrice) => {
        const priceValue = parseFloat(newPrice);
        if (isNaN(priceValue) || priceValue < 0) {
            showToast("Giá bán không hợp lệ.");
            return;
        }

        const productRef = doc(db, 'products', productId);
        try {
            await updateDoc(productRef, { price: priceValue });
            // Cập nhật giá trực tiếp trong state để UI phản hồi ngay lập tức
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, price: priceValue } : p));
            showToast("Cập nhật giá bán thành công!");
        } catch (error) {
            console.error("Lỗi cập nhật giá:", error);
            showToast("Lỗi: Không thể cập nhật giá.");
        }
    };

    const handleToggleArchive = async (productId, currentStatus) => {
        const productRef = doc(db, 'products', productId);
        const newStatus = currentStatus === false; // true if false, false if true/undefined
        try {
            await updateDoc(productRef, { isActive: newStatus });
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, isActive: newStatus } : p));
            showToast(newStatus ? "Khôi phục sản phẩm thành công!" : "Ẩn sản phẩm thành công!");
        } catch (error) {
            console.error("Lỗi khi cập nhật trạng thái:", error);
            showToast("Lỗi: Không thể cập nhật trạng thái.");
        }
    };

    if (authLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><p>Đang tải...</p></div>;
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header>
                    <h1 className="text-3xl font-bold">Quản lý Sản phẩm</h1>
                    <p className="text-slate-500 mt-1">Xem, tìm kiếm, điều chỉnh giá bán và trạng thái sản phẩm.</p>
                </header>
                <section className="card mt-8">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full md:flex-grow">
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên hoặc danh mục..."
                                className="input-field w-full max-w-lg pl-10"
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
                        <table className="min-w-full text-sm">
                            <thead className="table-header">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-left">Ảnh</th>
                                    <th className="px-4 py-3 font-semibold text-left">Tên sản phẩm</th>
                                    <th className="px-4 py-3 font-semibold text-center">Tồn kho</th>
                                    <th className="px-4 py-3 font-semibold text-right">Giá nhập</th>
                                    <th className="px-4 py-3 font-semibold text-left w-48">Giá bán (POS)</th>
                                    <th className="px-4 py-3 font-semibold text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {productsLoading ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Đang tải danh sách sản phẩm...</td></tr>
                                ) : filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <tr key={product.id} className={`transition-colors 
                                            ${product.isActive === false ? 'bg-slate-100 dark:bg-slate-800 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'} 
                                            ${product.stock <= 0 && product.isActive !== false ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                            <td className="px-4 py-2">
                                                <img src={product.imageUrl || 'https://placehold.co/50x50/e2e8f0/64748b?text=Ảnh'} alt={product.name} className="w-12 h-12 object-cover rounded-md" />
                                            </td>
                                            <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{product.name}</td>
                                            <td className="px-4 py-2 text-center font-semibold">
                                                {product.stock > 0 ? 
                                                    <span>{product.stock} {product.unit}</span> :
                                                    <span className="badge badge-destructive">Hết hàng</span>
                                                }
                                            </td>
                                            <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{formatCurrency(product.lastImportPrice)}</td>
                                            <td className="px-4 py-2">
                                                <input type="number" defaultValue={product.price} onBlur={(e) => handlePriceChange(product.id, e.target.value)} placeholder="Nhập giá bán" className="input-field" />
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
                                    ))
                                ) : (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Không tìm thấy sản phẩm nào.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div className="p-4 flex justify-center border-t border-slate-200 dark:border-slate-700">
                            <button onClick={fetchMoreProducts} disabled={loadingMore} className="btn-action-outline disabled:opacity-50">
                                {loadingMore ? <><Loader2 className="animate-spin" size={18}/> Đang tải...</> : 'Tải thêm'}
                            </button>
                        </div>
                    )}
                </section>
            </main>
            <Toast message={toast.message} show={toast.show} />
        </div>
    );
}