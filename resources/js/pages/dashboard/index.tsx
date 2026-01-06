import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { formatCurrency } from '@/lib/format-currency';
import { useState, useEffect } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    ShoppingCart, 
    CreditCard, 
    Package, 
    Truck,
    AlertTriangle,
    Activity,
    ArrowRight,
    Receipt,
    RefreshCw,
    FileText,
    Scale,
    Plus,
    Bell,
    Clock,
    AlertCircle,
    Info,
    Zap,
    BarChart3,
    PieChart,
    Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
}

interface Sale {
    id: number;
    sale_number: string;
    status: string;
    total: number;
    created_at: string;
    cashier: User;
}

interface Refund {
    id: number;
    refund_amount: number;
    created_at: string;
    sale: {
        id: number;
        sale_number: string;
    };
    processed_by: User;
}

interface SaleAdjustment {
    id: number;
    amount_removed: number;
    created_at: string;
    sale: {
        id: number;
        sale_number: string;
    };
    processed_by: User;
}

interface WeighIn {
    id: number;
    ref_num: string;
    type: string;
    total_amount: number;
    weighed_at: string;
    weighed_by: User;
}

interface ProductVariant {
    id: number;
    description: string;
    product: {
        id: number;
        name: string;
    };
    inventory: {
        quantity_on_hand: number;
    } | null;
    total_sold?: number;
}

interface Alert {
    type: 'danger' | 'warning' | 'info';
    title: string;
    message: string;
    count: number;
    action: string;
    items?: Array<{
        product_name: string;
        description: string;
        quantity_on_hand: number;
    }>;
}

interface TopProduct {
    id: number;
    name: string;
    description: string;
    total_quantity: number;
    total_revenue: number;
}

interface DailySalesData {
    date: string;
    gross_sales: number;
    count: number;
}

interface DailyWeighInData {
    date: string;
    total_amount: number;
    count: number;
}

interface DashboardData {
    sales: {
        today: {
            gross_sales: number;
            net_sales: number;
        };
        this_week: {
            gross_sales: number;
            net_sales: number;
        };
        this_month: {
            gross_sales: number;
            net_sales: number;
        };
        by_status: {
            OPEN: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
            PARTIAL: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
            COMPLETED: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
            PARTIALLY_REFUNDED: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
            REFUNDED: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
            VOIDED: { count: number; gross_sales: number; total_refunded: number; net_sales: number };
        };
    };
    payments: {
        today: {
            total_payments: number;
            outstanding_balances: number;
            fully_paid_count: number;
            partially_paid_count: number;
            unpaid_count: number;
        };
        this_week: {
            total_payments: number;
            outstanding_balances: number;
            fully_paid_count: number;
            partially_paid_count: number;
            unpaid_count: number;
        };
        this_month: {
            total_payments: number;
            outstanding_balances: number;
            fully_paid_count: number;
            partially_paid_count: number;
            unpaid_count: number;
        };
    };
    deliveries: {
        today: {
            pending: number;
            partial: number;
            delivered: number;
            canceled: number;
        };
        this_week: {
            pending: number;
            partial: number;
            delivered: number;
            canceled: number;
        };
        this_month: {
            pending: number;
            partial: number;
            delivered: number;
            canceled: number;
        };
    };
    inventory: {
        low_stock_items: ProductVariant[];
        fast_moving_items: ProductVariant[];
        inventory_value: number;
        potential_profit: number;
    };
    weigh_ins: {
        today: {
            total_amount: number;
            count: number;
            by_type: {
                cooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                uncooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                coconut: { count: number; total_amount: number; total_count: number };
            };
            by_status: {
                unpaid: { count: number; total_amount: number };
                paid: { count: number; total_amount: number };
            };
        };
        this_week: {
            total_amount: number;
            count: number;
            by_type: {
                cooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                uncooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                coconut: { count: number; total_amount: number; total_count: number };
            };
            by_status: {
                unpaid: { count: number; total_amount: number };
                paid: { count: number; total_amount: number };
            };
        };
        this_month: {
            total_amount: number;
            count: number;
            by_type: {
                cooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                uncooked_copra: { count: number; total_amount: number; total_weight_kg: number };
                coconut: { count: number; total_amount: number; total_count: number };
            };
            by_status: {
                unpaid: { count: number; total_amount: number };
                paid: { count: number; total_amount: number };
            };
        };
    };
    recent_activity: {
        recent_sales: Sale[];
        recent_refunds: Refund[];
        recent_adjustments: SaleAdjustment[];
        recent_weigh_ins?: WeighIn[];
    };
    charts: {
        daily_sales: DailySalesData[];
        daily_weigh_ins: DailyWeighInData[];
        payment_collection: {
            fully_paid: number;
            partially_paid: number;
            unpaid: number;
        };
    };
    alerts: Alert[];
    top_products: {
        by_quantity: TopProduct[];
        by_revenue: TopProduct[];
    };
    last_updated: string;
}

