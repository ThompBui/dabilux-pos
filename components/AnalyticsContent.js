import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { collection, onSnapshot } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import {
    BarChart2, DollarSign, ShoppingCart, TrendingUp, Package, Tag, Users, CreditCard, Calendar, ChevronDown
} from 'lucide-react';
import Sidebar from './Sidebar';

// TỐI ƯU: Lazy load các component biểu đồ
const DynamicResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const DynamicLineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const DynamicLine = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const DynamicXAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const DynamicYAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const DynamicCartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const DynamicTooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const DynamicLegend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const DynamicBarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const DynamicBar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const DynamicPieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const DynamicPie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const DynamicCell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false }); 

// --- CÁC HÀM HỖ TRỢ ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const SectionTitle = ({ title, icon }) => (
    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        {icon} {title}
    </h2>
);

const calculatePeriodData = (allBills, period, referenceDate) => {
    let periodBills = [];
    const refDate = new Date(referenceDate);

    if (!allBills) return { revenue: 0, transactions: 0, profit: 0, avgValue: 0 };

    periodBills = allBills.filter(bill => {
        const billDate = bill.createdAt instanceof Date ? bill.createdAt : bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
        if (!billDate || isNaN(billDate.getTime())) return false;
        billDate.setHours(0, 0, 0, 0);
        const tempRefDate = new Date(refDate);
        tempRefDate.setHours(0, 0, 0, 0);

        if (period === 'Hôm nay') return billDate.getTime() === tempRefDate.getTime();
        if (period === 'Hôm qua') {
            const yesterday = new Date(tempRefDate);
            yesterday.setDate(tempRefDate.getDate() - 1);
            return billDate.getTime() === yesterday.getTime();
        }
        if (period === 'Tuần này') {
            const startOfWeek = new Date(tempRefDate);
            startOfWeek.setDate(tempRefDate.getDate() - tempRefDate.getDay());
            return billDate >= startOfWeek;
        }
        if (period === 'Tuần trước') {
            const startOfLastWeek = new Date(tempRefDate);
            startOfLastWeek.setDate(tempRefDate.getDate() - tempRefDate.getDay() - 7);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
            endOfLastWeek.setHours(23, 59, 59, 999);
            return billDate >= startOfLastWeek && billDate <= endOfLastWeek;
        }
        if (period === 'Tháng này') return billDate.getMonth() === tempRefDate.getMonth() && billDate.getFullYear() === tempRefDate.getFullYear();
        if (period === 'Tháng trước') {
            const lastMonth = new Date(tempRefDate);
            lastMonth.setMonth(tempRefDate.getMonth() - 1);
            return billDate.getMonth() === lastMonth.getMonth() && billDate.getFullYear() === lastMonth.getFullYear();
        }
        if (period === 'Năm này') return billDate.getFullYear() === tempRefDate.getFullYear();
        if (period === 'Năm trước') return billDate.getFullYear() === tempRefDate.getFullYear() - 1;
        return false;
    });

    const revenue = periodBills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || bill.total || 0), 0);
    const transactions = periodBills.length;
    const profit = periodBills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || bill.total || 0) * 0.3, 0);
    const avgValue = transactions > 0 ? revenue / transactions : 0;
    return { revenue, transactions, profit, avgValue };
};

