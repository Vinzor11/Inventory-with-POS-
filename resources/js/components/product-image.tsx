import { Package } from 'lucide-react';
import { useState } from 'react';

interface ProductImageProps {
    src: string | null;
    alt: string;
    className?: string;
    fallbackClassName?: string;
}

export function ProductImage({ src, alt, className = '', fallbackClassName = '' }: ProductImageProps) {
    const [imageError, setImageError] = useState(false);

    if (!src || imageError) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-700 ${fallbackClassName || className}`}>
                <Package className="h-5 w-5 text-gray-400" />
            </div>
        );
    }

    return (
        <img
            src={src.startsWith('/') ? src : `/storage/${src}`}
            alt={alt}
            className={className}
            onError={() => setImageError(true)}
        />
    );
}

