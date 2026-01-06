/**
 * Formats a number with thousand separators (commas) and 2 decimal places
 * @param value - The number to format
 * @returns Formatted string with commas (e.g., 1000 -> "1,000.00")
 */
export function formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '0.00';
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return '0.00';
    }
    
    return numValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Formats a number with thousand separators (commas) without decimal places
 * @param value - The number to format
 * @returns Formatted string with commas (e.g., 1000 -> "1,000")
 */
export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '0';
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return '0';
    }
    
    return numValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

