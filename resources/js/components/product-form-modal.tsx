import { useEffect, useState, useRef } from 'react';
import { useForm, router } from '@inertiajs/react';
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
import { toast } from '@/lib/toast';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ProductCategory {
    id: number;
    name: string;
}

interface Product {
    id: number;
    category_id: number;
    name: string;
    brand: string | null;
    sku: string | null;
    image: string | null;
    base_unit: string;
    track_stock: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    category: ProductCategory;
}

type ModalMode = 'create' | 'edit';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    mode?: ModalMode;
    categories: ProductCategory[];
    onSuccess?: () => void;
}

const baseUnits = ['pcs', 'bag', 'sheet', 'kg', 'length', 'meter', 'liter', 'box'];

export function ProductFormModal({ isOpen, onClose, product, mode = 'create', categories, onSuccess }: ProductFormModalProps) {
    const isEditing = mode === 'edit';
    const isCreating = mode === 'create';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data, setData, processing, errors, reset, setError, clearErrors } = useForm({
        category_id: product?.category_id || '',
        name: product?.name || '',
        brand: product?.brand || '',
        sku: product?.sku || '',
        base_unit: product?.base_unit || 'pcs',
        track_stock: product?.track_stock ?? true,
        is_active: product?.is_active ?? true,
    });

    useEffect(() => {
        if (product) {
            setData({
                category_id: product.category_id,
                name: product.name,
                brand: product.brand || '',
                sku: product.sku || '',
                base_unit: product.base_unit,
                track_stock: product.track_stock,
                is_active: product.is_active,
            });
            // Set existing image preview
            if (product.image) {
                setImagePreview(`/storage/${product.image}`);
            } else {
                setImagePreview(null);
            }
            setSelectedFile(null);
            setRemoveImage(false);
        } else {
            reset();
            setData({
                category_id: '',
                name: '',
                brand: '',
                sku: '',
                base_unit: 'pcs',
                track_stock: true,
                is_active: true,
            });
            setImagePreview(null);
            setSelectedFile(null);
            setRemoveImage(false);
        }
    }, [product, setData, reset]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
                return;
            }
            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Image size must be less than 2MB');
                return;
            }
            setSelectedFile(file);
            setRemoveImage(false);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setSelectedFile(null);
        setImagePreview(null);
        setRemoveImage(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        clearErrors();

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('category_id', String(data.category_id));
        formData.append('name', data.name);
        formData.append('brand', data.brand || '');
        formData.append('sku', data.sku || '');
        formData.append('base_unit', data.base_unit);
        formData.append('track_stock', data.track_stock ? '1' : '0');
        formData.append('is_active', data.is_active ? '1' : '0');

        if (selectedFile) {
            formData.append('image', selectedFile);
        }

        if (isEditing && removeImage) {
            formData.append('remove_image', '1');
        }

        if (isEditing && product) {
            // For PUT/PATCH with FormData, we need to use POST with _method
            formData.append('_method', 'PUT');
            router.post(`/products/${product.id}`, formData, {
                forceFormData: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                    onSuccess?.();
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errors)[0];
                    if (firstError) {
                        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                        toast.error(errorMessage);
                    } else {
                        toast.error('Failed to update product. Please check the form for errors.');
                    }
                },
            });
        } else {
            router.post('/products', formData, {
                forceFormData: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                    onSuccess?.();
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errors)[0];
                    if (firstError) {
                        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                        toast.error(errorMessage);
                    } else {
                        toast.error('Failed to create product. Please check the form for errors.');
                    }
                },
            });
        }
    };

    const handleClose = () => {
        reset();
        setImagePreview(null);
        setSelectedFile(null);
        setRemoveImage(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit Product' : 'Create New Product'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the product information below.'
                            : 'Fill in the details to create a new product.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category_id">Category *</Label>
                            <select
                                id="category_id"
                                value={data.category_id || ''}
                                onChange={(e) => setData('category_id', e.target.value)}
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                                required
                            >
                                <option value="">Select a category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && (
                                <p className="text-sm text-red-600">{errors.category_id}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input
                                id="name"
                                value={data.name || ''}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Enter product name"
                                required
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                        {/* Product Image Upload */}
                        <div className="grid gap-2">
                            <Label>Product Image</Label>
                            <div className="flex items-start gap-4">
                                {/* Image Preview */}
                                <div className="relative w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                    {imagePreview ? (
                                        <>
                                            <img
                                                src={imagePreview}
                                                alt="Product preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <ImageIcon className="h-8 w-8 text-gray-400" />
                                    )}
                                </div>
                                {/* Upload Button */}
                                <div className="flex-1">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="product-image-upload"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {imagePreview ? 'Change Image' : 'Upload Image'}
                                    </Button>
                                    <p className="text-xs text-gray-500 mt-2">
                                        JPEG, PNG, GIF, or WebP. Max 2MB.
                                    </p>
                                </div>
                            </div>
                            {errors.image && (
                                <p className="text-sm text-red-600">{errors.image}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="brand">Brand</Label>
                            <Input
                                id="brand"
                                value={data.brand || ''}
                                onChange={(e) => setData('brand', e.target.value)}
                                placeholder="Enter brand name (optional)"
                            />
                            {errors.brand && (
                                <p className="text-sm text-red-600">{errors.brand}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="sku">SKU</Label>
                            <Input
                                id="sku"
                                value={data.sku || ''}
                                onChange={(e) => setData('sku', e.target.value)}
                                placeholder="Enter SKU (optional)"
                            />
                            {errors.sku && (
                                <p className="text-sm text-red-600">{errors.sku}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="base_unit">Base Unit *</Label>
                            <select
                                id="base_unit"
                                value={data.base_unit || ''}
                                onChange={(e) => setData('base_unit', e.target.value)}
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                                required
                            >
                                {baseUnits.map((unit) => (
                                    <option key={unit} value={unit}>
                                        {unit}
                                    </option>
                                ))}
                            </select>
                            {errors.base_unit && (
                                <p className="text-sm text-red-600">{errors.base_unit}</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="track_stock"
                                    checked={data.track_stock}
                                    onCheckedChange={(checked) => setData('track_stock', !!checked)}
                                />
                                <Label htmlFor="track_stock">Track Stock</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_active"
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', !!checked)}
                                />
                                <Label htmlFor="is_active">Active</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Product' : 'Create Product')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
