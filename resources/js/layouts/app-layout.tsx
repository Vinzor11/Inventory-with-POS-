import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { Toaster } from '@/components/ui/toaster';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode } from 'react';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    mobileHeaderContent?: ReactNode;
}

export default ({ children, breadcrumbs, mobileHeaderContent, ...props }: AppLayoutProps) => (
    <>
        <AppLayoutTemplate breadcrumbs={breadcrumbs} mobileHeaderContent={mobileHeaderContent} {...props}>
            {children}
        </AppLayoutTemplate>
        <Toaster />
    </>
);