interface DashboardIndexProps {
    dashboard: DashboardData;
}

function StatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { label: string; className: string }> = {
        OPEN: { 
            label: 'Open', 
            className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
        },
        PARTIAL: { 
            label: 'Partial', 
            className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' 
        },
        COMPLETED: { 
            label: 'Completed', 
            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
        },
        PARTIALLY_REFUNDED: { 
            label: 'Partially Refunded', 
            className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
        },
        REFUNDED: { 
            label: 'Refunded', 
            className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' 
        },
        VOIDED: { 
            label: 'Voided', 
            className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
        },
    };

    const config = statusConfig[status] || { 
        label: status, 
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
        </span>
    );
}

function AlertIcon({ type }: { type: string }) {
    switch (type) {
        case 'danger':
            return <AlertCircle className="h-5 w-5 text-red-500" />;
        case 'warning':
            return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        case 'info':
            return <Info className="h-5 w-5 text-blue-500" />;
        default:
            return <Bell className="h-5 w-5 text-gray-500" />;
    }
}

const CHART_COLORS = ['#22c55e', '#eab308', '#ef4444'];
const PIE_COLORS = ['#22c55e', '#f59e0b', '#94a3b8'];

export default function DashboardIndex({ dashboard }: DashboardIndexProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const handleViewReport = (reportType: string) => {
        router.visit(`/reports/${reportType}`);
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false),
        });
    };

    // Auto-refresh every 5 minutes if enabled
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(() => {
            router.reload();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    // Format chart data
    const salesChartData = dashboard.charts?.daily_sales?.map(item => ({
        date: format(parseISO(item.date), 'MMM d'),
        sales: item.gross_sales,
        count: item.count,
    })) || [];

    const weighInChartData = dashboard.charts?.daily_weigh_ins?.map(item => ({
        date: format(parseISO(item.date), 'MMM d'),
        amount: item.total_amount,
        count: item.count,
    })) || [];

    const paymentPieData = dashboard.charts?.payment_collection ? [
        { name: 'Fully Paid', value: dashboard.charts.payment_collection.fully_paid, color: '#22c55e' },
        { name: 'Partially Paid', value: dashboard.charts.payment_collection.partially_paid, color: '#f59e0b' },
        { name: 'Unpaid', value: dashboard.charts.payment_collection.unpaid, color: '#94a3b8' },
    ].filter(item => item.value > 0) : [];

    const formatWeighInType = (type: string) => {
        switch (type) {
            case 'cooked_copra': return 'Cooked Copra';
            case 'uncooked_copra': return 'Uncooked Copra';
            case 'coconut': return 'Coconut';
            default: return type;
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Owner Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4">
                {/* Header with Quick Actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Owner Dashboard</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Last updated: {dashboard.last_updated ? format(parseISO(dashboard.last_updated), 'MMM d, yyyy h:mm a') : 'N/A'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="default"
                            onClick={() => router.visit('/pos')}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Sale
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => router.visit('/weigh-ins-landing')}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            <Scale className="h-4 w-4 mr-2" />
                            New Weigh-In
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.visit('/sales?payment_status=unpaid')}
                        >
                            <CreditCard className="h-4 w-4 mr-2" />
                            View Unpaid
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            title="Auto-refresh every 5 minutes"
                        >
                            <Zap className={`h-4 w-4 ${autoRefresh ? 'text-yellow-300' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Alerts Section */}
                {dashboard.alerts && dashboard.alerts.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Alerts & Notifications
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {dashboard.alerts.map((alert, index) => (
                                <Card 
                                    key={index}
                                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                                        alert.type === 'danger' ? 'border-l-red-500' :
                                        alert.type === 'warning' ? 'border-l-yellow-500' :
                                        'border-l-blue-500'
                                    }`}
                                    onClick={() => router.visit(alert.action)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertIcon type={alert.type} />
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-sm">{alert.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                                            </div>
                                            <span className={`text-lg font-bold ${
                                                alert.type === 'danger' ? 'text-red-500' :
                                                alert.type === 'warning' ? 'text-yellow-500' :
                                                'text-blue-500'
                                            }`}>
                                                {alert.count}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sales Trend Chart */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Sales Trend (This Month)
                            </CardTitle>
                            <CardDescription>Daily gross sales</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {salesChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={salesChartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 12 }}
                                            className="text-muted-foreground"
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                                            className="text-muted-foreground"
                                        />
                                        <Tooltip 
                                            formatter={(value) => [formatCurrency(Number(value)), 'Sales']}
                                            labelFormatter={(label) => `Date: ${label}`}
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="sales" 
                                            stroke="#22c55e" 
                                            strokeWidth={2}
                                            dot={{ fill: '#22c55e', strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                    No sales data for this month
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                Payment Collection (This Month)
                            </CardTitle>
                            <CardDescription>Sales payment status breakdown</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {paymentPieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <RechartsPieChart>
                                        <Pie
                                            data={paymentPieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {paymentPieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value) => [Number(value), 'Sales']}
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Legend />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                    No payment data for this month
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sales KPIs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Sales Overview
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport('sales')}
                        >
                            View Report <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('sales')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.sales.today.net_sales)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Gross: {formatCurrency(dashboard.sales.today.gross_sales)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('sales')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.sales.this_week.net_sales)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Gross: {formatCurrency(dashboard.sales.this_week.gross_sales)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('sales')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.sales.this_month.net_sales)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Gross: {formatCurrency(dashboard.sales.this_month.gross_sales)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sales by Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sales by Status</CardTitle>
                            <CardDescription>Click any status to view detailed report</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                                {Object.entries(dashboard.sales.by_status).map(([status, data]) => (
                                    <div
                                        key={status}
                                        className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                        onClick={() => handleViewReport(`sales?status=${status}`)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <StatusBadge status={status} />
                                        </div>
                                        <div className="text-2xl font-bold">{data.count}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Net: {formatCurrency(data.net_sales)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Top Products */}
                {dashboard.top_products && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Top Products (This Month)
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">By Quantity Sold</CardTitle>
                                    <CardDescription>Most frequently purchased items</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {dashboard.top_products.by_quantity.length > 0 ? (
                                        <div className="space-y-3">
                                            {dashboard.top_products.by_quantity.map((product, index) => (
                                                <div key={product.id} className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                        index === 1 ? 'bg-gray-100 text-gray-700' :
                                                        index === 2 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{product.description}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold">{product.total_quantity.toFixed(0)}</div>
                                                        <div className="text-xs text-muted-foreground">units</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No sales data</p>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">By Revenue</CardTitle>
                                    <CardDescription>Highest earning products</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {dashboard.top_products.by_revenue.length > 0 ? (
                                        <div className="space-y-3">
                                            {dashboard.top_products.by_revenue.map((product, index) => (
                                                <div key={product.id} className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                        index === 1 ? 'bg-gray-100 text-gray-700' :
                                                        index === 2 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{product.description}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-green-600">{formatCurrency(product.total_revenue)}</div>
                                                        <div className="text-xs text-muted-foreground">{product.total_quantity.toFixed(0)} units</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No sales data</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Payments KPIs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Payments Overview
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport('payments')}
                        >
                            View Report <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('payments')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Today's Payments</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.payments.today.total_payments)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Outstanding: {formatCurrency(dashboard.payments.today.outstanding_balances)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('payments')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.payments.this_week.total_payments)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Outstanding: {formatCurrency(dashboard.payments.this_week.outstanding_balances)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('payments')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.payments.this_month.total_payments)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Outstanding: {formatCurrency(dashboard.payments.this_month.outstanding_balances)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{dashboard.payments.this_month.fully_paid_count}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Partially Paid</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">{dashboard.payments.this_month.partially_paid_count}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-500">{dashboard.payments.this_month.unpaid_count}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Deliveries KPIs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Deliveries Overview
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport('deliveries')}
                        >
                            View Report <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">{dashboard.deliveries.this_month.pending}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Partial</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">{dashboard.deliveries.this_month.partial}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{dashboard.deliveries.this_month.delivered}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Canceled</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-500">{dashboard.deliveries.this_month.canceled}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Weigh-Ins KPIs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Scale className="h-5 w-5" />
                            Weigh-Ins Overview
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport('weigh-ins')}
                        >
                            View Report <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('weigh-ins')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Today's Weigh-Ins</CardTitle>
                                <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.weigh_ins.today.total_amount)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {dashboard.weigh_ins.today.count} weigh-ins
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('weigh-ins')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.weigh_ins.this_week.total_amount)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {dashboard.weigh_ins.this_week.count} weigh-ins
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewReport('weigh-ins')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(dashboard.weigh_ins.this_month.total_amount)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {dashboard.weigh_ins.this_month.count} weigh-ins
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Weigh-Ins by Type (This Month)</CardTitle>
                            <CardDescription>Click any type to view detailed report</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div
                                    className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                    onClick={() => handleViewReport('weigh-ins?type=cooked_copra')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                            Cooked Copra
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{dashboard.weigh_ins.this_month.by_type.cooked_copra.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {Number(dashboard.weigh_ins.this_month.by_type.cooked_copra.total_weight_kg || 0).toFixed(2)} kg • {formatCurrency(dashboard.weigh_ins.this_month.by_type.cooked_copra.total_amount)}
                                    </div>
                                </div>
                                <div
                                    className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                    onClick={() => handleViewReport('weigh-ins?type=uncooked_copra')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                                            Uncooked Copra
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{dashboard.weigh_ins.this_month.by_type.uncooked_copra.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {Number(dashboard.weigh_ins.this_month.by_type.uncooked_copra.total_weight_kg || 0).toFixed(2)} kg • {formatCurrency(dashboard.weigh_ins.this_month.by_type.uncooked_copra.total_amount)}
                                    </div>
                                </div>
                                <div
                                    className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                    onClick={() => handleViewReport('weigh-ins?type=coconut')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                                            Coconut
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{dashboard.weigh_ins.this_month.by_type.coconut.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {dashboard.weigh_ins.this_month.by_type.coconut.total_count} pcs • {formatCurrency(dashboard.weigh_ins.this_month.by_type.coconut.total_amount)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Weigh-Ins by Status (This Month)</CardTitle>
                            <CardDescription>Click any status to view detailed report</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div
                                    className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                    onClick={() => handleViewReport('weigh-ins?status=paid')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                            Paid
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{dashboard.weigh_ins.this_month.by_status.paid.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {formatCurrency(dashboard.weigh_ins.this_month.by_status.paid.total_amount)}
                                    </div>
                                </div>
                                <div
                                    className="cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors"
                                    onClick={() => handleViewReport('weigh-ins?status=unpaid')}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                            Unpaid
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{dashboard.weigh_ins.this_month.by_status.unpaid.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {formatCurrency(dashboard.weigh_ins.this_month.by_status.unpaid.total_amount)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Inventory KPIs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Inventory Overview
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport('inventory-movements')}
                        >
                            View Report <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Low Stock Items</CardTitle>
                                <CardDescription>
                                    {dashboard.inventory.low_stock_items.length} variant{dashboard.inventory.low_stock_items.length !== 1 ? 's' : ''} with quantity ≤ 5
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {dashboard.inventory.low_stock_items.length > 0 ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Button 
                                            variant="outline" 
                                            className="w-full"
                                            onClick={() => router.visit('/inventory?filter=low_stock')}
                                        >
                                            See more details
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">✓ All variants well stocked</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Fast Moving Items</CardTitle>
                                <CardDescription>High demand products</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {dashboard.inventory.fast_moving_items && dashboard.inventory.fast_moving_items.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboard.inventory.fast_moving_items.slice(0, 5).map((item) => (
                                            <div key={item.id} className="flex items-center justify-between p-2 rounded border">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{item.product.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                                </div>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 ml-2">
                                                    {item.total_sold ?? 0} sold
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No sales data yet</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Inventory Value</CardTitle>
                                <CardDescription>Total value on hand</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{formatCurrency(dashboard.inventory.inventory_value)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Potential Profit</CardTitle>
                                <CardDescription>If all inventory sold</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(dashboard.inventory.potential_profit)}</div>
                                {dashboard.inventory.inventory_value > 0 && dashboard.inventory.potential_profit > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {((dashboard.inventory.potential_profit / (dashboard.inventory.inventory_value - dashboard.inventory.potential_profit)) * 100).toFixed(1)}% margin
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Recent Activity
                        </h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    Recent Sales
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dashboard.recent_activity.recent_sales.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboard.recent_activity.recent_sales.map((sale) => (
                                            <div
                                                key={sale.id}
                                                className="flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-accent transition-colors"
                                                onClick={() => router.visit(`/sales/${sale.id}`)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">{sale.sale_number}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {formatCurrency(sale.total)} • {sale.cashier?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <StatusBadge status={sale.status} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No recent sales</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Scale className="h-4 w-4" />
                                    Recent Weigh-Ins
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dashboard.recent_activity.recent_weigh_ins && dashboard.recent_activity.recent_weigh_ins.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboard.recent_activity.recent_weigh_ins.map((weighIn) => (
                                            <div
                                                key={weighIn.id}
                                                className="flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-accent transition-colors"
                                                onClick={() => router.visit(`/weigh-ins/${weighIn.id}`)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">{weighIn.ref_num}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {formatCurrency(weighIn.total_amount)} • {weighIn.weighed_by?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                                                    {formatWeighInType(weighIn.type)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No recent weigh-ins</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Recent Refunds
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dashboard.recent_activity.recent_refunds.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboard.recent_activity.recent_refunds.map((refund) => (
                                            <div
                                                key={refund.id}
                                                className="flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-accent transition-colors"
                                                onClick={() => router.visit(`/reports/refunds-adjustments?sale_id=${refund.sale.id}`)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">{refund.sale.sale_number}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {formatCurrency(refund.refund_amount)} • {refund.processed_by?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                                    Refund
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No recent refunds</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Recent Adjustments
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dashboard.recent_activity.recent_adjustments.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboard.recent_activity.recent_adjustments.map((adjustment) => (
                                            <div
                                                key={adjustment.id}
                                                className="flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-accent transition-colors"
                                                onClick={() => router.visit(`/reports/refunds-adjustments?sale_id=${adjustment.sale.id}`)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">{adjustment.sale.sale_number}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {formatCurrency(adjustment.amount_removed)} • {adjustment.processed_by?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                                                    Adjustment
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No recent adjustments</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
