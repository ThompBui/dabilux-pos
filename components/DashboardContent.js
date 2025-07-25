import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase-client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  DollarSign, ShoppingCart, TrendingUp, Users,
  AlertTriangle, Tag, CreditCard, Calendar as CalendarIcon, BarChart, Loader2
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { vi } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// Lazy load các component biểu đồ
const DynamicResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const DynamicLineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const DynamicLine = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const DynamicXAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const DynamicYAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const DynamicCartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const DynamicTooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const DynamicLegend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

// === CÁC COMPONENT & HÀM HỖ TRỢ ===
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
const SectionTitle = ({ title, icon }) => ( <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">{icon} {title}</h2> );
const StatCard = ({ title, value, icon, iconBgColor }) => ( <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4"><div className={`p-3 rounded-full ${iconBgColor}`}>{icon}</div><div><p className="text-sm text-slate-500 dark:text-slate-400">{title}</p><h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3></div></div> );

// === COMPONENT CHÍNH ===
export default function DashboardContent() {
  const [user, authLoading, authError] = useAuthState(auth);
  const router = useRouter();

  // States cho dữ liệu
  const [allBills, setAllBills] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  
  // States cho việc tải và hiển thị
  const [dataLoading, setDataLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Đang xác thực người dùng...");

  // States cho bộ lọc ngày
  const defaultRange = { from: startOfDay(new Date()), to: endOfDay(new Date()) };
  const [activeRange, setActiveRange] = useState(defaultRange);
  const [activePreset, setActivePreset] = useState('today');
  const [tempRange, setTempRange] = useState(defaultRange);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // 1. Xử lý trạng thái đăng nhập
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 2. Tải dữ liệu từ Firestore sau khi có user
  useEffect(() => {
    if (!user) return;

    setStatusMessage("Đang tải dữ liệu...");
    const billsQuery = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
    const productsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
    const customersQuery = query(collection(db, 'customers'), orderBy('name', 'asc'));

    const unsubBills = onSnapshot(billsQuery, (snapshot) => {
      setAllBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDataLoading(false);
    }, (error) => {
      console.error("Lỗi tải hóa đơn:", error);
      setStatusMessage(`Lỗi tải dữ liệu: ${error.message}`);
      setDataLoading(false);
    });

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubCustomers = onSnapshot(customersQuery, (snapshot) => setAllCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    return () => { // Dọn dẹp listeners
      unsubBills();
      unsubProducts();
      unsubCustomers();
    };
  }, [user]);
    
  // Xử lý click bên ngoài cho date picker
  useEffect(() => {
    function handleClickOutside(event) { if (pickerRef.current && !pickerRef.current.contains(event.target)) setIsPickerOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tính toán dữ liệu (dùng useMemo để tối ưu)
  const memoizedData = useMemo(() => {
    const { from, to } = activeRange;
    const toDateWithTime = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date(new Date(from).setHours(23, 59, 59, 999));
    
    const filteredBills = allBills.filter(b => {
        const billDate = b.createdAt?.toDate();
        return billDate && billDate >= from && billDate <= toDateWithTime;
    });

    const revenue = filteredBills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || 0), 0);
    const transactions = filteredBills.length;
    const avgValue = revenue / (transactions || 1);
    const profit = revenue * 0.3; // Tạm tính lợi nhuận 30%

    const productSales = {};
    filteredBills.forEach(bill => (bill.items || []).forEach(item => { 
        productSales[item.id] = productSales[item.id] || { name: item.name, totalQuantity: 0, totalRevenue: 0 };
        productSales[item.id].totalQuantity += item.quantity;
        productSales[item.id].totalRevenue += item.quantity * (item.price || 0);
    }));
    const topSellingProducts = Object.values(productSales).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

    const lowStockItems = allProducts.filter(p => p.stock !== undefined && p.stock < 10 && p.isActive !== false).slice(0, 5);

    const customerSpending = {};
    filteredBills.forEach(bill => {
        if (bill.customer?.id) {
            customerSpending[bill.customer.id] = customerSpending[bill.customer.id] || { id: bill.customer.id, name: bill.customer.name, totalSpent: 0 };
            customerSpending[bill.customer.id].totalSpent += bill.totalAfterDiscount || 0;
        }
    });
    const topCustomers = Object.values(customerSpending).map(data => {
        const customerInfo = allCustomers.find(c => c.id === data.id);
        return { ...data, name: customerInfo?.name || data.name, points: customerInfo?.points || 0 };
    }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

    const dailySalesMap = {};
    filteredBills.forEach(bill => {
        const billDate = bill.createdAt?.toDate();
        if (billDate) {
            const dateKey = format(billDate, 'dd/MM', { locale: vi });
            dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + (bill.totalAfterDiscount || 0);
        }
    });
    const chartData = Object.keys(dailySalesMap).sort((a, b) => {
        const [dayA, monthA] = a.split('/');
        const [dayB, monthB] = b.split('/');
        return (new Date(new Date().getFullYear(), monthA - 1, dayA)).getTime() - (new Date(new Date().getFullYear(), monthB - 1, dayB)).getTime();
    }).map(date => ({ date, DoanhThu: dailySalesMap[date] }));

    return { 
        currentStats: { revenue, transactions, avgValue, profit },
        topSellingProducts, 
        lowStockItems, 
        topCustomers, 
        chartData 
    };
  }, [allBills, allProducts, allCustomers, activeRange]);

  // === Màn hình chờ dứt khoát ===
  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-500 mb-4" />
            <p className="text-slate-500">{statusMessage}</p>
        </div>
      </div>
    );
  }

  // === Xử lý lỗi & Chuyển hướng ===
  if (authError) return <div className="flex items-center justify-center h-screen"><p>Lỗi xác thực: {authError.message}</p></div>;
  if (!user) return null; // Tránh render khi đang chuyển hướng

  // === Các hàm xử lý filter ===
  const handleFilter = () => {
    setActiveRange(tempRange);
    setActivePreset('custom');
    setIsPickerOpen(false);
  };
  
  const handlePresetFilter = (preset) => {
    const now = new Date();
    let fromDate;
    if (preset === 'today') fromDate = startOfDay(now);
    else if (preset === 'thisWeek') fromDate = startOfWeek(now, { weekStartsOn: 1 });
    else if (preset === 'thisMonth') fromDate = startOfMonth(now);
    else if (preset === 'thisYear') fromDate = startOfYear(now);
    else fromDate = startOfDay(now);
    
    const newRange = { from: fromDate, to: endOfDay(now) };
    setActiveRange(newRange);
    setTempRange(newRange);
    setActivePreset(preset);
  };

  // === Giao diện chính ===
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-bold">Tổng quan cửa hàng</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                                <button onClick={() => setIsPickerOpen(false)} className="btn-secondary">Hủy</button>
                                <button onClick={handleFilter} className="btn-primary">Lọc</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <p className="text-slate-500 mb-8">
            Hiển thị dữ liệu từ <span className="font-semibold text-indigo-500">{format(activeRange.from, "dd/MM/yyyy", { locale: vi })}</span> đến <span className="font-semibold text-indigo-500">{format(activeRange.to, "dd/MM/yyyy", { locale: vi })}</span>
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
                <DynamicResponsiveContainer width="100%" height="100%">
                    <DynamicLineChart data={memoizedData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <DynamicCartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <DynamicXAxis dataKey="date" />
                        <DynamicYAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value)}/>
                        <DynamicTooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)', borderRadius: '0.5rem', border: '1px solid rgba(0,0,0,0.1)' }} formatter={(value) => formatCurrency(value)} />
                        <DynamicLegend />
                        <DynamicLine type="monotone" dataKey="DoanhThu" name="Doanh thu" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 8 }} />
                    </DynamicLineChart>
                </DynamicResponsiveContainer>
            </div>
        </section>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <SectionTitle title="Sản phẩm bán chạy nhất" icon={<Tag size={20} />} />
                <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700"><tr className="text-slate-500 dark:text-slate-300"><th className="px-4 py-2 font-semibold text-left">Tên SP</th><th className="px-4 py-2 font-semibold text-center">SL bán</th><th className="px-4 py-2 font-semibold text-right">Doanh thu</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.topSellingProducts.length > 0 ? (memoizedData.topSellingProducts.map((p, i) => (<tr key={i}><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3 text-center">{p.totalQuantity}</td><td className="px-4 py-3 text-right">{formatCurrency(p.totalRevenue)}</td></tr>))) : (<tr><td colSpan="3" className="text-center py-8 text-slate-400">Không có dữ liệu.</td></tr>)}</tbody></table></div>
            </section>
            <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <SectionTitle title="Sản phẩm sắp hết hàng" icon={<AlertTriangle size={20} className="text-orange-500" />} />
                <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700"><tr className="text-slate-500 dark:text-slate-300"><th className="px-4 py-2 font-semibold text-left">Tên SP</th><th className="px-4 py-2 font-semibold text-center">Tồn kho</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.lowStockItems.length > 0 ? (memoizedData.lowStockItems.map(item => (<tr key={item.id}><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-center text-orange-500 font-bold">{item.stock}</td></tr>))) : (<tr><td colSpan="2" className="text-center py-8 text-slate-400">Không có sản phẩm nào.</td></tr>)}</tbody></table></div>
            </section>
        </div>
        
        <section className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <SectionTitle title="Khách hàng thân thiết hàng đầu" icon={<Users size={20} />} />
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700"><tr className="text-slate-500 dark:text-slate-300"><th className="px-4 py-2 font-semibold text-left">Tên KH</th><th className="px-4 py-2 font-semibold text-center">Điểm</th><th className="px-4 py-2 font-semibold text-right">Tổng chi tiêu</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{memoizedData.topCustomers.length > 0 ? (memoizedData.topCustomers.map(customer => (<tr key={customer.id}><td className="px-4 py-3 font-medium">{customer.name}</td><td className="px-4 py-3 text-center">{customer.points}</td><td className="px-4 py-3 text-right">{formatCurrency(customer.totalSpent)}</td></tr>))) : (<tr><td colSpan="3" className="text-center py-8 text-slate-400">Không có dữ liệu.</td></tr>)}</tbody></table></div>
        </section>
      </main>
    </div>
  );
}