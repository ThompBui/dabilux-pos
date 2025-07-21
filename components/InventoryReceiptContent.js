// components/InventoryReceiptContent.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Home, PackagePlus, Search, CheckCircle, ArrowDownToLine, ChevronDown, ChevronUp, History, ImagePlus, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, orderBy, where, getDocs, doc, writeBatch, serverTimestamp, increment, limit, startAfter } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- UTILITY ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return 'N/A';
    return new Date(timestamp.toDate()).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// --- Image Upload Component ---
const ImageUploadButton = ({ imageFile, onFileChange, onFileRemove }) => {
    const previewUrl = imageFile ? URL.createObjectURL(imageFile) : null;
    return (
        <div className="flex items-center gap-2">
            <label htmlFor="newItemImage" className="flex-grow cursor-pointer flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors">
                <ImagePlus size={16} />
                <span>{imageFile ? "Đổi ảnh" : "Thêm ảnh"}</span>
            </label>
            <input type="file" id="newItemImage" name="imageFile" onChange={onFileChange} className="hidden" accept="image/*" />
            {previewUrl && (
                <div className="relative">
                    <img src={previewUrl} alt="Preview" className="w-10 h-10 rounded-md object-cover border-2 border-slate-200" />
                    <button onClick={onFileRemove} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors" title="Xóa ảnh"><X size={12} /></button>
                </div>
            )}
        </div>
    );
};


