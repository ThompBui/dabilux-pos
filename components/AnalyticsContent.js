// components/AnalyticsContent.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase'; // Đảm bảo đường dẫn đúng đến file firebase của bạn
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
    Home, BarChart2, Settings, Users, ShoppingBag, FileText, LogOut,
    DollarSign, ShoppingCart, TrendingUp, Package, Tag, CreditCard, Calendar, ChevronDown
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell // Added BarChart, Bar, PieChart, Pie, Cell for more charts
} from 'recharts';
import Sidebar from './Sidebar'; // Đảm bảo đường dẫn này đúng

// --- UTILITY & SUB-COMPONENTS ---
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const SectionTitle = ({ title, icon }) => (
    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        {icon} {title}
    </h2>
);

// Helper function to calculate data for a specific period relative to a reference date
const calculatePeriodData = (allBills, period, referenceDate) => {
    let periodBills = [];
    const refDate = new Date(referenceDate); // Ensure it's a Date object

    if (!allBills) return { revenue: 0, transactions: 0, profit: 0, avgValue: 0 };

    periodBills = allBills.filter(bill => {
        const billDate = bill.createdAt instanceof Date ? bill.createdAt : bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
        if (!billDate || isNaN(billDate.getTime())) return false;

        // Reset time for accurate date comparisons (start of day)
        billDate.setHours(0, 0, 0, 0);

        const tempRefDate = new Date(refDate); // Use a temporary date for each comparison
        tempRefDate.setHours(0, 0, 0, 0);

        if (period === 'Hôm nay') {
            return billDate.getTime() === tempRefDate.getTime();
        }
        if (period === 'Hôm qua') {
            const yesterday = new Date(tempRefDate);
            yesterday.setDate(tempRefDate.getDate() - 1);
            return billDate.getTime() === yesterday.getTime();
        }
        if (period === 'Tuần này') {
            const startOfWeek = new Date(tempRefDate);
            startOfWeek.setDate(tempRefDate.getDate() - tempRefDate.getDay()); // Sunday as start of week
            return billDate >= startOfWeek;
        }
        if (period === 'Tuần trước') {
            const startOfLastWeek = new Date(tempRefDate);
            startOfLastWeek.setDate(tempRefDate.getDate() - tempRefDate.getDay() - 7);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
            endOfLastWeek.setHours(23, 59, 59, 999); // End of day for end date
            return billDate >= startOfLastWeek && billDate <= endOfLastWeek;
        }
        if (period === 'Tháng này') {
            return billDate.getMonth() === tempRefDate.getMonth() && billDate.getFullYear() === tempRefDate.getFullYear();
        }
        if (period === 'Tháng trước') {
            const lastMonth = new Date(tempRefDate);
            lastMonth.setMonth(tempRefDate.getMonth() - 1);
            return billDate.getMonth() === lastMonth.getMonth() && billDate.getFullYear() === lastMonth.getFullYear();
        }
        if (period === 'Năm này') {
            return billDate.getFullYear() === tempRefDate.getFullYear();
        }
        if (period === 'Năm trước') {
            return billDate.getFullYear() === tempRefDate.getFullYear() - 1;
        }
        return false;
    });

    const revenue = periodBills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || bill.total || 0), 0);
    const transactions = periodBills.length;
    const profit = periodBills.reduce((sum, bill) => sum + (bill.totalAfterDiscount || bill.total || 0) * 0.3, 0); // Giả định 30% lợi nhuận gộp
    const avgValue = transactions > 0 ? revenue / transactions : 0;
    return { revenue, transactions, profit, avgValue };
};


