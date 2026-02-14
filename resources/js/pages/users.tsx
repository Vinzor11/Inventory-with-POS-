import AppLayout from '@/layouts/app-layout';
// import { users } from '@/routes'; // TODO: Uncomment once routes are regenerated
import {
    RecordActionsSheet,
    type RecordActionItem,
} from '@/components/mobile/record-actions-sheet';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
    PER_PAGE_OPTIONS,
    RowsPerPageSelector,
} from '@/components/ui/rows-per-page-selector';
import { UserFormModal } from '@/components/user-form-modal';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Ban, Check, Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/users',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
    role?: 'admin' | 'staff';
    is_active?: boolean;
    email_verified_at: string | null;
    pin?: string | null;
    created_at: string;
    updated_at: string;
}

interface UsersPageProps {
    users: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'users_perPage';

export default function Users({ users, filters }: UsersPageProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 10);
    });
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>(
        'create',
    );
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const triggerFetch = useCallback(
        (params: any = {}) => {
            router.get(
                '/users',
                {
                    page: params.page || users?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    ...params,
                },
                {
                    preserveState: true,
                    preserveScroll: false,
                    replace: true,
                },
            );
        },
        [debouncedSearch, perPage, users?.current_page],
    );

    // Debounced search effect - reset to page 1 when search changes
    useEffect(() => {
        // Only trigger if search actually changed (not on initial mount)
        if (debouncedSearch !== (filters?.search || '')) {
            triggerFetch({ search: debouncedSearch, page: 1 });
        }
    }, [debouncedSearch, filters?.search, triggerFetch]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, valueStr);
        }
        triggerFetch({ per_page: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    const handleCreateUser = () => {
        setEditingUser(null);
        setViewingUser(null);
        setModalMode('create');
        setIsFormModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setViewingUser(null);
        setModalMode('edit');
        setIsFormModalOpen(true);
    };

    const handleViewUser = (user: User) => {
        setViewingUser(user);
        setEditingUser(null);
        setModalMode('view');
        setIsFormModalOpen(true);
    };

    const handleDeleteUser = (user: User) => {
        if (confirm(`Are you sure you want to delete ${user.name}?`)) {
            router.delete(`/users/${user.id}`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error('Failed to delete user.');
                },
            });
        }
    };

    const handleToggleUserActive = (user: User) => {
        const isCurrentlyActive = user.is_active !== false;
        const nextIsActive = !isCurrentlyActive;
        const actionLabel = nextIsActive ? 'activate' : 'deactivate';

        if (confirm(`Are you sure you want to ${actionLabel} ${user.name}?`)) {
            router.patch(
                `/users/${user.id}/toggle-active`,
                { is_active: nextIsActive },
                {
                    preserveScroll: true,
                    onError: () => {
                        toast.error(`Failed to ${actionLabel} user.`);
                    },
                },
            );
        }
    };

    const handleModalClose = () => {
        setIsFormModalOpen(false);
        setEditingUser(null);
        setViewingUser(null);
    };

    const handleFormSuccess = () => {
        // Refresh the page data
        router.reload({ only: ['users'] });
    };

    const mobileHeaderControls = (
        <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-search-surface h-10 min-w-0 flex-1 px-3 text-sm"
        />
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Users" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                {/* Top Section - Controls (Fixed Height) */}
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:p-4">
                    <div className="hidden items-center justify-between md:mb-4 md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Users
                        </h1>
                        <Button size="sm" onClick={handleCreateUser}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create User
                        </Button>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none md:py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {users.data.length > 0 ? (
                                users.data.map((user) => {
                                    const actions: RecordActionItem[] = [
                                        {
                                            key: 'view',
                                            label: 'View User',
                                            icon: <Eye className="h-4 w-4" />,
                                            onClick: () => handleViewUser(user),
                                        },
                                        {
                                            key: 'edit',
                                            label: 'Edit User',
                                            icon: <Edit className="h-4 w-4" />,
                                            onClick: () => handleEditUser(user),
                                        },
                                        {
                                            key: 'toggle-active',
                                            label:
                                                user.is_active === false
                                                    ? 'Activate User'
                                                    : 'Deactivate User',
                                            icon:
                                                user.is_active === false ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Ban className="h-4 w-4" />
                                                ),
                                            onClick: () =>
                                                handleToggleUserActive(user),
                                            destructive:
                                                user.is_active !== false,
                                        },
                                        {
                                            key: 'delete',
                                            label: 'Delete User',
                                            icon: (
                                                <Trash2 className="h-4 w-4" />
                                            ),
                                            onClick: () =>
                                                handleDeleteUser(user),
                                            destructive: true,
                                        },
                                    ];

                                    return (
                                        <MobileRecordCard
                                            key={user.id}
                                            title={user.name}
                                            subtitle={user.email}
                                            badges={[
                                                user.role === 'admin'
                                                    ? {
                                                          label: 'Admin',
                                                          className:
                                                              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                                                      }
                                                    : {
                                                          label: 'Staff',
                                                          className:
                                                              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
                                                      },
                                                user.is_active === false
                                                    ? {
                                                          label: 'Inactive',
                                                          className:
                                                              'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                                                      }
                                                    : {
                                                          label: 'Active',
                                                          className:
                                                              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
                                                      },
                                                user.email_verified_at
                                                    ? {
                                                          label: 'Verified',
                                                          className:
                                                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                                                      }
                                                    : {
                                                          label: 'Unverified',
                                                          className:
                                                              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                                                      },
                                            ]}
                                            footer={
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 flex-1"
                                                        onClick={() =>
                                                            handleViewUser(user)
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <RecordActionsSheet
                                                        title={user.name}
                                                        description="User actions"
                                                        actions={actions}
                                                    />
                                                </div>
                                            }
                                        >
                                            <MobileRecordRow
                                                label="Created"
                                                value={new Date(
                                                    user.created_at,
                                                ).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            />
                                        </MobileRecordCard>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    No users found.
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Name
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Email
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Role
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Verified
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Created
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {users.data.map((user) => (
                                            <tr
                                                key={user.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {user.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {user.email}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                            user.role ===
                                                            'admin'
                                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                                        }`}
                                                    >
                                                        {user.role === 'admin'
                                                            ? 'Admin'
                                                            : 'Staff'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {user.is_active === false ? (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                            Inactive
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                                            Active
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {user.email_verified_at ? (
                                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                                            Verified
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                                                            Unverified
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {new Date(
                                                        user.created_at,
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-2 text-xs"
                                                            title={
                                                                user.is_active ===
                                                                false
                                                                    ? 'Activate user'
                                                                    : 'Deactivate user'
                                                            }
                                                            onClick={() =>
                                                                handleToggleUserActive(
                                                                    user,
                                                                )
                                                            }
                                                        >
                                                            {user.is_active ===
                                                            false
                                                                ? 'Activate'
                                                                : 'Deactivate'}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="View user"
                                                            onClick={() =>
                                                                handleViewUser(
                                                                    user,
                                                                )
                                                            }
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="Edit user"
                                                            onClick={() =>
                                                                handleEditUser(
                                                                    user,
                                                                )
                                                            }
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                            title="Delete user"
                                                            onClick={() =>
                                                                handleDeleteUser(
                                                                    user,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {users.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No users found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {users.data.length > 0 && (
                        <Pagination
                            currentPage={users.current_page}
                            lastPage={users.last_page}
                            total={users.total}
                            perPage={users.per_page}
                            onPageChange={handlePageChange}
                            filters={{ search: debouncedSearch }}
                            pageSizeSelector={
                                <RowsPerPageSelector
                                    perPage={perPage}
                                    onPerPageChange={(value) =>
                                        handlePerPageChange(parseInt(value, 10))
                                    }
                                    storageKey={STORAGE_KEY}
                                />
                            }
                        />
                    )}
                </div>
            </div>

            {!isFormModalOpen && (
                <button
                    type="button"
                    className="mobile-fab fixed right-4 bottom-20 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:bg-green-700 lg:hidden"
                    onClick={handleCreateUser}
                    aria-label="Create user"
                >
                    <Plus className="h-6 w-6" />
                </button>
            )}

            <UserFormModal
                isOpen={isFormModalOpen}
                onClose={handleModalClose}
                user={editingUser || viewingUser}
                mode={modalMode}
                onSuccess={handleFormSuccess}
            />
        </AppLayout>
    );
}