// --- MAIN COMPONENT ---
export default function InventoryReceiptContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const initialReceiptState = { supplierName: '', supplierPhone: '', receivedAt: new Date().toISOString().slice(0, 16), items: [], totalImportPrice: 0 };
    const [receipt, setReceipt] = useState(initialReceiptState);

    const initialNewItemState = { name: '', categoryId: '', unitId: '', quantity: 1, importPrice: 0 };
    const [newItem, setNewItem] = useState(initialNewItemState);
    const [newItemImageFile, setNewItemImageFile] = useState(null);

    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    
    const [pastReceipts, setPastReceipts] = useState([]);
    const [lastVisibleReceipt, setLastVisibleReceipt] = useState(null);
    const [hasMoreReceipts, setHasMoreReceipts] = useState(true);
    const [receiptsLoading, setReceiptsLoading] = useState(true);

    const [expandedReceiptId, setExpandedReceiptId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    // States for product suggestion feature
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const debounceTimeout = useRef(null);

    // --- Data Fetching ---
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Fetch initial data (categories, units)
    useEffect(() => {
        if (!user) return;
        const fetchInitialData = async () => {
            const categoriesQuery = query(collection(db, 'categories'), orderBy('name'));
            const unitsQuery = query(collection(db, 'units'), orderBy('name'));

            const [categoriesSnapshot, unitsSnapshot] = await Promise.all([
                getDocs(categoriesQuery),
                getDocs(unitsQuery)
            ]);

            setCategories(categoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setUnits(unitsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchInitialData();
    }, [user]);

    // Fetch receipts with pagination
    const fetchReceipts = useCallback(async (loadMore = false) => {
        if (!user) return;
        setReceiptsLoading(true);
        try {
            let receiptsQuery = query(
                collection(db, 'stockReceipts'),
                orderBy('createdAt', 'desc'),
                limit(20)
            );
            if (loadMore && lastVisibleReceipt) {
                receiptsQuery = query(receiptsQuery, startAfter(lastVisibleReceipt));
            }
            const documentSnapshots = await getDocs(receiptsQuery);
            const newReceipts = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setLastVisibleReceipt(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            setPastReceipts(prev => loadMore ? [...prev, ...newReceipts] : newReceipts);
            setHasMoreReceipts(documentSnapshots.docs.length === 20);
        } catch (error) {
            console.error("Error fetching receipts:", error);
            showToast("Lỗi tải lịch sử nhập kho.", 'error');
        } finally {
            setReceiptsLoading(false);
        }
    }, [user, lastVisibleReceipt]);

    useEffect(() => {
        if(user) {
            fetchReceipts();
        }
    }, [user]);

    // --- Filtering Logic ---
    const filteredHistory = useMemo(() => {
        let filtered = pastReceipts;

        // Filter by search term
        if (historySearchTerm) {
            const lowercasedTerm = historySearchTerm.toLowerCase();
            filtered = filtered.filter(receipt =>
                receipt.id.toLowerCase().includes(lowercasedTerm) ||
                receipt.supplierName?.toLowerCase().includes(lowercasedTerm) ||
                receipt.items.some(item => item.name.toLowerCase().includes(lowercasedTerm))
            );
        }
        
        // Filter by date range
        const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
        const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        if (startDate || endDate) {
            filtered = filtered.filter(receipt => {
                const receiptDate = receipt.createdAt?.toDate();
                if (!receiptDate) return false;
                if (startDate && receiptDate < startDate) return false;
                if (endDate && receiptDate > endDate) return false;
                return true;
            });
        }
        
        return filtered;
    }, [pastReceipts, historySearchTerm, dateFilter]);

    // Debounced search for products
    useEffect(() => {
        if (productSearchTerm.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        setIsSuggestionLoading(true);
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(async () => {
            try {
                const searchTerm = productSearchTerm.trim();
                const productsRef = collection(db, 'products');
                const q = query(productsRef, 
                    where('name', '>=', searchTerm), 
                    where('name', '<=', searchTerm + '\uf8ff'),
                    limit(5)
                );
                const querySnapshot = await getDocs(q);
                setSuggestions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching product suggestions:", error);
                setSuggestions([]);
            } finally {
                setIsSuggestionLoading(false);
            }
        }, 300);

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };

    }, [productSearchTerm]);


    // --- Handlers ---
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const handleReceiptChange = (e) => setReceipt(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleNewItemChange = (e) => setNewItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleImageFileChange = (e) => { if (e.target.files[0]) setNewItemImageFile(e.target.files[0]); };
    const handleRemoveImage = () => {
        setNewItemImageFile(null);
        const fileInput = document.getElementById('newItemImage');
        if (fileInput) fileInput.value = '';
    };

    const handleProductNameChange = (e) => {
        const name = e.target.value;
        setProductSearchTerm(name);
        setNewItem(prev => ({ ...prev, name }));
    };

    const handleSelectSuggestion = (product) => {
        setNewItem({
            name: product.name,
            categoryId: product.categoryId || '',
            unitId: product.unitId || '',
            quantity: 1,
            importPrice: product.lastImportPrice || 0
        });
        setProductSearchTerm(product.name);
        if (product.lastSupplierName) {
            setReceipt(prev => ({ ...prev, supplierName: product.lastSupplierName }));
        }
        setSuggestions([]);
    };
    
    const handleAddItemToReceipt = () => {
        if (!newItem.name.trim() || !newItem.categoryId || !newItem.unitId || !newItem.quantity || newItem.quantity <= 0) {
            showToast("Vui lòng điền đủ thông tin sản phẩm!", 'error');
            return;
        }
        const category = categories.find(c => c.id === newItem.categoryId);
        const unit = units.find(u => u.id === newItem.unitId);

        const itemToAdd = {
            ...newItem,
            quantity: parseInt(newItem.quantity, 10),
            importPrice: parseFloat(newItem.importPrice),
            categoryName: category?.name,
            unitName: unit?.name,
            totalPrice: parseInt(newItem.quantity, 10) * parseFloat(newItem.importPrice),
            imageFile: newItemImageFile
        };

        setReceipt(prev => ({ ...prev, items: [...prev.items, itemToAdd], totalImportPrice: prev.totalImportPrice + itemToAdd.totalPrice }));
        setNewItem(initialNewItemState);
        setProductSearchTerm('');
        handleRemoveImage();
    };

    const handleRemoveItem = (indexToRemove) => {
        const itemToRemove = receipt.items[indexToRemove];
        setReceipt(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== indexToRemove), totalImportPrice: prev.totalImportPrice - itemToRemove.totalPrice }));
    };

    const handleSaveReceipt = async () => {
        if (receipt.items.length === 0) {
            showToast("Phiếu nhập phải có ít nhất một sản phẩm.", 'error');
            return;
        }
        setIsSaving(true);
        const batch = writeBatch(db);
        const storage = getStorage();
        const finalSupplierName = receipt.supplierName.trim() || 'Nhà cung cấp lẻ';

        try {
            const itemNames = receipt.items.map(item => item.name.trim());
            const productsQuery = query(collection(db, 'products'), where("name", "in", itemNames));
            const productsSnapshot = await getDocs(productsQuery);
            const existingProducts = new Map(productsSnapshot.docs.map(doc => [doc.data().name, doc]));

            for (const item of receipt.items) {
                const productName = item.name.trim();
                const existingDoc = existingProducts.get(productName);
                let finalImageUrl = '';

                const productData = {
                    name: productName,
                    stock: increment(item.quantity),
                    lastImportPrice: item.importPrice,
                    updatedAt: serverTimestamp(),
                    lastSupplierName: finalSupplierName,
                    categoryId: item.categoryId,
                    categoryName: item.categoryName,
                    unitId: item.unitId,
                    unitName: item.unitName,
                };

                if (!existingDoc) {
                    if (item.imageFile) {
                        const imageRef = ref(storage, `product_images/${Date.now()}_${item.imageFile.name}`);
                        const uploadResult = await uploadBytes(imageRef, item.imageFile);
                        finalImageUrl = await getDownloadURL(uploadResult.ref);
                    }
                    const newProductRef = doc(collection(db, 'products'));
                    batch.set(newProductRef, {
                        ...productData,
                        stock: item.quantity,
                        price: 0,
                        createdAt: serverTimestamp(),
                        imageUrl: finalImageUrl,
                        isActive: true
                    });
                } else {
                    batch.update(existingDoc.ref, productData);
                }
            }

            const stockReceiptRef = doc(collection(db, 'stockReceipts'));
            const itemsToSave = receipt.items.map(({ imageFile, ...rest }) => rest);
            batch.set(stockReceiptRef, {
                supplierName: finalSupplierName,
                supplierPhone: receipt.supplierPhone,
                receivedAt: new Date(receipt.receivedAt),
                createdAt: serverTimestamp(),
                createdBy: user.email,
                items: itemsToSave,
                totalImportPrice: receipt.totalImportPrice
            });

            await batch.commit();
            showToast("Lưu phiếu nhập kho thành công!");
            setReceipt(initialReceiptState);
            setProductSearchTerm('');
            fetchReceipts(false); // Refetch from the beginning
        } catch (error) {
            console.error("Lỗi khi lưu phiếu nhập kho: ", error);
            showToast("Lỗi: Không thể lưu phiếu nhập.", 'error');
        } finally {
            setIsSaving(false);
        }
    };


    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
                <p className="text-lg font-semibold">Đang xác thực...</p>
            </div>
        );
    }
    
    if (!user) {
        return null; // Redirect is handled by useEffect
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />
            <main className="flex-1 ml-64 p-8 space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Nhập kho</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Tạo và quản lý các phiếu nhập kho sản phẩm.</p>
                </header>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-6 text-slate-900 dark:text-slate-100"><PackagePlus size={24} /> Tạo Phiếu Nhập Mới</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                        <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Tên Nhà cung cấp</label><input type="text" name="supplierName" value={receipt.supplierName} onChange={handleReceiptChange} placeholder="Nhà cung cấp lẻ" className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">SĐT Nhà cung cấp</label><input type="tel" name="supplierPhone" value={receipt.supplierPhone} onChange={handleReceiptChange} className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Ngày giờ nhập</label><input type="datetime-local" name="receivedAt" value={receipt.receivedAt} onChange={handleReceiptChange} className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500" required /></div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        
                        <div className="col-span-12 md:col-span-3 relative">
                            <label className="block text-xs font-medium mb-1">Tên sản phẩm</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={productSearchTerm} 
                                onChange={handleProductNameChange}
                                placeholder="Gõ để tìm hoặc tạo mới..." 
                                className="p-2 border rounded-md w-full" 
                                autoComplete="off"
                            />
                            {(isSuggestionLoading || suggestions.length > 0) && (
                                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {isSuggestionLoading && <div className="px-3 py-2 text-sm text-slate-500">Đang tìm...</div>}
                                    {!isSuggestionLoading && suggestions.map(product => (
                                        <div 
                                            key={product.id} 
                                            onClick={() => handleSelectSuggestion(product)}
                                            className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                                        >
                                            <p className="font-semibold">{product.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Tồn kho: {product.stock || 0} {product.unitName} - NCC cuối: {product.lastSupplierName || 'Chưa rõ'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="col-span-12 md:col-span-2"><label className="block text-xs font-medium mb-1">Ảnh SP (nếu mới)</label><ImageUploadButton imageFile={newItemImageFile} onFileChange={handleImageFileChange} onFileRemove={handleRemoveImage} /></div>
                        <div className="col-span-6 md:col-span-2"><label className="block text-xs font-medium mb-1">Danh mục</label><select name="categoryId" value={newItem.categoryId} onChange={handleNewItemChange} className="p-2 border rounded-md w-full bg-white dark:bg-slate-700"><option value="">Chọn...</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                        <div className="col-span-6 md:col-span-1"><label className="block text-xs font-medium mb-1">Đơn vị</label><select name="unitId" value={newItem.unitId} onChange={handleNewItemChange} className="p-2 border rounded-md w-full bg-white dark:bg-slate-700"><option value="">Chọn...</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
                        <div className="col-span-4 md:col-span-1"><label className="block text-xs font-medium mb-1">Số lượng</label><input type="number" name="quantity" value={newItem.quantity} onChange={handleNewItemChange} min="1" className="p-2 border rounded-md w-full" /></div>
                        <div className="col-span-5 md:col-span-2"><label className="block text-xs font-medium mb-1">Giá nhập/ĐV</label><input type="number" name="importPrice" value={newItem.importPrice} onChange={handleNewItemChange} min="0" className="p-2 border rounded-md w-full" /></div>
                        <div className="col-span-3 md:col-span-1"><button onClick={handleAddItemToReceipt} title="Thêm vào danh sách" className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"><ArrowDownToLine size={20} /></button></div>
                    </div>

                    <div className="mt-6">
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold text-left">Tên SP</th><th className="px-4 py-3 font-semibold text-left">Danh mục</th><th className="px-4 py-3 font-semibold text-center">SL</th><th className="px-4 py-3 font-semibold text-right">Giá nhập</th><th className="px-4 py-3 font-semibold text-right">Thành tiền</th><th className="px-4 py-3 font-semibold text-center"></th></tr></thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {receipt.items.length === 0 ? (<tr><td colSpan="6" className="text-center py-8 text-slate-400">Chưa có sản phẩm nào trong phiếu.</td></tr>) : (receipt.items.map((item, index) => (
                                        <tr key={index}><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-slate-500">{item.categoryName}</td><td className="px-4 py-3 text-center">{item.quantity} {item.unitName}</td><td className="px-4 py-3 text-right">{formatCurrency(item.importPrice)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.totalPrice)}</td><td className="px-4 py-3 text-center"><button onClick={() => handleRemoveItem(index)} className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><Trash2 size={16} /></button></td></tr>
                                    )))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div><p className="text-slate-500">Tổng giá trị phiếu nhập</p><p className="text-3xl font-bold text-indigo-600">{formatCurrency(receipt.totalImportPrice)}</p></div>
                        <button onClick={handleSaveReceipt} disabled={isSaving || receipt.items.length === 0} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-wait transition-colors">{isSaving ? 'Đang lưu...' : 'Hoàn tất & Lưu Phiếu'}</button>
                    </div>
                </section>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100"><History size={24} /> Lịch sử Nhập kho</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Tìm kiếm</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Mã phiếu, NCC, tên SP..."
                                    value={historySearchTerm}
                                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Từ ngày</label>
                                <input type="date" value={dateFilter.start} onChange={e => setDateFilter(p => ({...p, start: e.target.value}))} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Đến ngày</label>
                                <input type="date" value={dateFilter.end} onChange={e => setDateFilter(p => ({...p, end: e.target.value}))} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto max-h-[60vh] rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 text-slate-500 dark:text-slate-400 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="px-4 py-3 text-left font-semibold">Ngày Nhập</th>
                                    <th className="px-4 py-3 text-left font-semibold">Nhà Cung Cấp</th>
                                    <th className="px-4 py-3 text-left font-semibold">Sản phẩm chính</th>
                                    <th className="px-4 py-3 text-center font-semibold">Số dòng SP</th>
                                    <th className="px-4 py-3 text-right font-semibold">Tổng Giá Trị</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {receiptsLoading && pastReceipts.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Đang tải dữ liệu...</td></tr>
                                ) : filteredHistory.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-slate-500">Không tìm thấy phiếu nhập phù hợp.</td></tr>
                                ) : (filteredHistory.map(pr => (
                                    <React.Fragment key={pr.id}>
                                        <tr onClick={() => setExpandedReceiptId(expandedReceiptId === pr.id ? null : pr.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                            <td className="px-4 py-3 text-center text-slate-400">{expandedReceiptId === pr.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                                            <td className="px-4 py-3">{formatDate(pr.createdAt)}</td>
                                            <td className="px-4 py-3">{pr.supplierName}</td>
                                            <td className="px-4 py-3 font-medium">{pr.items[0]?.name || '(Không có tên)'}{pr.items.length > 1 ? ` và ${pr.items.length - 1} sp khác` : ''}</td>
                                            <td className="px-4 py-3 text-center">{pr.items.length}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(pr.totalImportPrice)}</td>
                                        </tr>
                                        {expandedReceiptId === pr.id && (
                                            <tr className="bg-slate-100 dark:bg-slate-900"><td colSpan="6" className="p-3">
                                                <div className="p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md">
                                                    <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm">Chi tiết phiếu:</h4><p className="text-xs font-mono text-slate-500">Mã phiếu: {pr.id}</p></div>
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-200 dark:bg-slate-700"><tr><th className="px-2 py-2 text-left font-semibold">Tên SP</th><th className="px-2 py-2 text-center font-semibold">Số Lượng</th><th className="px-2 py-2 text-right font-semibold">Giá Nhập</th><th className="px-2 py-2 text-right font-semibold">Thành Tiền</th></tr></thead>
                                                        <tbody>
                                                            {pr.items.map((item, index) => (<tr key={index} className="border-t border-slate-200 dark:border-slate-600"><td className="p-2">{item.name}</td><td className="p-2 text-center">{item.quantity} {item.unitName}</td><td className="p-2 text-right">{formatCurrency(item.importPrice)}</td><td className="p-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td></tr>))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td></tr>
                                        )}
                                    </React.Fragment>
                                )))}
                            </tbody>
                        </table>
                        {!receiptsLoading && hasMoreReceipts && filteredHistory.length > 0 && (
                             <div className="p-4 text-center">
                                <button onClick={() => fetchReceipts(true)} className="px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900">
                                    Tải thêm
                                </button>
                            </div>
                        )}
                         {receiptsLoading && pastReceipts.length > 0 && <div className="text-center py-4">Đang tải...</div>}
                    </div>
                </section>
            </main>

            {toast.show && (
                <div className={`fixed top-5 right-5 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 z-50 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    <CheckCircle size={20} />
                    <span className="font-semibold">{toast.message}</span>
                </div>
            )}
        </div>
    );
}