// --- MAIN ANALYTICS COMPONENT ---
export default function AnalyticsContent() { // Đã đổi tên thành AnalyticsContent
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();

    // State for data
    const [bills, setBills] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);

    // Individual loading states for each collection
    const [billsLoaded, setBillsLoaded] = useState(false);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [customersLoaded, setCustomersLoaded] = useState(false);

    const [dataError, setDataError] = useState(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPeriod, setCurrentPeriod] = useState('Hôm nay'); // New state for period selection

    // Overall loading state derived from individual loading states
    const dataLoading = useMemo(() => !(billsLoaded && productsLoaded && customersLoaded), [billsLoaded, productsLoaded, customersLoaded]);


    // Authentication check
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

    // Lắng nghe dữ liệu từ Firestore bằng onSnapshot
    useEffect(() => {
        console.log("DATA: Bắt đầu lắng nghe Firestore data...");
        // Bills Listener
        const unsubscribeBills = onSnapshot(collection(db, 'bills'), (snapshot) => {
            const billsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBills(billsData);
            setBillsLoaded(true); // Mark bills as loaded
            console.log("DATA: Bills đã tải:", billsData.length);
        }, (error) => {
            console.error("DATA: Lỗi fetching bills:", error);
            setDataError(error);
            setBillsLoaded(true); // Mark bills as loaded even on error to unblock overall loading
        });

        // Products Listener
        const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData);
            setProductsLoaded(true); // Mark products as loaded
            console.log("DATA: Products đã tải:", productsData.length);
        }, (error) => {
            console.error("DATA: Lỗi fetching products:", error);
            setDataError(error);
            setProductsLoaded(true); // Mark products as loaded even on error
        });

        // Customers Listener
        const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(customersData);
            setCustomersLoaded(true); // Mark customers as loaded
            console.log("DATA: Customers đã tải:", customersData.length);
        }, (error) => {
            console.error("DATA: Lỗi fetching customers:", error);
            setDataError(error);
            setCustomersLoaded(true); // Mark customers as loaded even on error
        });

        // Cleanup function for all listeners
        return () => {
            unsubscribeBills();
            unsubscribeProducts();
            unsubscribeCustomers();
            console.log("DATA: Unsubscribe đã chạy.");
        };
    }, []); // Runs once on mount

    // --- LOGIC TÍNH TOÁN DỮ LIỆU TỔNG QUAN VÀ BIỂU ĐỒ (Derived State) ---
    const {
        totalRevenue, totalTransactions, avgTransactionValue, grossProfit,
        dailyRevenueChartData, categorySalesData, topSellingProductsChartData,
        customerSpendingChartData,
        // New metrics for current/previous period comparison
        currentPeriodRevenue, previousPeriodRevenue, revenueChangePercentage,
        currentPeriodTransactions, previousPeriodTransactions, transactionsChangePercentage,
        currentPeriodAvgValue, previousPeriodAvgValue, avgValueChangePercentage,
        currentPeriodProfit, previousPeriodProfit, profitChangePercentage
    } = useMemo(() => {
        // Ensure all data is loaded before performing calculations
        if (!billsLoaded || !productsLoaded || !customersLoaded) {
            console.log("MEMO: Dữ liệu chưa tải xong, trả về giá trị mặc định.");
            return {
                totalRevenue: 0, totalTransactions: 0, avgTransactionValue: 0, grossProfit: 0,
                dailyRevenueChartData: [], categorySalesData: [], topSellingProductsChartData: [],
                customerSpendingChartData: [],
                currentPeriodRevenue: 0, previousPeriodRevenue: 0, revenueChangePercentage: 0,
                currentPeriodTransactions: 0, previousPeriodTransactions: 0, transactionsChangePercentage: 0,
                currentPeriodAvgValue: 0, previousPeriodAvgValue: 0, avgValueChangePercentage: 0,
                currentPeriodProfit: 0, previousPeriodProfit: 0, profitChangePercentage: 0
            };
        }
        console.log("MEMO: Bắt đầu tính toán dữ liệu phân tích.");


        const now = new Date(); // Reference date for current period calculations

        // Calculate data for current period (based on currentPeriod selector)
        const currentData = calculatePeriodData(bills, currentPeriod, now);
        const currentRev = currentData.revenue;
        const currentTrans = currentData.transactions;
        const currentAvg = currentData.avgValue;
        const currentProf = currentData.profit;

        // Determine previous period type based on currentPeriod
        let previousPeriodType;
        if (currentPeriod === 'Hôm nay') previousPeriodType = 'Hôm qua';
        else if (currentPeriod === 'Tuần này') previousPeriodType = 'Tuần trước';
        else if (currentPeriod === 'Tháng này') previousPeriodType = 'Tháng trước';
        else if (currentPeriod === 'Năm này') previousPeriodType = 'Năm trước';
        else previousPeriodType = null; // No comparison for other periods or default

        let previousRev = 0;
        let previousTrans = 0;
        let previousAvg = 0;
        let previousProf = 0;

        if (previousPeriodType) {
            const previousData = calculatePeriodData(bills, previousPeriodType, now);
            previousRev = previousData.revenue;
            previousTrans = previousData.transactions;
            previousAvg = previousData.avgValue;
            previousProf = previousData.profit;
        }

        // Calculate percentages
        const calculatePercentageChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0; // If previous was 0 and current is >0, it's 100% growth
            return ((current - previous) / previous) * 100;
        };

        const revChange = calculatePercentageChange(currentRev, previousRev);
        const transChange = calculatePercentageChange(currentTrans, previousTrans);
        const avgChange = calculatePercentageChange(currentAvg, previousAvg);
        const profChange = calculatePercentagePercentageChange(currentProf, previousProf);


        // Filter bills for charts (based on startDate/endDate pickers)
        let filteredBillsForCharts = bills;
        if (startDate) {
            const start = new Date(startDate);
            filteredBillsForCharts = filteredBillsForCharts.filter(bill => {
                const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
                return billDate >= start;
            });
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Set to end of day
            filteredBillsForCharts = filteredBillsForCharts.filter(bill => {
                const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
                return billDate <= end;
            });
        }


        // Daily Revenue Chart Data (uses filteredBillsForCharts)
        const dailySalesMap = {};
        filteredBillsForCharts.forEach(bill => {
            const billDate = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
            if (billDate && !isNaN(billDate.getTime())) {
                const dateKey = billDate.toISOString().split('T')[0]; // YYYY-MM-DD
                dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + (bill.totalAfterDiscount || bill.total || 0);
            }
        });
        const aggregatedDailyRevenue = Object.keys(dailySalesMap).sort().map(date => ({
            date: date,
            DoanhThu: dailySalesMap[date]
        }));

        // Category Sales Data (for Pie Chart, uses filteredBillsForCharts)
        const categorySalesMap = {};
        filteredBillsForCharts.forEach(bill => {
            (bill.items || []).forEach(item => {
                const category = item.category || 'Không xác định';
                categorySalesMap[category] = (categorySalesMap[category] || 0) + (item.price * item.quantity || 0);
            });
        });
        const aggregatedCategorySales = Object.keys(categorySalesMap).map(category => ({
            name: category,
            value: categorySalesMap[category]
        })).sort((a, b) => b.value - a.value);

        // Top Selling Products Chart Data (by quantity, uses filteredBillsForCharts)
        const productQuantityMap = {};
        filteredBillsForCharts.forEach(bill => {
            (bill.items || []).forEach(item => {
                productQuantityMap[item.id] = productQuantityMap[item.id] || { id: item.id, name: item.name, quantity: 0 };
                productQuantityMap[item.id].quantity += item.quantity;
            });
        });
        const sortedTopSellingProducts = Object.values(productQuantityMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5) // Top 5
            .map(p => ({ name: p.name, SốLượng: p.quantity }));


        // Customer Spending Chart Data (Top 5 customers by total spent, uses filteredBillsForCharts)
        const customerSpentMap = {};
        filteredBillsForCharts.forEach(bill => {
            if (bill.customer?.id) {
                customerSpentMap[bill.customer.id] = customerSpentMap[bill.customer.id] || { id: bill.customer.id, name: bill.customer.name, totalSpent: 0 };
                customerSpentMap[bill.customer.id].totalSpent += (bill.totalAfterDiscount || bill.total || 0);
            }
        });
        const sortedCustomerSpending = Object.values(customerSpentMap)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5) // Top 5
            .map(c => ({ name: c.name, ChiTiêu: c.totalSpent }));


        return {
            totalRevenue: currentRev, // These are for StatCards, based on currentPeriod
            totalTransactions: currentTrans,
            avgTransactionValue: currentAvg,
            grossProfit: currentProf,
            dailyRevenueChartData: aggregatedDailyRevenue, // These are for charts, based on startDate/endDate
            categorySalesData: aggregatedCategorySales,
            topSellingProductsChartData: sortedTopSellingProducts,
            customerSpendingChartData: sortedCustomerSpending,

            currentPeriodRevenue: currentRev,
            previousPeriodRevenue: previousRev,
            revenueChangePercentage: revChange,

            currentPeriodTransactions: currentTrans,
            previousPeriodTransactions: previousTrans,
            transactionsChangePercentage: transChange,

            currentPeriodAvgValue: currentAvg,
            previousPeriodAvgValue: previousAvg,
            avgValueChangePercentage: avgChange,

            currentPeriodProfit: currentProf,
            previousPeriodProfit: previousProf,
            profitChangePercentage: profChange,
        };
    }, [bills, products, customers, startDate, endDate, currentPeriod, billsLoaded, productsLoaded, customersLoaded]); // Add loaded flags to dependencies

    // Colors for Pie Chart
    const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    // Helper to format percentage change
    const formatChange = (percentage) => {
        if (percentage === 0) return "0%";
        const sign = percentage > 0 ? '↑' : '↓';
        return `${sign} ${Math.abs(percentage).toFixed(1)}%`;
    };

    const handleLogout = useCallback(async () => {
        try {
            await auth.signOut();
            console.log("Đã đăng xuất thành công.");
            router.push('/login');
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
        }
    }, [auth, router]);

    // Show loading state
    if (authLoading || dataLoading) {
        console.log("RENDER: Hiển thị màn hình tải Analytics. authLoading:", authLoading, "dataLoading:", dataLoading);
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <p className="text-lg font-semibold">Đang tải dữ liệu phân tích...</p>
            </div>
        );
    }

    if (!user) { // If auth is resolved and no user, redirect (handled by useEffect)
        console.log("RENDER: Không có người dùng, trả về null.");
        return null;
    }

    if (dataError) {
        console.log("RENDER: Hiển thị lỗi dữ liệu Analytics:", dataError.message);
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-red-500">
                <p className="text-lg font-semibold">Lỗi tải dữ liệu: {dataError.message}</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            {/* Sidebar (Thanh điều hướng bên trái) */}
            <Sidebar />
            {/* Main Content */}
            <div className="flex-1 ml-64 p-8">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Phân tích Dữ liệu</h1>
                    <div className="flex items-center space-x-4">
                        {/* Period Selector */}
                        <div className="relative">
                            <select
                                value={currentPeriod}
                                onChange={(e) => setCurrentPeriod(e.target.value)}
                                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                            >
                                <option value="Hôm nay">Hôm nay</option>
                                <option value="Tuần này">Tuần này</option>
                                <option value="Tháng này">Tháng này</option>
                                <option value="Năm này">Năm này</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        {/* Date Range Pickers */}
                        <div className="flex space-x-4 w-full md:w-auto">
                            <div className="relative flex-1">
                                <Calendar size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition-colors"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="relative flex-1">
                                <Calendar size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 transition-colors"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Sales Overview Cards */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4">
                        <div className="p-3 rounded-full bg-indigo-500 text-white"><DollarSign size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Tổng doanh thu</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(currentPeriodRevenue)}</h3>
                            {currentPeriodRevenue !== 0 && previousPeriodRevenue !== 0 && (
                                <p className={`text-xs ${revenueChangePercentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatChange(revenueChangePercentage)} so với kỳ trước
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4">
                        <div className="p-3 rounded-full bg-green-500 text-white"><ShoppingCart size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Số lượng giao dịch</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{currentPeriodTransactions.toLocaleString()}</h3>
                            {currentPeriodTransactions !== 0 && previousPeriodTransactions !== 0 && (
                                <p className={`text-xs ${transactionsChangePercentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatChange(transactionsChangePercentage)} so với kỳ trước
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4">
                        <div className="p-3 rounded-full bg-blue-500 text-white"><CreditCard size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Giá trị TB/Giao dịch</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(currentPeriodAvgValue)}</h3>
                            {currentPeriodAvgValue !== 0 && previousPeriodAvgValue !== 0 && (
                                <p className={`text-xs ${avgValueChangePercentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatChange(avgValueChangePercentage)} so với kỳ trước
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4">
                        <div className="p-3 rounded-full bg-orange-500 text-white"><TrendingUp size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Lợi nhuận gộp</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(currentPeriodProfit)}</h3>
                            {currentPeriodProfit !== 0 && previousPeriodProfit !== 0 && (
                                <p className={`text-xs ${profitChangePercentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatChange(profitChangePercentage)} so với kỳ trước
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Charts Section */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Biểu đồ Doanh thu theo ngày */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Doanh thu theo ngày" icon={<BarChart2 size={20} />} />
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <LineChart data={dailyRevenueChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis dataKey="date" stroke="#888888" />
                                    <YAxis stroke="#888888" tickFormatter={(value) => formatCurrency(value)} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => `Ngày: ${label}`} />
                                    <Legend />
                                    <Line type="monotone" dataKey="DoanhThu" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Biểu đồ Doanh thu theo danh mục */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Doanh thu theo danh mục" icon={<Tag size={20} />} />
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={categorySalesData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {categorySalesData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Biểu đồ Sản phẩm bán chạy nhất */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Sản phẩm bán chạy nhất (theo số lượng)" icon={<Package size={20} />} />
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={topSellingProductsChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={50} interval={0} />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="SốLượng" fill="#82ca9d" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Biểu đồ Khách hàng chi tiêu nhiều nhất */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <SectionTitle title="Khách hàng chi tiêu nhiều nhất" icon={<Users size={20} />} />
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={customerSpendingChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={50} interval={0} />
                                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="ChiTiêu" fill="#ffc658" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}