// --- COMPONENT CHÍNH ---
export default function AnalyticsContent() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    const [bills, setBills] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [billsLoaded, setBillsLoaded] = useState(false);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [customersLoaded, setCustomersLoaded] = useState(false);
    const [dataError, setDataError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPeriod, setCurrentPeriod] = useState('Hôm nay');
    const dataLoading = useMemo(() => !(billsLoaded && productsLoaded && customersLoaded), [billsLoaded, productsLoaded, customersLoaded]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const unsubBills = onSnapshot(collection(db, 'bills'), (s) => { setBills(s.docs.map(d => ({ id: d.id, ...d.data() }))); setBillsLoaded(true); }, (e) => { setDataError(e); setBillsLoaded(true); });
        const unsubProducts = onSnapshot(collection(db, 'products'), (s) => { setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))); setProductsLoaded(true); }, (e) => { setDataError(e); setProductsLoaded(true); });
        const unsubCustomers = onSnapshot(collection(db, 'customers'), (s) => { setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() }))); setCustomersLoaded(true); }, (e) => { setDataError(e); setCustomersLoaded(true); });
        return () => { unsubBills(); unsubProducts(); unsubCustomers(); };
    }, []);

    const {
        dailyRevenueChartData, categorySalesData, topSellingProductsChartData,
        customerSpendingChartData, currentPeriodRevenue, previousPeriodRevenue, revenueChangePercentage,
        currentPeriodTransactions, previousPeriodTransactions, transactionsChangePercentage,
        currentPeriodAvgValue, previousPeriodAvgValue, avgValueChangePercentage,
        currentPeriodProfit, previousPeriodProfit, profitChangePercentage
    } = useMemo(() => {
        if (!billsLoaded || !productsLoaded || !customersLoaded) return { dailyRevenueChartData: [], categorySalesData: [], topSellingProductsChartData: [], customerSpendingChartData: [], currentPeriodRevenue: 0, previousPeriodRevenue: 0, revenueChangePercentage: 0, currentPeriodTransactions: 0, previousPeriodTransactions: 0, transactionsChangePercentage: 0, currentPeriodAvgValue: 0, previousPeriodAvgValue: 0, avgValueChangePercentage: 0, currentPeriodProfit: 0, previousPeriodProfit: 0, profitChangePercentage: 0 };
        
        const now = new Date();
        const currentData = calculatePeriodData(bills, currentPeriod, now);
        const { revenue: currentRev, transactions: currentTrans, avgValue: currentAvg, profit: currentProf } = currentData;

        let previousPeriodType = null;
        if (currentPeriod === 'Hôm nay') previousPeriodType = 'Hôm qua';
        else if (currentPeriod === 'Tuần này') previousPeriodType = 'Tuần trước';
        else if (currentPeriod === 'Tháng này') previousPeriodType = 'Tháng trước';
        else if (currentPeriod === 'Năm này') previousPeriodType = 'Năm trước';

        let previousRev = 0, previousTrans = 0, previousAvg = 0, previousProf = 0;
        if (previousPeriodType) {
            const previousData = calculatePeriodData(bills, previousPeriodType, now);
            previousRev = previousData.revenue;
            previousTrans = previousData.transactions;
            previousAvg = previousData.avgValue;
            previousProf = previousData.profit;
        }

        const calculatePercentageChange = (current, previous) => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
        const revChange = calculatePercentageChange(currentRev, previousRev);
        const transChange = calculatePercentageChange(currentTrans, previousTrans);
        const avgChange = calculatePercentageChange(currentAvg, previousAvg);
        const profChange = calculatePercentageChange(currentProf, previousProf);

        let filteredBillsForCharts = bills;
        if (startDate) filteredBillsForCharts = filteredBillsForCharts.filter(b => (b.createdAt?.toDate() || new Date(b.createdAt)) >= new Date(startDate));
        if (endDate) {
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            filteredBillsForCharts = filteredBillsForCharts.filter(b => (b.createdAt?.toDate() || new Date(b.createdAt)) <= end);
        }

        const dailySalesMap = {};
        filteredBillsForCharts.forEach(bill => {
            const dateKey = (bill.createdAt?.toDate() || new Date(bill.createdAt)).toISOString().split('T')[0];
            dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + (bill.totalAfterDiscount || bill.total || 0);
        });
        const aggregatedDailyRevenue = Object.keys(dailySalesMap).sort().map(date => ({ date, DoanhThu: dailySalesMap[date] }));

        const categorySalesMap = {};
        filteredBillsForCharts.forEach(b => (b.items || []).forEach(i => {
            categorySalesMap[i.category || 'N/A'] = (categorySalesMap[i.category || 'N/A'] || 0) + (i.price * i.quantity || 0);
        }));
        const aggregatedCategorySales = Object.keys(categorySalesMap).map(c => ({ name: c, value: categorySalesMap[c] })).sort((a, b) => b.value - a.value);

        const productQuantityMap = {};
        filteredBillsForCharts.forEach(b => (b.items || []).forEach(i => {
            productQuantityMap[i.id] = productQuantityMap[i.id] || { name: i.name, quantity: 0 };
            productQuantityMap[i.id].quantity += i.quantity;
        }));
        const sortedTopSellingProducts = Object.values(productQuantityMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5).map(p => ({ name: p.name, SốLượng: p.quantity }));

        const customerSpentMap = {};
        filteredBillsForCharts.forEach(b => {
            if (b.customer?.id) {
                customerSpentMap[b.customer.id] = customerSpentMap[b.customer.id] || { name: b.customer.name, totalSpent: 0 };
                customerSpentMap[b.customer.id].totalSpent += (b.totalAfterDiscount || b.total || 0);
            }
        });
        const sortedCustomerSpending = Object.values(customerSpentMap).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5).map(c => ({ name: c.name, ChiTiêu: c.totalSpent }));

        return { dailyRevenueChartData: aggregatedDailyRevenue, categorySalesData: aggregatedCategorySales, topSellingProductsChartData: sortedTopSellingProducts, customerSpendingChartData: sortedCustomerSpending, currentPeriodRevenue: currentRev, previousPeriodRevenue: previousRev, revenueChangePercentage: revChange, currentPeriodTransactions: currentTrans, previousPeriodTransactions: previousTrans, transactionsChangePercentage: transChange, currentPeriodAvgValue: currentAvg, previousPeriodAvgValue: previousAvg, avgValueChangePercentage: avgChange, currentPeriodProfit: currentProf, previousPeriodProfit: previousProf, profitChangePercentage: profChange };
    }, [bills, products, customers, startDate, endDate, currentPeriod, billsLoaded, productsLoaded, customersLoaded]);

    const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];
    const formatChange = (percentage) => `${percentage > 0 ? '↑' : '↓'} ${Math.abs(percentage).toFixed(1)}%`;

    if (authLoading || dataLoading) return <div className="flex items-center justify-center h-screen"><p>Đang tải dữ liệu...</p></div>;
    if (dataError) return <div className="flex items-center justify-center h-screen text-red-500"><p>Lỗi: {dataError.message}</p></div>;
    if (!user) return null;

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Phân tích Dữ liệu</h1>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <select value={currentPeriod} onChange={(e) => setCurrentPeriod(e.target.value)} className="input-field appearance-none pr-8">
                                <option>Hôm nay</option><option>Tuần này</option><option>Tháng này</option><option>Năm này</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="flex space-x-4">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card">
                        <div className="p-3 rounded-full bg-indigo-100 text-indigo-600"><DollarSign size={24} /></div>
                        <div><p className="text-sm text-slate-500">Tổng doanh thu</p><h3 className="text-2xl font-bold">{formatCurrency(currentPeriodRevenue)}</h3>{previousPeriodRevenue > 0 && <p className={`text-xs ${revenueChangePercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatChange(revenueChangePercentage)}</p>}</div>
                    </div>
                    <div className="stat-card">
                        <div className="p-3 rounded-full bg-green-100 text-green-600"><ShoppingCart size={24} /></div>
                        <div><p className="text-sm text-slate-500">Giao dịch</p><h3 className="text-2xl font-bold">{currentPeriodTransactions.toLocaleString()}</h3>{previousPeriodTransactions > 0 && <p className={`text-xs ${transactionsChangePercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatChange(transactionsChangePercentage)}</p>}</div>
                    </div>
                    <div className="stat-card">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600"><CreditCard size={24} /></div>
                        <div><p className="text-sm text-slate-500">GT TB/Giao dịch</p><h3 className="text-2xl font-bold">{formatCurrency(currentPeriodAvgValue)}</h3>{previousPeriodAvgValue > 0 && <p className={`text-xs ${avgValueChangePercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatChange(avgValueChangePercentage)}</p>}</div>
                    </div>
                    <div className="stat-card">
                        <div className="p-3 rounded-full bg-orange-100 text-orange-600"><TrendingUp size={24} /></div>
                        <div><p className="text-sm text-slate-500">Lợi nhuận gộp</p><h3 className="text-2xl font-bold">{formatCurrency(currentPeriodProfit)}</h3>{previousPeriodProfit > 0 && <p className={`text-xs ${profitChangePercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatChange(profitChangePercentage)}</p>}</div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="card">
                        <SectionTitle title="Doanh thu theo ngày" icon={<BarChart2 size={20} />} />
                        <div className="h-72">
                            <DynamicResponsiveContainer width="100%" height="100%">
                                <DynamicLineChart data={dailyRevenueChartData}>
                                    <DynamicCartesianGrid strokeDasharray="3 3" />
                                    <DynamicXAxis dataKey="date" />
                                    <DynamicYAxis tickFormatter={formatCurrency} />
                                    <DynamicTooltip formatter={(v) => formatCurrency(v)} />
                                    <DynamicLegend />
                                    <DynamicLine type="monotone" dataKey="DoanhThu" stroke="#8884d8" />
                                </DynamicLineChart>
                            </DynamicResponsiveContainer>
                        </div>
                    </div>
                    <div className="card">
                        <SectionTitle title="Doanh thu theo danh mục" icon={<Tag size={20} />} />
                        <div className="h-72">
                            <DynamicResponsiveContainer width="100%" height="100%">
                                <DynamicPieChart>
                                    <DynamicPie data={categorySalesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {categorySalesData.map((entry, index) => <DynamicCell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />)}
                                    </DynamicPie>
                                    <DynamicTooltip formatter={(v) => formatCurrency(v)} />
                                    <DynamicLegend />
                                </DynamicPieChart>
                            </DynamicResponsiveContainer>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="card">
                        <SectionTitle title="Sản phẩm bán chạy" icon={<Package size={20} />} />
                        <div className="h-72">
                            <DynamicResponsiveContainer width="100%" height="100%">
                                <DynamicBarChart data={topSellingProductsChartData}>
                                    <DynamicCartesianGrid strokeDasharray="3 3" />
                                    <DynamicXAxis dataKey="name" angle={-15} textAnchor="end" height={50} interval={0} />
                                    <DynamicYAxis />
                                    <DynamicTooltip />
                                    <DynamicLegend />
                                    <DynamicBar dataKey="SốLượng" fill="#82ca9d" />
                                </DynamicBarChart>
                            </DynamicResponsiveContainer>
                        </div>
                    </div>
                    <div className="card">
                        <SectionTitle title="Khách hàng chi tiêu nhiều" icon={<Users size={20} />} />
                        <div className="h-72">
                            <DynamicResponsiveContainer width="100%" height="100%">
                                <DynamicBarChart data={customerSpendingChartData}>
                                    <DynamicCartesianGrid strokeDasharray="3 3" />
                                    <DynamicXAxis dataKey="name" angle={-15} textAnchor="end" height={50} interval={0} />
                                    <DynamicYAxis tickFormatter={formatCurrency} />
                                    <DynamicTooltip formatter={(v) => formatCurrency(v)} />
                                    <DynamicLegend />
                                    <DynamicBar dataKey="ChiTiêu" fill="#ffc658" />
                                </DynamicBarChart>
                            </DynamicResponsiveContainer>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}