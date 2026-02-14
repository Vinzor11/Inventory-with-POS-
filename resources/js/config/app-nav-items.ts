import { type NavItem } from '@/types';
import {
    LayoutGrid,
    Package,
    Recycle,
    Receipt,
    RefreshCw,
    Scale,
    Tags,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';

export const appMainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        adminOnly: true,
    },
    {
        title: 'Users',
        href: '/users',
        icon: Users,
        adminOnly: true,
    },
    {
        title: 'Product Categories',
        href: '/product-categories',
        icon: Tags,
    },
    {
        title: 'Products',
        href: '/products',
        icon: Package,
    },
    {
        title: 'Inventory',
        href: '/inventory',
        icon: Warehouse,
    },
    {
        title: 'Production',
        href: '/inventory/production/coconut-to-uncooked',
        icon: Recycle,
        adminOnly: true,
    },
    {
        title: 'Sales',
        href: '/sales',
        icon: Receipt,
    },
    {
        title: 'Refunds',
        href: '/refunds',
        icon: RefreshCw,
        adminOnly: true,
    },
    {
        title: 'Deliveries',
        href: '/deliveries',
        icon: Truck,
    },
    {
        title: 'Weigh-Ins',
        href: '/weigh-ins',
        icon: Scale,
    },
];

export function getAppMainNavItems(role?: 'admin' | 'staff'): NavItem[] {
    if (role === 'admin') {
        return appMainNavItems;
    }

    return appMainNavItems.filter((item) => !item.adminOnly);
}
