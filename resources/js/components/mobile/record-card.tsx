import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface MobileRecordCardProps {
    title: string;
    subtitle?: string;
    value?: ReactNode;
    badges?: Array<{
        label: string;
        className?: string;
    }>;
    badgeHeaders?: string[];
    badgeLayout?: 'wrap' | 'spread';
    children?: ReactNode;
    footer?: ReactNode;
    footerClassName?: string;
    onClick?: () => void;
    className?: string;
}

export function MobileRecordCard({
    title,
    subtitle,
    value,
    badges = [],
    badgeHeaders = [],
    badgeLayout = 'wrap',
    children,
    footer,
    footerClassName,
    onClick,
    className,
}: MobileRecordCardProps) {
    const CardBody = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">
                        {title}
                    </h3>
                    {subtitle ? (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
                {value !== undefined ? (
                    <div className="shrink-0 text-right text-base font-semibold">
                        {value}
                    </div>
                ) : null}
            </div>

            {badges.length > 0 ? (
                badgeLayout === 'spread' ? (
                    <div className="mt-3 space-y-1">
                        {badgeHeaders.length > 0 ? (
                            <div className="grid grid-cols-3 items-start gap-2 text-[11px] font-medium text-muted-foreground">
                                {badgeHeaders
                                    .slice(0, 3)
                                    .map((header, index) => (
                                        <div
                                            key={`${header}-${index}`}
                                            className={cn(
                                                index === 0 &&
                                                    'justify-self-start',
                                                index === 1 &&
                                                    'justify-self-center',
                                                index === 2 &&
                                                    'justify-self-end',
                                            )}
                                        >
                                            {header}
                                        </div>
                                    ))}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-3 items-start gap-2">
                            {badges.slice(0, 3).map((badge, index) => (
                                <div
                                    key={`${badge.label}-${index}`}
                                    className={cn(
                                        index === 0 && 'justify-self-start',
                                        index === 1 && 'justify-self-center',
                                        index === 2 && 'justify-self-end',
                                    )}
                                >
                                    <Badge
                                        className={cn(
                                            'text-xs font-medium whitespace-nowrap',
                                            badge.className,
                                        )}
                                    >
                                        {badge.label}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {badges.slice(0, 3).map((badge, index) => (
                            <Badge
                                key={`${badge.label}-${index}`}
                                className={cn(
                                    'text-xs font-medium',
                                    badge.className,
                                )}
                            >
                                {badge.label}
                            </Badge>
                        ))}
                    </div>
                )
            ) : null}

            {children ? <div className="mt-3 space-y-2">{children}</div> : null}
            {footer ? (
                <div
                    className={cn(
                        'mt-4 border-t border-border pt-3',
                        footerClassName,
                    )}
                >
                    {footer}
                </div>
            ) : null}
        </>
    );

    return (
        <article
            className={cn(
                'rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm',
                className,
            )}
        >
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    className="block w-full text-left"
                >
                    {CardBody}
                </button>
            ) : (
                CardBody
            )}
        </article>
    );
}

interface MobileRecordRowProps {
    label: string;
    value: ReactNode;
    valueClassName?: string;
}

export function MobileRecordRow({
    label,
    value,
    valueClassName,
}: MobileRecordRowProps) {
    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('text-right text-foreground', valueClassName)}>
                {value}
            </span>
        </div>
    );
}
