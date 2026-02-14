import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { getAppMainNavItems } from '@/config/app-nav-items';
import { logout } from '@/routes';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    ChevronRight,
    LogIn,
    LogOut,
    Menu,
    Receipt,
    Scale,
    ShoppingCart,
    Truck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function PosSectionNav() {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const sidebarItems = useMemo(
        () =>
            getAppMainNavItems(auth?.user?.role).filter(
                (item) => typeof item.href === 'string',
            ),
        [auth?.user?.role],
    );

    const isPathActive = (targetPath: string) =>
        page.url === targetPath || page.url.startsWith(`${targetPath}/`);

    const isDirectNavPath =
        page.url.startsWith('/pos') ||
        page.url === '/' ||
        page.url.startsWith('/delivery-landing') ||
        page.url.startsWith('/deliveries') ||
        page.url.startsWith('/sales') ||
        page.url.startsWith('/weigh-ins-landing') ||
        page.url.startsWith('/weigh-ins');

    const isMoreActive =
        isMoreMenuOpen ||
        (!isDirectNavPath &&
            sidebarItems.some((item) => isPathActive(item.href as string)));

    useEffect(() => {
        if (isMoreMenuOpen) {
            document.body.classList.add('mobile-nav-menu-open');
            return;
        }

        document.body.classList.remove('mobile-nav-menu-open');

        return () => {
            document.body.classList.remove('mobile-nav-menu-open');
        };
    }, [isMoreMenuOpen]);

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur lg:hidden">
                <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1.5 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
                    <Link
                        href="/pos"
                        prefetch
                        className="flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium"
                        aria-label="POS"
                    >
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                page.url.startsWith('/pos')
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <ShoppingCart className="h-5 w-5" />
                        </span>
                        <span
                            className={
                                page.url.startsWith('/pos')
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }
                        >
                            POS
                        </span>
                    </Link>

                    <Link
                        href="/"
                        prefetch
                        className="flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium"
                        aria-label="Deliveries"
                    >
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                page.url === '/' ||
                                page.url.startsWith('/deliveries') ||
                                page.url.startsWith('/delivery-landing')
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <Truck className="h-5 w-5" />
                        </span>
                        <span
                            className={
                                page.url === '/' ||
                                page.url.startsWith('/deliveries') ||
                                page.url.startsWith('/delivery-landing')
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }
                        >
                            Delivery
                        </span>
                    </Link>

                    <Link
                        href="/sales"
                        prefetch
                        className={`flex flex-col items-center justify-end gap-1 px-1 pb-1 text-[10px] font-medium ${
                            page.url.startsWith('/sales')
                                ? 'text-primary'
                                : 'text-muted-foreground'
                        }`}
                        aria-label="Sales"
                    >
                        <span
                            className={`-mt-6 mb-0.5 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-4 ring-white transition-colors ${
                                page.url.startsWith('/sales')
                                    ? 'bg-secondary text-secondary-foreground'
                                    : 'bg-white text-secondary'
                            }`}
                        >
                            <Receipt className="h-5 w-5" />
                        </span>
                        <span>Sales</span>
                    </Link>

                    <Link
                        href="/weigh-ins-landing"
                        prefetch
                        className="flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium"
                        aria-label="Weigh-Ins"
                    >
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                page.url.startsWith('/weigh-ins-landing') ||
                                page.url.startsWith('/weigh-ins')
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <Scale className="h-5 w-5" />
                        </span>
                        <span
                            className={
                                page.url.startsWith('/weigh-ins-landing') ||
                                page.url.startsWith('/weigh-ins')
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }
                        >
                            Weigh
                        </span>
                    </Link>

                    <button
                        type="button"
                        onClick={() => setIsMoreMenuOpen(true)}
                        className="flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium"
                        aria-label="More"
                    >
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                isMoreActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <Menu className="h-5 w-5" />
                        </span>
                        <span
                            className={
                                isMoreActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }
                        >
                            More
                        </span>
                    </button>
                </div>
            </div>

            <Sheet open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
                <SheetContent
                    side="bottom"
                    className="h-[78vh] rounded-t-2xl border-t border-border p-0 lg:hidden"
                >
                    <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-primary/35" />

                    <SheetHeader className="border-b border-border px-4 py-3">
                        <SheetTitle className="text-left text-base font-semibold">
                            Navigation Menu
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-3 py-3">
                        <div className="space-y-1">
                            {sidebarItems.map((item) => {
                                const Icon = item.icon;
                                const href = auth?.user
                                    ? (item.href as string)
                                    : '/login';
                                const active = isPathActive(
                                    item.href as string,
                                );

                                return (
                                    <Link
                                        key={item.title}
                                        href={href}
                                        prefetch
                                        onClick={() => setIsMoreMenuOpen(false)}
                                        className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm ${
                                            active
                                                ? 'bg-primary/12 text-primary'
                                                : 'text-foreground hover:bg-secondary'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {Icon && (
                                                <Icon className="h-4 w-4" />
                                            )}
                                            <span>{item.title}</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-border p-3">
                        {auth?.user ? (
                            <Link
                                href={logout()}
                                as="button"
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 text-sm font-medium text-destructive hover:bg-destructive/15"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>Sign Out</span>
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                prefetch
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/85"
                            >
                                <LogIn className="h-4 w-4" />
                                <span>Login</span>
                            </Link>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
