import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

interface FilterSheetButtonProps {
    title?: string;
    isActive?: boolean;
    children: ReactNode;
}

export function FilterSheetButton({
    title = 'Filters',
    isActive = false,
    children,
}: FilterSheetButtonProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 justify-center p-0 [font-size:0] text-transparent [&>span]:hidden [&>svg]:hidden"
                    aria-label="Open filters"
                >
                    <div className="relative">
                        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                        {isActive && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                        )}
                    </div>
                </Button>
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className="pb-safe max-h-[80vh] overflow-y-auto rounded-t-2xl"
            >
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <div className="space-y-3 px-4 pb-6">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
