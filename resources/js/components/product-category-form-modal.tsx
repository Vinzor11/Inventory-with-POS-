import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ProductCategory {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

type ModalMode = 'view' | 'create' | 'edit';

interface ProductCategoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    category?: ProductCategory | null;
    mode?: ModalMode;
    onSuccess?: () => void;
}

export function ProductCategoryFormModal({
    isOpen,
    onClose,
    category,
    mode = 'create',
    onSuccess
}: ProductCategoryFormModalProps) {
    const isViewMode = mode === 'view';
    const isEditing = mode === 'edit';
    const isCreating = mode === 'create';

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: category?.name || '',
        description: category?.description || '',
        is_active: category?.is_active ?? true,
    });

    useEffect(() => {
        if (category) {
            setData({
                name: category.name,
                description: category.description || '',
                is_active: category.is_active,
            });
        } else {
            reset();
        }
    }, [category, setData, reset]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isViewMode) {
            onClose();
            return;
        }

        if (isEditing && category) {
            put(`/product-categories/${category.id}`, {
                onSuccess: () => {
                    onClose();
                    onSuccess?.();
                },
            });
        } else {
            post('/product-categories', {
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
                        {isViewMode ? 'View Category' : isEditing ? 'Edit Category' : 'Create New Category'}
                    </DialogTitle>
                    <DialogDescription>
                        {isViewMode
                            ? 'Category information (read-only).'
                            : isEditing
                            ? 'Update the category information below.'
                            : 'Fill in the details to create a new product category.'
                        }
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Enter category name"
                                readOnly={isViewMode}
                                className={isViewMode ? 'bg-gray-50 dark:bg-gray-800' : ''}
                                required={!isViewMode}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Enter category description (optional)"
                                rows={3}
                                readOnly={isViewMode}
                                className={`border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive ${
                                    isViewMode ? 'bg-gray-50 dark:bg-gray-800' : ''
                                }`}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-600">{errors.description}</p>
                            )}
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_active"
                                checked={data.is_active}
                                onCheckedChange={(checked) => setData('is_active', !!checked)}
                                disabled={isViewMode}
                            />
                            <Label htmlFor="is_active">Active</Label>
                        </div>

                        {isViewMode && category && (
                            <div className="grid gap-2">
                                <Label>Created</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(category.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            {isViewMode ? 'Close' : 'Cancel'}
                        </Button>
                        {!isViewMode && (
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving...' : (isEditing ? 'Update Category' : 'Create Category')}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
