import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
// import { users } from '@/routes'; // TODO: Uncomment once routes are regenerated
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, Edit, Trash2, Plus } from 'lucide-react';
import { UserFormModal } from '@/components/user-form-modal';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';

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
    const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>('create');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/users', {
            page: params.page || users?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, perPage, users?.current_page]);

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

    const handleModalClose = () => {
        setIsFormModalOpen(false);
        setEditingUser(null);
        setViewingUser(null);
    };

    const handleFormSuccess = () => {
        // Refresh the page data
        router.reload({ only: ['users'] });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Top Section - Controls (Fixed Height) */}
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold">Users</h1>
                    <Button size="sm" onClick={handleCreateUser}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create User
                    </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                            <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Email</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Verified</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Created</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {users.data.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{user.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{user.email}</td>
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
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="View user"
                                                    onClick={() => handleViewUser(user)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Edit user"
                                                    onClick={() => handleEditUser(user)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                    title="Delete user"
                                                    onClick={() => handleDeleteUser(user)}
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
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {users.data.length > 0 && (
                        <Pagination
                            currentPage={users.current_page}
                            lastPage={users.last_page}
                            total={users.total}
                            perPage={users.per_page}
                            onPageChange={handlePageChange}
                            filters={{ search: debouncedSearch }}
                        />
                    )}
                </div>
            </div>

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
