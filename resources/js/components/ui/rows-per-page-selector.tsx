import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PER_PAGE_OPTIONS = ['5', '10', '15', '25', '50', '100'] as const

interface RowsPerPageSelectorProps {
    perPage: string
    onPerPageChange: (value: string) => void
    storageKey?: string
}

export function RowsPerPageSelector({ 
    perPage, 
    onPerPageChange,
    storageKey = 'default_table_perPage'
}: RowsPerPageSelectorProps) {
    return (
        <Select value={perPage} onValueChange={onPerPageChange}>
            <SelectTrigger className="h-7 w-[58px] text-xs">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {PER_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export { PER_PAGE_OPTIONS }
