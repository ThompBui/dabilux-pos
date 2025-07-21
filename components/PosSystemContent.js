import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  increment,
  query,
  orderBy,
  where,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
    ShoppingBasket, Sun, Moon, Barcode, FileText, Calculator, Search,
    UserCircle, UserPlus, UserCheck, UserX, PauseCircle, CheckCircle,
    Wallet, Trash2, X, Printer, LogOut, Bell, Archive, Loader2, QrCode
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import ProductSkeleton from './ProductSkeleton';

// 🚨 ĐẢM BẢO CÓ DÒNG NÀY 🚨
import { usePayOS, PayOSConfig } from '@payos/payos-checkout';

// --- CÁC HÀM HỖ TRỢ & COMPONENT CON (GIỮ NGUYÊN) ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const parseCurrency = (string) => parseFloat(String(string).replace(/[^\d]/g, '')) || 0;

const CustomerModal = dynamic(() => import('./CustomerModal'), { ssr: false });
const CalculatorModal = dynamic(() => import('./CalculatorModal'), { ssr: false });
const ProductLookupModal = dynamic(() => import('./ProductLookupModal'), { ssr: false });
const ReceiptModal = dynamic(() => import('./ReceiptModal'), { ssr: false });
const NotificationPanel = dynamic(() => import('./NotificationPanel'), { ssr: false });
const QrPaymentModal = dynamic(() => import('./QrPaymentModal'), { ssr: false });

function usePersistentState(key, defaultValue) {
    const [state, setState] = useState(defaultValue);
    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => {
        try {
            const persistentState = localStorage.getItem(key);
            if (persistentState) setState(JSON.parse(persistentState));
        } catch (error) { console.warn(`Lỗi đọc localStorage key “${key}”:`, error); }
        setIsHydrated(true);
    }, [key]);
    useEffect(() => {
        if (isHydrated) {
            try {
                localStorage.setItem(key, JSON.stringify(state));
            } catch (error) { console.warn(`Lỗi ghi localStorage key “${key}”:`, error); }
        }
    }, [key, state, isHydrated]);
    return [state, setState];
}

