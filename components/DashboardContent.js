// components/DashboardContent.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar'; // Đã điều chỉnh đường dẫn
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/router';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Users, AlertTriangle, Tag, CreditCard, Calendar as CalendarIcon, BarChart } from 'lucide-react';
import dynamic from 'next/dynamic'; 
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// --- HÀM HỖ TRỢ ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const calculateStats = (bills) => {
    if (!bills || bills.length === 0) return { revenue: 0, transactions: 0, avgValue: 0, profit: 0 };
    const revenue = bills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || 0), 0);
    const transactions = bills.length;
    const avgValue = transactions > 0 ? revenue / transactions : 0;
    const profit = bills.reduce((sum, bill) => {
        const billProfit = (bill.items || []).reduce((itemSum, item) => {
            const cost = item.lastImportPrice || item.price * 0.7; // Giả định lợi nhuận gộp nếu không có giá nhập
            return itemSum + ((item.price * item.quantity) - (cost * item.quantity));
        }, 0);
        return sum + billProfit;
    }, 0);
    return { revenue, transactions, avgValue, profit };
};

const SectionTitle = ({ title, icon }) => (
    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        {icon} {title}
    </h2>
);

// --- COMPONENT CON ---
const StatCard = ({ title, value, icon, iconBgColor }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${iconBgColor}`}>{icon}</div>
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3>
        </div>
    </div>
);


// --- COMPONENT CHÍNH ---
export default function DashboardContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    const [bills, setBills] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    // Khai báo dataLoading ĐÚNG VỊ TRÍ, bên trong component
    const [dataLoading, setDataLoading] = useState(true); 

    const defaultRange = { from: new Date(new Date().setHours(0, 0, 0, 0)), to: new Date(new Date().setHours(23, 59, 59, 999)) };
    const [tempRange, setTempRange] = useState(defaultRange);
    const [activeRange, setActiveRange] = useState(defaultRange);
    const [activePreset, setActivePreset] = useState('today');

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef(null);
    
    // Logic xác thực và chuyển hướng
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                if (router.pathname !== '/login') {
                    console.log("AUTH: Chuyển hướng đến /login");
                    router.push('/login');
                }
            } else {
                console.log("AUTH: Người dùng đã đăng nhập:", user.email);
            }
        } else {
            console.log("AUTH: Đang tải trạng thái xác thực...");
        }
    }, [user, authLoading, router]);

    // Lắng nghe dữ liệu Firestore
     useEffect(() => {
        console.log("DATA: Bắt đầu lắng nghe Firestore data...");
        const unsubscribers = [
            onSnapshot(query(collection(db, 'bills'), orderBy('createdAt', 'desc')), (snapshot) => {
                setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                console.log("DATA: Bills đã tải:", snapshot.docs.length);
            }, (error) => {
                console.error("DATA: Lỗi khi lấy bills:", error);
            }),
            onSnapshot(query(collection(db, 'products'), orderBy('name', 'asc')), (snapshot) => {
                setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                console.log("DATA: Products đã tải:", snapshot.docs.length);
            }, (error) => {
                console.error("DATA: Lỗi khi lấy products:", error);
            }),
            onSnapshot(query(collection(db, 'customers'), orderBy('name', 'asc')), (snapshot) => {
                setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                console.log("DATA: Customers đã tải:", snapshot.docs.length);
            }, (error) => {
                console.error("DATA: Lỗi khi lấy customers:", error);
            }),
        ];

        const initialLoadTimeout = setTimeout(() => {
            setDataLoading(false);
            console.log("DATA: dataLoading chuyển sang FALSE sau Timeout.");
        }, 3000); // 3 giây để đảm bảo dữ liệu Firebase có thời gian tải

        return () => {
            unsubscribers.forEach(unsub => unsub());
            clearTimeout(initialLoadTimeout);
            console.log("DATA: Unsubscribe và clearTimeout đã chạy.");
        };
    }, []);
    
    // Xử lý đóng date picker khi click bên ngoài
    useEffect(() => {
        function handleClickOutside(event) { if (pickerRef.current && !pickerRef.current.contains(event.target)) setIsPickerOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [pickerRef]);

    const memoizedData = useMemo(() => {
        if (dataLoading) return null; // Tránh tính toán khi chưa tải xong
        
        const { from, to } = activeRange;
        const toDateWithTime = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date(new Date(from).setHours(23, 59, 59, 999));
        
        const filteredBills = bills.filter(b => {
            const billDate = b.createdAt?.toDate();
            return billDate && billDate >= from && billDate <= toDateWithTime;
        });

        const currentStats = calculateStats(filteredBills);

        const dailySalesMap = {};
        filteredBills.forEach(bill => {
            const billDate = bill.createdAt?.toDate();
            if (billDate) {
                const dateKey = format(billDate, 'dd/MM', { locale: vi });
                dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + (bill.totalAfterDiscount || 0);
            }
        });
        const chartData = Object.keys(dailySalesMap)
            .sort((a, b) => {
                const [dayA, monthA] = a.split('/');
                const [dayB, monthB] = b.split('/');
                const dateA = new Date(new Date().getFullYear(), monthA - 1, dayA);
                const dateB = new Date(new Date().getFullYear(), monthB - 1, dayB);
                return dateA.getTime() - dateB.getTime();
            })
            .map(date => ({ date, DoanhThu: dailySalesMap[date] }));

        const productSales = {};
        filteredBills.forEach(bill => {
            (bill.items || []).forEach(item => {
                productSales[item.id] = productSales[item.id] || { name: item.name, totalQuantity: 0, totalRevenue: 0 };
                productSales[item.id].totalQuantity += item.quantity;
                productSales[item.id].totalRevenue += item.quantity * (item.price || 0);
            });
        });
        const topSellingProducts = Object.values(productSales).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

        const customerSpending = {};
        filteredBills.forEach(bill => {
            if (bill.customer?.id) {
                customerSpending[bill.customer.id] = customerSpending[bill.customer.id] || { name: bill.customer.name, totalSpent: 0 };
                customerSpending[bill.customer.id].totalSpent += bill.totalAfterDiscount || 0;
            }
        });
        const topCustomers = Object.entries(customerSpending).map(([id, data]) => {
            const customerInfo = customers.find(c => c.id === id);
            return { id, ...data, points: customerInfo?.points || 0 };
        }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

        const lowStockItems = products.filter(p => p.stock !== undefined && p.stock < 10 && p.isActive !== false).slice(0, 5);

        return { currentStats, topSellingProducts, lowStockItems, topCustomers, chartData };
    }, [bills, products, customers, activeRange, dataLoading]);


    // HIỂN THỊ MÀN HÌNH TẢI HOẶC NULL KHI CHƯA SẴN SÀNG
    // Khối kiểm tra này đã được tối ưu và là khối duy nhất
    if (authLoading || dataLoading || !memoizedData) {
        console.log("RENDER: Hiển thị màn hình tải. authLoading:", authLoading, "dataLoading:", dataLoading, "memoizedData:", memoizedData);
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <p className="text-lg font-semibold">Đang tải dữ liệu...</p>
            </div>
        );
    }

    if (!user) { // Sau khi authLoading và dataLoading đã false
        console.log("RENDER: Không có người dùng, trả về null.");
        return null;
    }

    const handleFilter = () => {
        setActiveRange(tempRange);
        setActivePreset('custom');
        setIsPickerOpen(false);
    }

    const handlePresetFilter = (preset) => {
        const now = new Date();
        let fromDate = new Date();
        let toDate = new Date();

        if (preset === 'today') {
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
        } else if (preset === 'thisWeek') {
            const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
            fromDate.setDate(now.getDate() - dayOfWeek);
            fromDate.setHours(0, 0, 0, 0);
        } else if (preset === 'thisMonth') {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (preset === 'thisYear') {
            fromDate = new Date(now.getFullYear(), 0, 1);
        }
        
        const newRange = { from: fromDate, to: toDate };
        setActiveRange(newRange);
        setTempRange(newRange);
        setActivePreset(preset);
    };

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Tổng quan cửa hàng</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* CÁC NÚT LỌC NHANH */}
                        <button onClick={() => handlePresetFilter('today')} className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${activePreset === 'today' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700'}`}>Hôm nay</button>
                        <button onClick={() => handlePresetFilter('thisWeek')} className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${activePreset === 'thisWeek' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700'}`}>Tuần này</button>
                        <button onClick={() => handlePresetFilter('thisMonth')} className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${activePreset === 'thisMonth' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700'}`}>Tháng này</button>
                        <button onClick={() => handlePresetFilter('thisYear')} className={`px-3 py-1.5 text-sm rounded-lg font-semibold ${activePreset === 'thisYear' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700'}`}>Năm nay</button>
                        <div className="relative" ref={pickerRef}>
                            <button onClick={() => setIsPickerOpen(!isPickerOpen)} className={`btn-action-outline w-full md:w-auto ${activePreset === 'custom' ? 'ring-2 ring-indigo-500' : ''}`}>
                                <CalendarIcon size={16}/>
                                <span>Tùy chỉnh</span>
                            </button>
                            {isPickerOpen && (
                                <div className="absolute top-full right-0 mt-2 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 p-4">
                                    <DayPicker mode="range" selected={tempRange} onSelect={setTempRange} locale={vi} showOutsideDays fixedWeeks />
                                    <div className="flex justify-end gap-2 border-t dark:border-slate-700 pt-4 mt-2">
                                        <button onClick={() => setIsPickerOpen(false)} className="btn-action-outline">Hủy</button>
                                        <button onClick={handleFilter} className="btn-action bg-indigo-600 text-white">Lọc</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <p className="text-slate-500 mb-8">
                    Hiển thị dữ liệu từ <span className="font-semibold text-indigo-500">{format(activeRange.from, "dd/MM/yyyy")}</span> đến <span className="font-semibold text-indigo-500">{format(activeRange.to, "dd/MM/yyyy")}</span>
                </p>

                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard title="Tổng doanh thu" value={formatCurrency(memoizedData.currentStats.revenue)} icon={<DollarSign size={24} className="text-indigo-500"/>} iconBgColor="bg-indigo-100 dark:bg-indigo-900/50" />
                    <StatCard title="Số lượng giao dịch" value={memoizedData.currentStats.transactions.toLocaleString()} icon={<ShoppingCart size={24} className="text-sky-500"/>} iconBgColor="bg-sky-100 dark:bg-sky-900/50" />
                    <StatCard title="Giá trị TB/Giao dịch" value={formatCurrency(memoizedData.currentStats.avgValue)} icon={<CreditCard size={24} className="text-green-500"/>} iconBgColor="bg-green-100 dark:bg-green-900/50" />
                    <StatCard title="Lợi nhuận (tạm tính)" value={formatCurrency(memoizedData.currentStats.profit)} icon={<TrendingUp size={24} className="text-amber-500"/>} iconBgColor="bg-amber-100 dark:bg-amber-900/50" />
                </section>

                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                    <SectionTitle title="Biểu đồ Doanh thu (Theo Ngày)" icon={<BarChart size={20} />} />
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={memoizedData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value)}/>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Line type="monotone" dataKey="DoanhThu" name="Doanh thu" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Sản phẩm bán chạy nhất" icon={<Tag size={20} />} />
                        <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2">Tên SP</th><th className="px-4 py-2 text-center">SL bán</th><th className="px-4 py-2 text-right">Doanh thu</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.topSellingProducts.length > 0 ? (memoizedData.topSellingProducts.map((p, i) => (<tr key={i}><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3 text-center">{p.totalQuantity}</td><td className="px-4 py-3 text-right">{formatCurrency(p.totalRevenue)}</td></tr>))) : (<tr><td colSpan="3" className="text-center py-4 text-slate-400">Không có dữ liệu.</td></tr>)}</tbody></table></div>
                    </section>
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Sản phẩm sắp hết hàng" icon={<AlertTriangle size={20} className="text-orange-500" />} />
                        <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2">Tên SP</th><th className="px-4 py-2 text-center">Tồn kho</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.lowStockItems.length > 0 ? (memoizedData.lowStockItems.map(item => (<tr key={item.id}><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-center text-orange-500 font-bold">{item.stock}</td></tr>))) : (<tr><td colSpan="2" className="text-center py-4 text-slate-400">Không có sản phẩm nào.</td></tr>)}</tbody></table></div>
                    </section>
                </div>
                
                <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                    <SectionTitle title="Khách hàng thân thiết hàng đầu" icon={<Users size={20} />} />
                    <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2">Tên KH</th><th className="px-4 py-2 text-center">Điểm</th><th className="px-4 py-2 text-right">Tổng chi tiêu</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.topCustomers.length > 0 ? (memoizedData.topCustomers.map(customer => (<tr key={customer.id}><td className="px-4 py-3 font-medium">{customer.name}</td><td className="px-4 py-3 text-center">{customer.points}</td><td className="px-4 py-3 text-right">{formatCurrency(customer.totalSpent)}</td></tr>))) : (<tr><td colSpan="3" className="text-center py-4 text-slate-400">Không có dữ liệu.</td></tr>)}</tbody></table></div>
                </section>
            </main>
        </div>
    );
}