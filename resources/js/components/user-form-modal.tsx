import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface User {
    id: number;
    name: string;
    email: string;
    role?: 'admin' | 'staff';
    is_active?: boolean;
    email_verified_at: string | null;
    pin?: string | null;
    has_pin?: boolean;
    created_at: string;
    updated_at: string;
}

type ModalMode = 'view' | 'create' | 'edit';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    mode?: ModalMode;
    onSuccess?: () => void;
}

export function UserFormModal({ isOpen, onClose, user, mode = 'create', onSuccess }: UserFormModalProps) {
    const isViewMode = mode === 'view';
    const isEditing = mode === 'edit';
    const isCreating = mode === 'create';

    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
    const [showPin, setShowPin] = useState(false);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: user?.name || '',
        email: user?.email || '',
        role: user?.role || 'staff',
        is_active: user?.is_active ?? true,
        password: '',
        password_confirmation: '',
        pin: '',
    });

    useEffect(() => {
        if (user) {
            setData({
                name: user.name,
                email: user.email,
                role: user.role || 'staff',
                is_active: user.is_active ?? true,
                password: '',
                password_confirmation: '',
                pin: '',
            });
        } else {
            reset();
        }
    }, [user, setData, reset]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isViewMode) {
            onClose();
            return;
        }

        if (isEditing && user) {
            put(`/users/${user.id}`, {
                onSuccess: () => {
                    onClose();
                    onSuccess?.();
                },
            });
        } else {
            post('/users', {
                onSuccess: () => {
                    onClose();
                    onSuccess?.();
                },
            });
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isViewMode ? 'View User' : isEditing ? 'Edit User' : 'Create New User'}
                    </DialogTitle>
                    <DialogDescription>
                        {isViewMode
                            ? 'User information (read-only).'
                            : isEditing
                            ? 'Update the user information below.'
                            : 'Fill in the details to create a new user account.'
                        }
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Enter user's full name"
                                readOnly={isViewMode}
                                className={isViewMode ? 'bg-gray-50 dark:bg-gray-800' : ''}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="Enter user's email address"
                                readOnly={isViewMode}
                                className={isViewMode ? 'bg-gray-50 dark:bg-gray-800' : ''}
                            />
                            {errors.email && (
                                <p className="text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>
                        {(isEditing || isCreating) && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Role</Label>
                                    <select
                                        id="role"
                                        value={data.role}
                                        onChange={(e) => setData('role', e.target.value as 'admin' | 'staff')}
                                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="staff">Staff</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    {errors.role && (
                                        <p className="text-sm text-red-600">{errors.role}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="is_active">Account Status</Label>
                                    <select
                                        id="is_active"
                                        value={data.is_active ? '1' : '0'}
                                        onChange={(e) => setData('is_active', e.target.value === '1')}
                                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="1">Active</option>
                                        <option value="0">Inactive</option>
                                    </select>
                                    {errors.is_active && (
                                        <p className="text-sm text-red-600">{errors.is_active}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">
                                        Password {isEditing && '(leave blank to keep current)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            placeholder={isEditing ? 'Enter new password' : 'Enter a password'}
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    {errors.password && (
                                        <p className="text-sm text-red-600">{errors.password}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">
                                        Confirm Password {isEditing && '(leave blank to keep current)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="password_confirmation"
                                            type={showPasswordConfirmation ? 'text' : 'password'}
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            placeholder={isEditing ? 'Confirm new password' : 'Confirm the password'}
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                                        >
                                            {showPasswordConfirmation ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    {errors.password_confirmation && (
                                        <p className="text-sm text-red-600">{errors.password_confirmation}</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="pin">
                                        PIN {isEditing && '(leave blank to keep current)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="pin"
                                            type={showPin ? 'text' : 'password'}
                                            value={data.pin}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                setData('pin', value);
                                            }}
                                            placeholder={isEditing ? 'Enter new PIN (4-6 digits)' : 'Enter PIN (4-6 digits)'}
                                            className="pr-10"
                                            maxLength={6}
                                            inputMode="numeric"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPin(!showPin)}
                                        >
                                            {showPin ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    {errors.pin && (
                                        <p className="text-sm text-red-600">{errors.pin}</p>
                                    )}
                                </div>
                            </>
                        )}
                        {isViewMode && user && (
                            <div className="grid gap-2">
                                <Label htmlFor="view-role">Role</Label>
                                <Input
                                    id="view-role"
                                    value={user.role === 'admin' ? 'Admin' : 'Staff'}
                                    readOnly
                                    className="bg-gray-50 dark:bg-gray-800"
                                />
                            </div>
                        )}
                        {isViewMode && user && (
                            <div className="grid gap-2">
                                <Label htmlFor="view-status">Account Status</Label>
                                <Input
                                    id="view-status"
                                    value={user.is_active === false ? 'Inactive' : 'Active'}
                                    readOnly
                                    className="bg-gray-50 dark:bg-gray-800"
                                />
                            </div>
                        )}
                        {isViewMode && user && (
                            <div className="grid gap-2">
                                <Label htmlFor="pin">PIN</Label>
                                <div className="relative">
                                    <Input
                                        id="pin"
                                        type={showPin ? 'text' : 'password'}
                                        value={user.pin ? (showPin ? user.pin : '****************') : 'Not set'}
                                        readOnly
                                        className="pr-10 bg-gray-50 dark:bg-gray-800"
                                    />
                                    {user.pin && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPin(!showPin)}
                                        >
                                            {showPin ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            {isViewMode ? 'Close' : 'Cancel'}
                        </Button>
                        {!isViewMode && (
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
