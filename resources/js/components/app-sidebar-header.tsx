import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { type ReactNode } from 'react';

export function AppSidebarHeader({
    breadcrumbs = [],
    mobileHeaderContent,
}: {
    breadcrumbs?: BreadcrumbItemType[];
    mobileHeaderContent?: ReactNode;
}) {
    return (
        <header
            className={cn(
                'sticky top-0 z-50 flex shrink-0 items-center gap-2 border-b border-sidebar-border/50 bg-white px-3 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:h-12 md:px-4',
                mobileHeaderContent ? 'h-16' : 'h-12',
            )}
        >
            <div className="flex w-full items-center gap-2">
                <SidebarTrigger className="-ml-1 hidden shrink-0 md:inline-flex" />

                {mobileHeaderContent ? (
                    <div className="mobile-header-controls flex min-w-0 flex-1 items-center gap-2 md:hidden">
                        {mobileHeaderContent}
                    </div>
                ) : (
                    <div className="min-w-0 md:hidden">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                )}

                <div className="hidden min-w-0 items-center gap-2 md:flex">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            </div>
        </header>
    );
}