const CustomerPanel = ({ customer, onAction }) => {
    if (customer) {
        return (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                    <UserCheck className="w-10 h-10 text-green-500 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-green-800 dark:text-green-300">{customer.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{customer.points !== undefined ? customer.points : 0} điểm</p>
                    </div>
                </div>
                <button onClick={() => onAction('remove')} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors" title="Bỏ chọn khách hàng">
                    <UserX size={20} />
                </button>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <UserCircle className="w-10 h-10 text-indigo-500" />
                <div>
                    <p className="font-bold">Khách lẻ</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">0 điểm</p>
                </div>
            </div>
            <button onClick={() => onAction('open_modal')} className="btn-action-outline transition-colors">
                <UserPlus size={18}/><span>Tìm/Thêm</span>
            </button>
        </div>
    );
};

const Toast = ({ message, show }) => (
    <div className={`fixed top-5 right-5 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-3 transform transition-transform duration-300 z-50 ${show ? 'translate-x-0' : 'translate-x-[150%]'}`}>
        <CheckCircle size={20} />
        <span className="font-semibold">{message}</span>
    </div>
);


// --- START: POSSystemContent Component ---
export default function PosSystemContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    // --- STATES ---
    const [allProducts, setAllProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [storeInfo, setStoreInfo] = useState({ name: 'BuiAnh POS', logoUrl: '' });

    const [dataLoading, setDataLoading] = useState(true);

    const [theme, setTheme] = useState('light');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [cart, setCart] = usePersistentState('pos-cart', []);
    const [currentCustomer, setCurrentCustomer] = usePersistentState('pos-customer', null);
    const [heldBills, setHeldBills] = usePersistentState('pos-heldBills', []);
    const [activePaymentMethod, setActivePaymentMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [pointsToUse, setPointsToUse] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showProductLookup, setShowProductLookup] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastReceiptData, setLastReceiptData] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '' });
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [dismissedNotifications, setDismissedNotifications] = useState([]);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [paymentLinkData, setPaymentLinkData] = useState(null);

    // 🚨 STATE MỚI CHO TRẠNG THÁI THANH TOÁN PAYOS 🚨
    const [payosStatus, setPayosStatus] = useState('INIT'); // 'INIT', 'LOADING', 'OPENING_POPUP', 'OPENED', 'PAID', 'CANCELLED', 'EXIT', 'ERROR'


    // --- HÀM HỖ TRỢ & CALLBACKS ---
    const showToast = useCallback((message) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    }, []);

    const resetTransaction = useCallback(() => { setCart([]); setCurrentCustomer(null); setCashReceived(''); setPointsToUse(''); }, [setCart, setCurrentCustomer]);

    // 🚨 ĐỊNH NGHĨA useMemo cho payOSConfig TRƯỚC usePayOS 🚨
    const payOSConfig = useMemo(() => {
        if (!paymentLinkData?.checkoutUrl) return null; // Chỉ tạo config khi có checkoutUrl

        return {
            RETURN_URL: window.location.origin + router.pathname, // <-- QUAN TRỌNG: Trở về chính trang hiện tại
            CHECKOUT_URL: paymentLinkData.checkoutUrl, // URL thanh toán lấy từ Backend
            embedded: false, // <-- QUAN TRỌNG: ĐẶT LÀ FALSE ĐỂ HIỂN THỊ DẠNG POP-UP
            onSuccess: (event) => {
                console.log('PayOS onSuccess Callback (Frontend):', event);
                setPayosStatus('PAID'); // Cập nhật UI ngay lập tức
                // Logic hoàn tất giao dịch (finalizeSale) sẽ được kích hoạt bởi onSnapshot
                // từ Firebase khi webhook cập nhật trạng thái PAID.
            },
            onCancel: (event) => {
                console.log('PayOS onCancel Callback (Frontend):', event);
                setPayosStatus('CANCELLED'); // Cập nhật UI ngay lập tức
                // Logic hủy (transactionRef updated) sẽ được kích hoạt bởi onSnapshot.
            },
            onExit: (event) => {
                console.log('PayOS onExit Callback (Frontend):', event);
                setPayosStatus('EXIT'); // Cập nhật UI ngay lập tức (người dùng đóng pop-up)
                // Quan trọng: Sự kiện onExit không đảm bảo giao dịch đã hủy.
                // Luôn dựa vào Webhook (onSnapshot) để xác nhận trạng thái cuối cùng.
            },
        };
    }, [paymentLinkData?.checkoutUrl, router.pathname]); // Dependencies: chỉ tạo lại khi checkoutUrl hoặc pathname thay đổi

    // 🚨 GỌI HOOK usePayOS NGAY SAU KHI payOSConfig ĐƯỢC ĐỊNH NGHĨA 🚨
    const { open: openPayOSPopup, exit: exitPayOSPopup } = usePayOS(payOSConfig || {}); // Truyền config, nếu null thì truyền object rỗng để tránh lỗi


    // --- USE EFFECTS (THỨ TỰ CÁC useEffect KHÔNG QUAN TRỌNG VỀ ĐỊNH NGHĨA, NHƯNG LẠI QUAN TRỌNG VỚI openPayOSPopup) ---
    useEffect(() => {
        const root = window.document.documentElement;
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
        root.classList.toggle('dark', savedTheme === 'dark');
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (!user) return;
        setDataLoading(true);
        const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubStoreInfo = onSnapshot(doc(db, 'settings', 'storeInfo'), (docSnap) => { if (docSnap.exists()) setStoreInfo(docSnap.data()); });
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));
        const unsubProducts = onSnapshot(q, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllProducts(productsData);
            setDataLoading(false);
        });
        return () => { unsubCustomers(); unsubStoreInfo(); unsubProducts(); };
    }, [user]);

    const activeProducts = useMemo(() => allProducts.filter(p => p.isActive !== false), [allProducts]);
    const filteredProducts = useMemo(() => {
        if (activeCategory === 'all') return activeProducts;
        return activeProducts.filter(p => p.category === activeCategory);
    }, [activeCategory, activeProducts]);

    useEffect(() => {
        const lowStock = allProducts.filter(p => p.stock !== undefined && p.stock <= 10 && p.isActive !== false);
        setLowStockProducts(lowStock);
    }, [allProducts]);

    useEffect(() => {
        const dismissed = localStorage.getItem('dismissedLowStockAlerts');
        if (dismissed) setDismissedNotifications(JSON.parse(dismissed));
    }, []);

    const undismissedNotifications = useMemo(() => lowStockProducts.filter(p => !dismissedNotifications.includes(p.id)), [lowStockProducts, dismissedNotifications]);
    const handleDismissNotification = (productId) => {
        const newDismissed = [...dismissedNotifications, productId];
        setDismissedNotifications(newDismissed);
        localStorage.setItem('dismissedLowStockAlerts', JSON.stringify(newDismissed));
    };

    useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
    useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => { setPointsToUse(''); }, [currentCustomer]);

    const categories = useMemo(() => ['all', ...new Set(allProducts.map(p => p.category).filter(Boolean))], [allProducts]);
    const { subtotal, tax, total } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
        return { subtotal: sub, tax: sub * 0.1, total: sub * 1.1 };
    }, [cart]);
    const discountAmount = useMemo(() => {
        const requestedPoints = parseCurrency(pointsToUse);
        if (!currentCustomer || requestedPoints <= 0) return 0;
        const actualPointsUsed = Math.min(requestedPoints, currentCustomer.points || 0);
        return Math.min(actualPointsUsed * 1000, total);
    }, [pointsToUse, currentCustomer, total]);
    const totalAfterDiscount = useMemo(() => total - discountAmount, [total, discountAmount]);
    const changeAmount = useMemo(() => {
        const received = parseCurrency(cashReceived);
        return received > totalAfterDiscount ? received - totalAfterDiscount : 0;
    }, [cashReceived, totalAfterDiscount]);


    // 🚨 USEEFFECT NÀY PHẢI SAU KHI usePayOS ĐƯỢC GỌI 🚨
    useEffect(() => {
        // Điều kiện:
        // 1. payosStatus đang ở trạng thái chuẩn bị mở pop-up ('OPENING_POPUP')
        // 2. paymentLinkData có checkoutUrl
        // 3. payOSConfig đã được tạo (không phải null)
        if (payosStatus === 'OPENING_POPUP' && paymentLinkData?.checkoutUrl && payOSConfig) {
            openPayOSPopup(); // Gọi hàm mở pop-up của PayOS
            setPayosStatus('OPENED'); // Cập nhật trạng thái đã mở
        }
    }, [payosStatus, paymentLinkData?.checkoutUrl, openPayOSPopup, payOSConfig]);


    // --- HÀM XỬ LÝ (CALLBACKS) ---
    const handleAddToCart = useCallback((product) => {
        if (!product || !product.id) {
            showToast("Lỗi: Sản phẩm không hợp lệ.");
            return;
        }
        if (product.stock <= 0) {
            showToast(`"${product.name}" đã hết hàng!`);
            return;
        }
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity >= product.stock) {
                    showToast(`Đã đạt số lượng tồn kho.`);
                    return prevCart;
                }
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    }, [setCart, showToast]);

    const handleUpdateQuantity = useCallback((productId, newQuantityStr) => {
        const newQuantity = Math.max(1, parseInt(newQuantityStr, 10) || 1);
        const productInAll = allProducts.find(p => p.id === productId);
        if (productInAll && newQuantity > productInAll.stock) {
            showToast(`Chỉ còn ${productInAll.stock} "${productInAll.name}" trong kho.`);
            setCart(prevCart => prevCart.map(item =>
                item.id === productId ? { ...item, quantity: productInAll.stock } : item
            ));
            return;
        }
        setCart(prevCart => prevCart.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
        ));
    }, [allProducts, setCart, showToast]);

    const handleRemoveFromCart = useCallback((productId) => { setCart(prev => prev.filter(item => item.id !== productId)); }, [setCart]);
    const handleCategoryFilter = useCallback((category) => { setActiveCategory(category); }, []);

    const handleAddNewCustomer = useCallback(async (newCustomerData) => {
        try {
            const docRef = await addDoc(collection(db, "customers"), { ...newCustomerData, points: 0, createdAt: serverTimestamp() });
            setCurrentCustomer({ id: docRef.id, ...newCustomerData, points: 0 });
            showToast("Thêm khách hàng thành công!");
        } catch (e) { showToast("Lỗi: Không thể thêm khách hàng."); }
    }, [setCurrentCustomer, showToast]);

    const handleHoldBill = () => {
        if (cart.length === 0) { showToast('Không có hóa đơn để giữ!'); return; }
        setHeldBills(prev => [...prev, { id: Date.now(), cart, customer: currentCustomer, total: totalAfterDiscount, time: new Date(), pointsToUse }]);
        resetTransaction();
        showToast('Đã giữ hóa đơn thành công.');
    };

    const handleRestoreBill = (billId) => {
        const bill = heldBills.find(b => b.id === billId);
        if (bill) {
            setCart(bill.cart);
            setCurrentCustomer(bill.customer);
            setPointsToUse(bill.pointsToUse || '');
            setHeldBills(prev => prev.filter(b => b.id !== billId));
            showToast('Đã khôi phục hóa đơn.');
        }
    };

    const handleDenominationClick = (amount) => {
        const currentAmount = parseCurrency(cashReceived);
        const newAmount = currentAmount + amount;
        setCashReceived(new Intl.NumberFormat('vi-VN').format(newAmount));
    };

    const handleClearCashReceived = () => { setCashReceived(''); };

    const finalizeSale = useCallback(async (saleCart, saleCustomer, salePointsUsedStr, paymentMethod) => {
        if (!saleCart || saleCart.length === 0) { showToast("Lỗi: Giỏ hàng trống."); return; }
        try {
            await runTransaction(db, async (transaction) => {
                const productRefs = saleCart.map(item => doc(db, 'products', item.id));
                const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
                let customerDoc = null;
                if (saleCustomer) {
                    const customerRef = doc(db, 'customers', saleCustomer.id);
                    customerDoc = await transaction.get(customerRef);
                }
                for (let i = 0; i < productDocs.length; i++) {
                    const productDoc = productDocs[i];
                    if (!productDoc.exists() || productDoc.data().stock < saleCart[i].quantity) {
                        throw new Error(`Tồn kho không đủ cho "${saleCart[i].name}".`);
                    }
                }
                const saleSubtotal = saleCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const saleTax = saleSubtotal * 0.1;
                const saleTotal = saleSubtotal + saleTax;
                const salePointsUsed = parseCurrency(salePointsUsedStr);
                let saleDiscountAmount = 0;
                let finalCustomerData = null;
                let pointsEarnedThisTransaction = 0;
                if (saleCustomer && customerDoc && customerDoc.exists()) {
                    const serverPoints = customerDoc.data().points || 0;
                    const pointsUsedThisTransaction = Math.min(salePointsUsed, serverPoints);
                    saleDiscountAmount = Math.min(pointsUsedThisTransaction * 1000, saleTotal);
                    pointsEarnedThisTransaction = Math.floor(saleSubtotal / 10000);
                    const finalCustomerPoints = serverPoints - pointsUsedThisTransaction + pointsEarnedThisTransaction;
                    finalCustomerData = { ...saleCustomer, points: finalCustomerPoints };
                }
                const saleTotalAfterDiscount = saleTotal - saleDiscountAmount;
                productDocs.forEach((productDoc, i) => {
                    transaction.update(doc(db, 'products', productDoc.id), { stock: increment(-saleCart[i].quantity) });
                });
                if (finalCustomerData) {
                    transaction.update(doc(db, 'customers', finalCustomerData.id), { points: finalCustomerData.points });
                }
                const billData = { items: saleCart, customer: finalCustomerData, subtotal: saleSubtotal, tax: saleTax, discountAmount: saleDiscountAmount, totalAfterDiscount: saleTotalAfterDiscount, paymentMethod, createdBy: user.email, createdAt: serverTimestamp(), pointsEarned: pointsEarnedThisTransaction, pointsUsed: finalCustomerData ? Math.min(salePointsUsed, saleCustomer.points || 0) : 0, storeInfo };
                transaction.set(doc(collection(db, 'bills')), billData);
                setLastReceiptData({ ...billData, createdAt: new Date(), customer: finalCustomerData, storeInfo });
            });
            setShowReceiptModal(true);
            resetTransaction();
        } catch (error) { showToast(`Lỗi thanh toán: ${error.message}`); }
    }, [user, storeInfo, resetTransaction, showToast]);

    // 🚨 HÀM XỬ LÝ TẠO LINK PAYOS 🚨
    const handleCreatePayOSLink = async () => {
        if (cart.length === 0) {
            showToast("Giỏ hàng trống!");
            return;
        }

        // 🚨 QUẢN LÝ TRẠNG THÁI MODAL VÀ PAYOS 🚨
        setIsQrModalOpen(true); // Mở modal để người dùng thấy trạng thái chờ
        setPaymentLinkData(null); // Reset dữ liệu thanh toán cũ
        setPayosStatus('LOADING'); // Đặt trạng thái ban đầu là đang tải

        const orderCode = Date.now(); // Tạo mã đơn hàng duy nhất
        const transactionRef = doc(db, 'transactions', String(orderCode)); // Tham chiếu đến đơn hàng trong Firebase

        try {
            // 1. TẠO ĐƠN HÀNG PENDING TRONG FIRESTORE
            const pendingTransaction = {
                status: 'PENDING',
                orderCode: orderCode,
                amount: Math.round(totalAfterDiscount),
                createdAt: serverTimestamp(),
                cart: cart,
                customer: currentCustomer,
                pointsToUse: pointsToUse,
                createdBy: { uid: user.uid, email: user.email },
            };
            await setDoc(transactionRef, pendingTransaction);

            // 2. BẮT ĐẦU LẮNG NGHE SỰ THAY ĐỔI TRẠNG THÁI CỦA ĐƠN HÀNG TỪ FIRESTORE (DO WEBHOOK CẬP NHẬT)
            const unsubscribe = onSnapshot(transactionRef, (docSnap) => {
                const data = docSnap.data();
                if (data && data.status === 'PAID') {
                    unsubscribe(); // Ngừng lắng nghe khi đã PAID
                    setPayosStatus('PAID'); // Cập nhật trạng thái PayOS thành PAID
                    // Sau khi trạng thái là PAID (từ webhook), gọi finalizeSale
                    setTimeout(() => {
                        finalizeSale(data.cart, data.customer, data.pointsToUse, 'qr');
                        setIsQrModalOpen(false); // Đóng modal QR
                        showToast("Thanh toán thành công!"); // Thông báo thành công
                    }, 1500); // Đợi một chút để người dùng thấy trạng thái
                } else if (data && data.status === 'CANCELLED') {
                    unsubscribe(); // Ngừng lắng nghe khi đã CANCELLED
                    setPayosStatus('CANCELLED'); // Cập nhật trạng thái PayOS thành CANCELLED
                    setTimeout(() => {
                        setIsQrModalOpen(false); // Đóng modal QR
                        showToast("Thanh toán đã bị hủy hoặc thất bại."); // Thông báo thất bại
                    }, 2000);
                } else if (data && data.status === 'PENDING' && payosStatus === 'OPENED') {
                    // Nếu trạng thái vẫn là pending sau khi popup đã mở, có thể người dùng đóng popup
                    // và chúng ta vẫn chờ webhook. Không làm gì đặc biệt ở đây, cứ để modal hiển thị.
                }
            }, (error) => {
                console.error("Lỗi lắng nghe transaction Firebase:", error);
                setPayosStatus('ERROR'); // Cập nhật trạng thái lỗi
                showToast("Lỗi kết nối Firebase, vui lòng thử lại.");
                setIsQrModalOpen(false);
            });

            // 3. GỌI API BACKEND ĐỂ LẤY LINK THANH TOÁN
            const response = await fetch('/api/create-payment-link', { // Tên file đã thống nhất
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderCode: orderCode,
                    amount: Math.round(totalAfterDiscount),
                    description: `DH ${orderCode} (POS)`,
                }),
            });

            const result = await response.json();
            if (!response.ok || result.error) {
                throw new Error(result.error || "Không thể lấy link thanh toán từ PayOS");
            }

            // 🚨 QUAN TRỌNG: Thiết lập paymentLinkData và thay đổi trạng thái để kích hoạt useEffect mở pop-up 🚨
            setPaymentLinkData({ ...result.data, status: 'PENDING' }); // Lưu link và QR code
            setPayosStatus('OPENING_POPUP'); // Đặt trạng thái để useEffect ở trên mở pop-up

        } catch (error) {
            console.error("Lỗi khi tạo giao dịch PayOS:", error);
            showToast(`Lỗi thanh toán QR: ${error.message}`);
            setIsQrModalOpen(false); // Đóng modal nếu có lỗi
            // Xóa giao dịch pending nếu không tạo được link thành công
            await deleteDoc(transactionRef).catch(e => console.error("Lỗi xóa transaction pending:", e));
            setPayosStatus('ERROR'); // Cập nhật trạng thái lỗi
        }
    };


    const initiateCheckout = () => {
        if (activePaymentMethod === 'cash') {
            if (totalAfterDiscount > 0 && (parseCurrency(cashReceived) < totalAfterDiscount)) {
                showToast('Số tiền khách đưa không đủ!');
                return;
            }
            finalizeSale(cart, currentCustomer, pointsToUse, 'cash');
        } else {
            handleCreatePayOSLink();
        }
    };

    if (authLoading) return <div className="flex items-center justify-center h-screen"><p>Đang kiểm tra...</p></div>;

    return (
        <>
            <main className="flex h-screen w-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 antialiased overflow-hidden">
                <div className="w-[500px] flex-shrink-0 flex flex-col h-screen">
                    <header className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border-b border-r border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <Image src={storeInfo.logoUrl || 'https://placehold.co/40x40/6366f1/ffffff?text=POS'} alt="Logo" width={40} height={40} className="object-contain rounded-md bg-slate-200"/>
                            <div><h1 className="text-lg font-bold">{storeInfo.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Quầy 01 - {user?.displayName || user?.email}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-right"><p className="font-semibold text-lg">{currentTime.toLocaleTimeString('vi-VN')}</p><p className="text-xs text-slate-500 dark:text-slate-400">{currentTime.toLocaleDateString('vi-VN')}</p></div>
                            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Đổi giao diện">{theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}</button>
                        </div>
                    </header>
                    <div className="p-4 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700"><div className="relative"><Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400"/><input type="text" placeholder="Quét mã vạch hoặc nhập tên (F3)..." className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg pl-14 pr-4 py-4 text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"/></div></div>
                    <div className="flex-grow p-4 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex-grow overflow-y-auto relative">
                            <table className="w-full text-sm text-left table-fixed">
                                <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2 w-[8%]">#</th>
                                        <th className="px-4 py-2 w-[42%]">Sản phẩm</th>
                                        <th className="px-4 py-2 w-[20%] text-center">SL</th>
                                        <th className="px-4 py-2 w-[20%] text-right">T.Tiền</th>
                                        <th className="px-4 py-2 w-[10%] text-center">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {cart.map((item, index) => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3">{index + 1}</td>
                                            <td className="px-4 py-3 font-semibold truncate">{item.name}</td>
                                            <td className="px-4 py-3"><input type="number" value={item.quantity} min="1" onChange={(e) => handleUpdateQuantity(item.id, e.target.value)} className="w-20 mx-auto text-center bg-slate-100 dark:bg-slate-700 rounded-md p-1 border-slate-300 dark:border-slate-600"/></td>
                                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                                            <td className="px-4 py-3 text-center"><button onClick={() => handleRemoveFromCart(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5 mx-auto"/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {cart.length === 0 && (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500"><FileText className="w-24 h-24 mb-4"/><p className="font-medium text-lg">Hóa đơn trống</p></div>)}
                        </div>
                        <div className="flex-shrink-0 pt-4 mt-auto flex items-center gap-2">
                            <button onClick={() => setShowCalculator(true)} className="btn-action-outline"><Calculator size={18}/>Máy tính</button>
                            <button onClick={() => setShowProductLookup(true)} className="btn-action-outline"><Search size={18}/>Tra cứu</button>
                            <button onClick={() => { if(cart.length > 0) { setLastReceiptData({ items: cart, customer: currentCustomer, subtotal, tax, discountAmount, totalAfterDiscount, createdBy: user?.displayName, createdAt: new Date(), storeInfo }); setShowReceiptModal(true); }}} disabled={cart.length === 0} className="btn-action-outline disabled:opacity-50"><Printer size={18}/>In tạm</button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col h-screen bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700">
                   <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 flex justify-between items-center">
                        <h2 className="text-lg font-bold">Danh mục sản phẩm</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button onClick={() => setShowNotifications(prev => !prev)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Thông báo">
                                    <Bell size={20}/>
                                    {undismissedNotifications.length > 0 && (<span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800/50"></span>)}
                                </button>
                                <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} notifications={undismissedNotifications} onDismiss={handleDismissNotification} />
                            </div>
                            <a href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><LogOut size={16}/><span>Trang quản lý</span></a>
                        </div>
                   </div>
                   <div className="p-2 flex items-center gap-2 overflow-x-auto pb-2 flex-nowrap border-b border-slate-200 dark:border-slate-700 flex-shrink-0">{categories.map(category => (<button key={category} onClick={() => handleCategoryFilter(category)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${activeCategory === category ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700'}`}>{category === 'all' ? 'Tất cả' : category}</button>))}</div>
                   <div className="flex-grow p-4 overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                            {dataLoading ? (
                                Array.from({ length: 18 }).map((_, i) => <ProductSkeleton key={i} />)
                            ) : (
                                filteredProducts.map(product => (
                                    <div key={product.id} onClick={product.stock > 0 ? () => handleAddToCart(product) : undefined} className={`relative bg-white dark:bg-slate-800 rounded-lg p-3 flex flex-col items-center text-center transform transition-all duration-200 shadow-md ${product.stock > 0 ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'opacity-50 grayscale cursor-not-allowed'}`}>
                                        {product.stock <= 0 && (<span className="absolute top-2 right-2 badge badge-destructive z-10">Hết hàng</span>)}
                                        <Image src={product.imageUrl || 'https://placehold.co/80x80/e2e8f0/64748b?text=Ảnh'} alt={product.name} width={80} height={80} className="w-20 h-20 object-cover rounded-md mb-2"/>
                                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-grow">{product.name}</div>
                                        <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-2">{formatCurrency(product.price)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                   </div>
                </div>

                <div className="w-[420px] flex-shrink-0 bg-white dark:bg-slate-800 flex flex-col h-screen">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700"><CustomerPanel customer={currentCustomer} onAction={(action) => action === 'open_modal' ? setShowCustomerModal(true) : setCurrentCustomer(null)} /></div>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-bold mb-2 text-sm uppercase text-slate-500">Hóa đơn đang giữ</h3><div className="flex items-center gap-2 overflow-x-auto pb-2">{heldBills.length === 0 ? (<p className="text-xs text-slate-400">Chưa có hóa đơn.</p>) : (heldBills.map(bill => (<button key={bill.id} onClick={() => handleRestoreBill(bill.id)} className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-left w-40 flex-shrink-0"><p className="font-bold text-sm truncate">{bill.customer?.name || 'Khách lẻ'}</p><p className="text-xs text-indigo-500 font-semibold">{formatCurrency(bill.total)}</p><p className="text-xs text-slate-400">{new Date(bill.time).toLocaleTimeString('vi-VN')}</p></button>)))}</div></div>
                    <div className="flex-grow p-4 space-y-3 overflow-y-auto">
                        <div className="flex justify-between items-center"><span className="text-slate-600 dark:text-slate-300">Tổng tiền hàng</span><span className="font-semibold text-lg">{formatCurrency(subtotal)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600 dark:text-slate-300">VAT (10%)</span><span className="font-semibold text-lg">{formatCurrency(tax)}</span></div>
                        {currentCustomer && (<div className="space-y-2 py-2 border-t border-dashed dark:border-slate-700"><label className="font-semibold text-sm block">Sử dụng điểm ({currentCustomer.points || 0})</label><input type="text" value={pointsToUse} onChange={(e) => setPointsToUse(e.target.value.replace(/[^\d]/g, ''))} className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg p-2 text-lg font-bold text-right" placeholder="0"/>{discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Giảm giá:</span><span className="font-semibold">- {formatCurrency(discountAmount)}</span></div>}</div>)}
                        <div className="my-3 py-3 border-t border-b border-dashed dark:border-slate-600"><div className="flex justify-between items-center text-2xl font-bold"><span>Khách cần trả</span><span className="text-indigo-500">{formatCurrency(totalAfterDiscount)}</span></div></div>
                        <div className="space-y-2"><label htmlFor="cash-received" className="font-semibold">Tiền khách đưa</label><input type="text" id="cash-received" value={cashReceived} onChange={(e) => setCashReceived(new Intl.NumberFormat('vi-VN').format(parseCurrency(e.target.value)) || '')} className="w-full bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-2xl font-bold text-right" placeholder="0"/></div>
                        <div className="grid grid-cols-3 gap-2 pt-2">{[10000, 20000, 50000, 100000, 200000, 500000].map(value => (<button key={value} onClick={() => handleDenominationClick(value)} className="text-sm font-semibold py-2 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">{new Intl.NumberFormat('vi-VN').format(value)}</button>))}<button onClick={handleClearCashReceived} className="col-span-3 text-sm font-semibold py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900 transition-colors">Xóa</button></div>
                        <div className="flex justify-between items-center text-xl font-bold text-green-600 dark:text-green-400"><span>Tiền thừa</span><span>{formatCurrency(changeAmount)}</span></div>
                    </div>
                    <div className="p-4 mt-auto bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <button onClick={() => setActivePaymentMethod('cash')} className={`btn-payment ${activePaymentMethod === 'cash' ? 'active' : ''}`}><Wallet size={18}/>Tiền mặt</button>
                            <button onClick={() => setActivePaymentMethod('qr')} className={`btn-payment ${activePaymentMethod === 'qr' ? 'active' : ''}`}><QrCode size={18}/>Quét mã QR</button>
                        </div>
                        <div className="flex gap-3 mb-3"><button onClick={handleHoldBill} disabled={cart.length === 0} className="flex-1 btn-action-outline bg-amber-500/10 border-amber-500 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50"><PauseCircle size={18}/>Giữ hóa đơn</button></div>
                        <button id="payment-button" onClick={initiateCheckout} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-indigo-700 disabled:bg-slate-400"><div className="flex items-center justify-center gap-3"><CheckCircle size={20}/><span>THANH TOÁN (F9)</span></div></button>
                    </div>
                </div>
            </main>

            <Toast message={toast.message} show={toast.show} />
            <CalculatorModal show={showCalculator} onClose={() => setShowCalculator(false)} />
            <ProductLookupModal show={showProductLookup} onClose={() => setShowProductLookup(false)} products={allProducts} onProductSelect={handleAddToCart} />
            <CustomerModal show={showCustomerModal} onClose={() => setShowCustomerModal(false)} customers={customers} onSelectCustomer={setCurrentCustomer} onAddNewCustomer={handleAddNewCustomer} />
            <ReceiptModal show={showReceiptModal} onClose={() => { setShowReceiptModal(false); setLastReceiptData(null); }} data={lastReceiptData} />
            {/* 🚨 TRUYỀN payosStatus VÀO ĐÂY 🚨 */}
            <QrPaymentModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} amount={totalAfterDiscount} checkoutUrl={paymentLinkData?.checkoutUrl} qrCode={paymentLinkData?.qrCode} status={payosStatus} />
        </>
    );
}
