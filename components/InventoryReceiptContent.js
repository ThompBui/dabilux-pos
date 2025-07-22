// components/InventoryReceiptContent.js
import React, { useState, useEffect, useMemo } from 'react';
import { Home, PackagePlus, Search } from 'lucide-react';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Trash2, Box, CheckCircle, ArrowDownToLine, ChevronDown, ChevronUp, History, ImagePlus, X } from 'lucide-react';

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return 'N/A';
    return new Date(timestamp.toDate()).toLocaleString('vi-VN');
};

// --- Image Upload Component ---
const ImageUploadButton = ({ imageFile, onFileChange, onFileRemove }) => {
    const previewUrl = imageFile ? URL.createObjectURL(imageFile) : null;

    useEffect(() => {
        // Cleanup URL object when component unmounts or imageFile changes
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

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
                    <button onClick={onFileRemove} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors" title="Xóa ảnh">
                        <X size={12} />
                    </button>
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
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [pastReceipts, setPastReceipts] = useState([]);
    const [expandedReceiptId, setExpandedReceiptId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '' });
    const [historySearchTerm, setHistorySearchTerm] = useState('');

    // --- States để theo dõi trạng thái tải dữ liệu từng collection ---
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [loadingReceipts, setLoadingReceipts] = useState(true);

    // dataLoading sẽ là true cho đến khi tất cả các nguồn dữ liệu Firebase đã tải xong lần đầu
    const dataLoading = useMemo(() => {
        return loadingCategories || loadingUnits || loadingProducts || loadingSuppliers || loadingReceipts;
    }, [loadingCategories, loadingUnits, loadingProducts, loadingSuppliers, loadingReceipts]);

    // --- States cho gợi ý tìm kiếm ---
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

    // --- Memoized filters cho gợi ý ---
    const filteredProducts = useMemo(() => {
        if (!newItem.name) return [];
        const lowercasedTerm = newItem.name.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(lowercasedTerm)).slice(0, 10);
    }, [newItem.name, products]);

    const filteredSuppliers = useMemo(() => {
        if (!receipt.supplierName) return [];
        const lowercasedTerm = receipt.supplierName.toLowerCase();
        return suppliers.filter(s => s.name.toLowerCase().includes(lowercasedTerm) || (s.phone && s.phone.includes(lowercasedTerm))).slice(0, 10);
    }, [receipt.supplierName, suppliers]);

    const filteredHistory = useMemo(() => {
        if (!pastReceipts) return [];
        if (!historySearchTerm) return pastReceipts;

        const lowercasedTerm = historySearchTerm.toLowerCase();
        return pastReceipts.filter(receipt =>
            receipt.id.toLowerCase().includes(lowercasedTerm) ||
            receipt.supplierName?.toLowerCase().includes(lowercasedTerm) ||
            receipt.items.some(item => item.name.toLowerCase().includes(lowercasedTerm))
        );
    }, [pastReceipts, historySearchTerm]);

    // Logic xác thực
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lắng nghe dữ liệu từ Firestore
    useEffect(() => {
        const unsubscribers = [
            onSnapshot(query(collection(db, 'categories'), orderBy('name')), (s) => {
                setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingCategories(false); // Đánh dấu đã tải xong
            }),
            onSnapshot(query(collection(db, 'units'), orderBy('name')), (s) => {
                setUnits(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingUnits(false); // Đánh dấu đã tải xong
            }),
            onSnapshot(query(collection(db, 'products'), orderBy('name')), (s) => {
                setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingProducts(false); // Đánh dấu đã tải xong
            }),
            onSnapshot(query(collection(db, 'suppliers'), orderBy('name')), (s) => {
                setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingSuppliers(false); // Đánh dấu đã tải xong
            }),
            onSnapshot(query(collection(db, 'stockReceipts'), orderBy('createdAt', 'desc')), (s) => {
                setPastReceipts(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingReceipts(false); // Đánh dấu đã tải xong
            })
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, []);

    const showToast = (message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const handleReceiptChange = (e) => {
        setReceipt(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNewItemChange = (e) => {
        setNewItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleImageFileChange = (e) => {
        if (e.target.files[0]) setNewItemImageFile(e.target.files[0]);
    };

    const handleRemoveImage = () => {
        setNewItemImageFile(null);
        const fileInput = document.getElementById('newItemImage');
        if (fileInput) fileInput.value = '';
    };

    const handleAddItemToReceipt = () => {
        if (!newItem.name.trim() || !newItem.categoryId || !newItem.unitId || !newItem.quantity || newItem.quantity <= 0) {
            showToast("Vui lòng điền đủ thông tin sản phẩm (Tên, Danh mục, Đơn vị, Số lượng).");
            return;
        }

        const category = categories.find(c => c.id === newItem.categoryId);
        const unit = units.find(u => u.id === newItem.unitId);
        const quantityAsNumber = parseInt(newItem.quantity, 10);
        const importPriceAsNumber = parseFloat(newItem.importPrice);

        const itemToAdd = {
            ...newItem,
            quantity: quantityAsNumber,
            importPrice: importPriceAsNumber,
            categoryName: category?.name,
            unitName: unit?.name,
            totalPrice: quantityAsNumber * importPriceAsNumber,
            imageFile: newItemImageFile
        };

        setReceipt(prev => {
            const existingItemIndex = prev.items.findIndex(item =>
                item.name.toLowerCase() === itemToAdd.name.toLowerCase() &&
                item.categoryId === itemToAdd.categoryId &&
                item.unitId === itemToAdd.unitId
            );

            let updatedItems;
            let updatedTotalImportPrice = prev.totalImportPrice;

            if (existingItemIndex > -1) {
                // Sản phẩm đã tồn tại trong phiếu nhập, cập nhật số lượng và tổng giá
                updatedItems = [...prev.items];
                const existingItem = updatedItems[existingItemIndex];

                // Trừ đi totalPrice cũ của sản phẩm hiện có để tính lại tổng mới
                updatedTotalImportPrice -= existingItem.totalPrice;

                // Cộng dồn số lượng
                existingItem.quantity += itemToAdd.quantity;
                // Giữ nguyên giá nhập cũ để tính toán lại total (theo yêu cầu "nếu giá nhập vẫn thế thì vẫn điền")
                // Nếu muốn cập nhật giá nhập theo giá nhập mới của itemToAdd, có thể uncomment dòng dưới:
                // existingItem.importPrice = itemToAdd.importPrice;

                // Tính lại totalPrice mới cho sản phẩm đã cập nhật
                existingItem.totalPrice = existingItem.quantity * existingItem.importPrice;

                // Cộng thêm totalPrice mới của sản phẩm đã cập nhật vào tổng phiếu
                updatedTotalImportPrice += existingItem.totalPrice;

            } else {
                // Sản phẩm chưa tồn tại, thêm mới vào danh sách
                updatedItems = [...prev.items, itemToAdd];
                updatedTotalImportPrice += itemToAdd.totalPrice;
            }

            return {
                ...prev,
                items: updatedItems,
                totalImportPrice: updatedTotalImportPrice
            };
        });

        setNewItem(initialNewItemState); // Reset form thêm sản phẩm
        handleRemoveImage(); // Xóa ảnh đã chọn
    };

    const handleRemoveItem = (indexToRemove) => {
        const itemToRemove = receipt.items[indexToRemove];
        setReceipt(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== indexToRemove), totalImportPrice: prev.totalImportPrice - itemToRemove.totalPrice }));
    };

    const handleSaveReceipt = async () => {
        if (receipt.items.length === 0) { showToast("Phiếu nhập phải có ít nhất một sản phẩm."); return; }
        setIsSaving(true);
        const batch = writeBatch(db);
        const storage = getStorage();

        try {
            const finalSupplierName = receipt.supplierName.trim();
            const finalSupplierPhone = receipt.supplierPhone.trim();

            // --- Xử lý Nhà cung cấp ---
            if (finalSupplierName) {
                const supplierQuery = query(collection(db, 'suppliers'), where("name", "==", finalSupplierName));
                const supplierSnapshot = await getDocs(supplierQuery);

                if (supplierSnapshot.empty) {
                    // Nếu nhà cung cấp chưa tồn tại, thêm mới
                    const supplierRef = doc(collection(db, 'suppliers'));
                    batch.set(supplierRef, {
                        name: finalSupplierName,
                        phone: finalSupplierPhone,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Nếu đã tồn tại, cập nhật SĐT nếu có thay đổi
                    const existingSupplierData = supplierSnapshot.docs[0].data();
                    if (existingSupplierData.phone !== finalSupplierPhone) {
                        batch.update(supplierSnapshot.docs[0].ref, { phone: finalSupplierPhone, updatedAt: serverTimestamp() });
                    }
                }
            }

            // --- Xử lý từng sản phẩm trong phiếu nhập ---
            for (const item of receipt.items) {
                const productName = item.name.trim();
                const q = query(collection(db, 'products'), where("name", "==", productName));
                const querySnapshot = await getDocs(q);
                let productRef;
                let finalImageUrl = '';

                if (querySnapshot.empty) {
                    // Sản phẩm chưa tồn tại, tạo mới
                    if (item.imageFile) {
                        const imageRef = ref(storage, `product_images/${Date.now()}_${item.imageFile.name}`);
                        const uploadResult = await uploadBytes(imageRef, item.imageFile);
                        finalImageUrl = await getDownloadURL(uploadResult.ref);
                    }
                    productRef = doc(collection(db, 'products'));
                    batch.set(productRef, {
                        name: productName,
                        categoryId: item.categoryId,
                        unitId: item.unitId,
                        category: item.categoryName, // Vẫn lưu categoryName cho dễ đọc
                        unit: item.unitName,       // Vẫn lưu unitName cho dễ đọc
                        price: 0, // Giá bán mặc định
                        stock: item.quantity,
                        lastImportPrice: item.importPrice,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        imageUrl: finalImageUrl,
                        isActive: true
                    });
                } else {
                    // Sản phẩm đã tồn tại, cập nhật
                    productRef = querySnapshot.docs[0].ref;
                    const existingProductData = querySnapshot.docs[0].data();
                    batch.update(productRef, {
                        stock: increment(item.quantity),
                        lastImportPrice: item.importPrice, // Cập nhật giá nhập cuối cùng
                        updatedAt: serverTimestamp()
                    });
                    // Nếu có ảnh mới và sản phẩm chưa có ảnh hoặc muốn thay đổi ảnh
                    if (item.imageFile && !existingProductData.imageUrl) {
                        const imageRef = ref(storage, `product_images/${Date.now()}_${item.imageFile.name}`);
                        const uploadResult = await uploadBytes(imageRef, item.imageFile);
                        finalImageUrl = await getDownloadURL(uploadResult.ref);
                        batch.update(productRef, { imageUrl: finalImageUrl });
                    }
                }
            }

            // --- Lưu phiếu nhập kho ---
            const stockReceiptRef = doc(collection(db, 'stockReceipts'));
            const itemsToSave = receipt.items.map(({ imageFile, ...rest }) => rest); // Không lưu file ảnh trong Firestore Receipt
            batch.set(stockReceiptRef, {
                supplierName: finalSupplierName || 'Nhà cung cấp lẻ',
                supplierPhone: finalSupplierPhone,
                receivedAt: new Date(receipt.receivedAt),
                createdAt: serverTimestamp(),
                createdBy: user.email,
                items: itemsToSave,
                totalImportPrice: receipt.totalImportPrice
            });

            await batch.commit();
            showToast("Lưu phiếu nhập kho thành công!");
            setReceipt(initialReceiptState); // Reset form
        } catch (error) {
            console.error("Lỗi khi lưu phiếu nhập kho: ", error);
            showToast("Lỗi: Không thể lưu phiếu nhập.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Handlers cho gợi ý ---
    const handleProductInputChange = (e) => {
        const value = e.target.value;
        setNewItem(prev => ({ ...prev, name: value })); // Cập nhật tên sản phẩm để lọc gợi ý
        setShowProductSuggestions(true);
    };

    const handleSelectProduct = (product) => {
        setNewItem(prev => ({
            ...prev,
            name: product.name,
            categoryId: product.categoryId || (categories.find(c => c.name === product.category)?.id || ''),
            unitId: product.unitId || (units.find(u => u.name === product.unit)?.id || ''),
            importPrice: product.lastImportPrice || 0, // Tự động điền giá nhập cuối cùng
            quantity: 1, // Reset số lượng về 1 khi chọn sản phẩm mới
        }));
        setShowProductSuggestions(false);
    };

    const handleSupplierInputChange = (e) => {
        const value = e.target.value;
        setReceipt(prev => ({ ...prev, supplierName: value })); // Cập nhật tên NCC để lọc gợi ý
        setShowSupplierSuggestions(true);
    };

    const handleSelectSupplier = (supplier) => {
        setReceipt(prev => ({
            ...prev,
            supplierName: supplier.name,
            supplierPhone: supplier.phone || '', // Tự động điền số điện thoại
        }));
        setShowSupplierSuggestions(false);
    };


    // HIỂN THỊ MÀN HÌNH TẢI HOẶC NULL KHI CHƯA SẴN SÀNG
    if (authLoading || dataLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <p className="text-lg font-semibold">Đang tải...</p>
            </div>
        );
    }

    if (!user) {
        return null;
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
                        {/* Input Tên Nhà cung cấp */}
                        <div className="relative">
                            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Tên Nhà cung cấp</label>
                            <input
                                type="text"
                                name="supplierName"
                                value={receipt.supplierName}
                                onChange={handleSupplierInputChange}
                                onFocus={() => setShowSupplierSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 100)}
                                placeholder="Nhà cung cấp lẻ"
                                className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                                autoComplete="off"
                            />
                            {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredSuppliers.map(supplier => (
                                        <li
                                            key={supplier.id}
                                            onMouseDown={() => handleSelectSupplier(supplier)}
                                            className="px-4 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
                                        >
                                            {supplier.name} {supplier.phone && `(${supplier.phone})`}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Input SĐT Nhà cung cấp */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">SĐT Nhà cung cấp</label>
                            <input
                                type="tel"
                                name="supplierPhone"
                                value={receipt.supplierPhone}
                                onChange={handleReceiptChange}
                                className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Input Ngày giờ nhập */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Ngày giờ nhập</label>
                            <input
                                type="datetime-local"
                                name="receivedAt"
                                value={receipt.receivedAt}
                                onChange={handleReceiptChange}
                                className="w-full bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        {/* Input Tên sản phẩm */}
                        <div className="col-span-12 md:col-span-3 relative">
                            <label className="block text-xs font-medium mb-1">Tên sản phẩm</label>
                            <input
                                type="text"
                                name="name"
                                value={newItem.name}
                                onChange={handleProductInputChange}
                                onFocus={() => setShowProductSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowProductSuggestions(false), 100)}
                                placeholder="Tạo mới hoặc có sẵn"
                                className="p-2 border rounded-md w-full"
                                autoComplete="off"
                            />
                            {showProductSuggestions && filteredProducts.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredProducts.map(product => (
                                        <li
                                            key={product.id}
                                            onMouseDown={() => handleSelectProduct(product)}
                                            className="px-4 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
                                        >
                                            {product.name}
                                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({product.category}, {product.unit})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="col-span-12 md:col-span-2"><label className="block text-xs font-medium mb-1">Ảnh SP (nếu mới)</label><ImageUploadButton imageFile={newItemImageFile} onFileChange={handleImageFileChange} onFileRemove={handleRemoveImage} /></div>
                        <div className="col-span-6 md:col-span-2"><label className="block text-xs font-medium mb-1">Danh mục</label><select name="categoryId" value={newItem.categoryId} onChange={handleNewItemChange} className="p-2 border rounded-md w-full"><option value="">Chọn...</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                        <div className="col-span-6 md:col-span-1"><label className="block text-xs font-medium mb-1">Đơn vị</label><select name="unitId" value={newItem.unitId} onChange={handleNewItemChange} className="p-2 border rounded-md w-full"><option value="">Chọn...</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
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
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100"><History size={24} /> Lịch sử Nhập kho</h2>
                        <div className="relative w-full md:w-auto md:max-w-xs">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo mã phiếu, NCC, tên SP..."
                                value={historySearchTerm}
                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[50vh] rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="px-4 py-3 text-left font-semibold">Sản phẩm chính</th>
                                    <th className="px-4 py-3 text-left font-semibold">Ngày Nhập</th>
                                    <th className="px-4 py-3 text-left font-semibold">Nhà Cung Cấp</th>
                                    <th className="px-4 py-3 text-center font-semibold">Số dòng SP</th>
                                    <th className="px-4 py-3 text-right font-semibold">Tổng Giá Trị</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredHistory.length === 0 ? (<tr><td colSpan="6" className="text-center py-8 text-slate-400">Không tìm thấy phiếu nhập nào.</td></tr>) : (filteredHistory.map(pr => (
                                    <React.Fragment key={pr.id}>
                                        <tr onClick={() => setExpandedReceiptId(expandedReceiptId === pr.id ? null : pr.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                            <td className="px-4 py-3 text-center text-slate-400">{expandedReceiptId === pr.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                                            <td className="px-4 py-3 font-medium">{pr.items[0]?.name || '(Không có tên)'}</td>
                                            <td className="px-4 py-3">{formatDate(pr.createdAt)}</td><td className="px-4 py-3">{pr.supplierName}</td><td className="px-4 py-3 text-center">{pr.items.length}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(pr.totalImportPrice)}</td>
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
                    </div>
                </section>
            </main>
            {toast.show && (<div className="fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 z-50"><CheckCircle size={20} /><span className="font-semibold">{toast.message}</span></div>)}
        </div>
    );
}