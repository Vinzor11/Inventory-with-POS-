import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { router } from "@inertiajs/react"

interface PaginationProps {
    currentPage: number
    lastPage: number
    total: number
    perPage: number
    onPageChange?: (page: number) => void
    preserveFilters?: boolean
    filters?: Record<string, any>
    pageSizeSelector?: React.ReactNode
}

function Pagination({
    currentPage,
    lastPage,
    total,
    perPage,
    onPageChange,
    preserveFilters = true,
    filters = {},
    pageSizeSelector,
}: PaginationProps) {
    // Ensure all values are valid numbers, defaulting to safe defaults if NaN
    const safeCurrentPage = Number(currentPage) || 1
    const safePerPage = Number(perPage) || 10
    const safeTotal = Number(total) || 0
    const safeLastPage = Number(lastPage) || 1

    const handlePageChange = (page: number) => {
        const safePage = Number(page) || 1
        
        if (safePage < 1 || safePage > safeLastPage || safePage === safeCurrentPage) {
            return
        }

        if (onPageChange) {
            onPageChange(safePage)
        } else {
            const queryParams = preserveFilters
                ? { ...filters, page: safePage }
                : { page: safePage }

            // Get the current pathname without query parameters
            const pathname = window.location.pathname

            router.get(pathname, queryParams, {
                preserveState: true,
                preserveScroll: true,
            })
        }
    }

    const getPageNumbers = () => {
        const pages: (number | string)[] = []
        const maxVisible = 7

        if (safeLastPage <= maxVisible) {
            // Show all pages if total is small
            for (let i = 1; i <= safeLastPage; i++) {
                pages.push(i)
            }
        } else {
            // Always show first page
            pages.push(1)

            if (safeCurrentPage > 3) {
                pages.push('ellipsis-start')
            }

            // Show pages around current page
            const start = Math.max(2, safeCurrentPage - 1)
            const end = Math.min(safeLastPage - 1, safeCurrentPage + 1)

            for (let i = start; i <= end; i++) {
                pages.push(i)
            }

            if (safeCurrentPage < safeLastPage - 2) {
                pages.push('ellipsis-end')
            }

            // Always show last page
            pages.push(safeLastPage)
        }

        return pages
    }

    const startItem = Math.max(1, (safeCurrentPage - 1) * safePerPage + 1)
    const endItem = Math.min(safeCurrentPage * safePerPage, safeTotal)
    const summaryText = `${String(startItem)}-${String(endItem)} of ${String(safeTotal)}`

    // Show rows per page selector even if only 1 page (user might want to change it)
    const showPaginationControls = safeLastPage > 1

    return (
        <div className="border-t border-sidebar-border/70 bg-card px-3 py-1.5 dark:border-sidebar-border">
            <div className="flex items-center gap-2.5">
                <div className="min-w-0 shrink text-[11px] leading-tight text-gray-600 dark:text-gray-400 sm:text-xs">
                    {summaryText}
                </div>

                <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
                    {pageSizeSelector && <div className="shrink-0">{pageSizeSelector}</div>}

                    {showPaginationControls && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(safeCurrentPage - 1)}
                                disabled={safeCurrentPage === 1}
                                className="h-7 w-7 shrink-0 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span className="sr-only">Previous page</span>
                            </Button>

                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((page, index) => {
                                    if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                                        return (
                                            <Button
                                                key={`ellipsis-${index}`}
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 shrink-0 p-0"
                                                disabled
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">More pages</span>
                                            </Button>
                                        )
                                    }

                                    const pageNum = Number(page) || 1
                                    const isActive = pageNum === safeCurrentPage

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={cn(
                                                "h-7 w-7 shrink-0 p-0 text-xs",
                                                isActive && "bg-primary text-primary-foreground"
                                            )}
                                        >
                                            {String(pageNum)}
                                        </Button>
                                    )
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(safeCurrentPage + 1)}
                                disabled={safeCurrentPage === safeLastPage}
                                className="h-7 w-7 shrink-0 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                                <span className="sr-only">Next page</span>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export { Pagination }
