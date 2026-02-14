import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import type { ReactNode } from 'react';

export interface RecordActionItem {
    key: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

interface RecordActionsSheetProps {
    title: string;
    description?: string;
    actions: RecordActionItem[];
    triggerClassName?: string;
}

export function RecordActionsSheet({ title, description, actions, triggerClassName }: RecordActionsSheetProps) {
    if (actions.length === 0) {
        return null;
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn('h-11 w-11 shrink-0', triggerClassName)}
                    aria-label="Open actions"
                >
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description ? <SheetDescription>{description}</SheetDescription> : null}
                </SheetHeader>
                <div className="space-y-2 px-4 pb-6">
                    {actions.map((action) => (
                        <Button
                            key={action.key}
                            type="button"
                            variant={action.destructive ? 'destructive' : 'outline'}
                            className="h-11 w-full justify-start gap-2"
                            onClick={action.onClick}
                            disabled={action.disabled}
                        >
                            {action.icon}
                            <span>{action.label}</span>
                        </Button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
