import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { PosSectionNav } from '@/components/pos-section-nav';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren, type ReactNode } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
    mobileHeaderContent,
}: PropsWithChildren<{
    breadcrumbs?: BreadcrumbItem[];
    mobileHeaderContent?: ReactNode;
}>) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className="overflow-x-clip pb-20 lg:pb-0"
            >
                <AppSidebarHeader
                    breadcrumbs={breadcrumbs}
                    mobileHeaderContent={mobileHeaderContent}
                />
                {children}
                <PosSectionNav />
            </AppContent>
        </AppShell>
    );
}
