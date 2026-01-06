# Phase 6: Owner/Manager Dashboard & Reporting Module - Architecture Documentation

## Overview

Phase 6 implements a **read-only** dashboard and reporting module for owners and managers. This module provides aggregated KPIs on the dashboard and full drill-down reports with filters, pagination, and audit trails.

## Key Architectural Principles

### 1. Read-Only Design
- **No mutations allowed**: Dashboard and reports are strictly read-only
- **No business logic**: No refunds, voids, cancellations, or deliveries from dashboard/reports
- **View-only access**: All actions link to detailed views or other modules

### 2. Shared Query Logic
- **Dashboard reuses report queries**: All dashboard KPIs are derived from report query services
- **Consistency guarantee**: Dashboard numbers MUST exactly match report totals
- **Single source of truth**: Report query services are the authoritative source

### 3. Authorization
- **Admin-only access**: Only users with `role = 'admin'` can access dashboard and reports
- **Cashier restriction**: Staff/cashier users cannot access reporting module
- **Controller-level checks**: All controllers verify admin role before processing

## Architecture Components

### Services Layer

#### Report Query Services
Located in `app/Services/`:

1. **SalesReportQueryService**
   - `baseQuery()`: Base query with filters (date, cashier, status)
   - `getPaginated()`: Paginated sales for reports
   - `getSummaryByStatus()`: Aggregated totals by sale_status (for dashboard)
   - `getGrossSalesTotal()`: Total gross sales (for dashboard)
   - `getNetSalesTotal()`: Net sales after refunds (for dashboard)
   - `getRecentSales()`: Recent sales for activity feed

2. **PaymentsReportQueryService**
   - `baseQuery()`: Base query with filters (date, method, status, type)
   - `getPaginated()`: Paginated payments for reports
   - `getTotalPaymentsReceived()`: Total payments (for dashboard)
   - `getTotalRefunds()`: Total refunds (for dashboard)
   - `getPaymentCounts()`: Counts by payment status (for dashboard)
   - `getOutstandingBalances()`: Total outstanding balances (for dashboard)

3. **RefundsAdjustmentsReportQueryService**
   - `refundsBaseQuery()`: Base query for refunds
   - `adjustmentsBaseQuery()`: Base query for adjustments
   - `getRefundsPaginated()`: Paginated refunds for reports
   - `getAdjustmentsPaginated()`: Paginated adjustments for reports
   - `getRecentRefunds()`: Recent refunds for activity feed
   - `getRecentAdjustments()`: Recent adjustments for activity feed

4. **DeliveriesReportQueryService**
   - `baseQuery()`: Base query with filters (date, status, sale)
   - `getPaginated()`: Paginated deliveries for reports
   - `getDeliveryCounts()`: Counts by delivery status (for dashboard)

5. **InventoryMovementReportQueryService**
   - `baseQuery()`: Base query with filters (date, type, variant, reason)
   - `getPaginated()`: Paginated movements for reports
   - `getLowStockItems()`: Low-stock items (for dashboard)
   - `getFastMovingItems()`: Fast-moving items (for dashboard)
   - `getInventoryValue()`: Total inventory value (for dashboard)

#### Dashboard Query Service
**DashboardQueryService** (`app/Services/DashboardQueryService.php`):
- Aggregates data from all report query services
- Provides time-based KPIs (today, this week, this month)
- Ensures dashboard numbers match report totals
- Returns structured data for dashboard display

### Controllers Layer

#### DashboardController
- `index()`: Displays dashboard with aggregated KPIs
- Authorization: Admin-only access check
- Returns dashboard data via `DashboardQueryService`

#### ReportsController
- `sales()`: Sales report with filters
- `payments()`: Payments report with filters
- `refundsAdjustments()`: Refunds & adjustments report
- `deliveries()`: Deliveries report with filters
- `inventoryMovements()`: Inventory movements report
- All methods: Admin-only access check

### Routes

All routes are protected by `auth` and `verified` middleware:

```php
// Dashboard
Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

// Reports
Route::prefix('reports')->name('reports.')->group(function () {
    Route::get('sales', [ReportsController::class, 'sales'])->name('sales');
    Route::get('payments', [ReportsController::class, 'payments'])->name('payments');
    Route::get('refunds-adjustments', [ReportsController::class, 'refundsAdjustments'])->name('refunds-adjustments');
    Route::get('deliveries', [ReportsController::class, 'deliveries'])->name('deliveries');
    Route::get('inventory-movements', [ReportsController::class, 'inventoryMovements'])->name('inventory-movements');
});
```

### Frontend (Inertia.js + React + TypeScript)

#### Dashboard Page
**Location**: `resources/js/pages/dashboard/index.tsx`

**Features**:
- Sales KPIs (today, this week, this month)
- Sales by status (with clickable links to filtered reports)
- Payments KPIs (payments received, outstanding balances, counts)
- Deliveries KPIs (pending, partial, delivered, canceled)
- Inventory KPIs (low stock, fast-moving items, inventory value)
- Recent activity feed (last 5 sales, refunds, adjustments)

**Key Behaviors**:
- All KPI cards are clickable and link to corresponding reports
- Status badges link to filtered reports
- Recent activity items link to detailed views

#### Report Pages
**Location**: `resources/js/pages/reports/`

1. **sales.tsx**: Sales report with filters (date, cashier, status)
2. **payments.tsx**: Payments report with filters (date, method, status, type)
3. **refunds-adjustments.tsx**: Refunds & adjustments report with tabs
4. **deliveries.tsx**: Deliveries report with filters (date, status)
5. **inventory-movements.tsx**: Inventory movements report with filters (date, type, variant, reason)

**Common Features**:
- Date range filters
- Status/type filters
- Pagination
- Summary totals
- Drill-down to detailed views
- Export-ready data structure

## Dashboard KPI Structure

### Sales KPIs
- **Today/This Week/This Month**:
  - Gross sales
  - Net sales (after refunds)
- **By Status**:
  - OPEN, PARTIAL, COMPLETED, PARTIALLY_REFUNDED, REFUNDED, VOIDED
  - Count, gross sales, total refunded, net sales for each status

### Payments KPIs
- **Today/This Week/This Month**:
  - Total payments received
  - Outstanding balances
  - Fully paid count
  - Partially paid count
  - Unpaid count

### Deliveries KPIs
- **Today/This Week/This Month**:
  - Pending deliveries
  - Partial deliveries
  - Completed deliveries
  - Canceled deliveries

### Inventory KPIs
- Low-stock items (quantity ≤ 5)
- Fast-moving items (most OUT movements in last 30 days)
- Total inventory value

### Recent Activity
- Last 5 sales (read-only)
- Last 5 refunds
- Last 5 adjustments

## Status Rules (Enforced)

### Sale Status Priority
1. **VOIDED** (immutable)
2. **REFUNDED** (total_refunded >= sale.total)
3. **PARTIALLY_REFUNDED** (0 < total_refunded < sale.total)
4. **COMPLETED** (FULLY_PAID + DELIVERED or no delivery)
5. **PARTIAL** (PARTIALLY_PAID or FULLY_PAID + PARTIAL/PENDING delivery)
6. **OPEN** (UNPAID + PENDING or no delivery)

### Payment Status
- **UNPAID**: No payment received
- **PARTIALLY_PAID**: Some payment but not full
- **FULLY_PAID**: Payment >= total
- **PARTIALLY_REFUNDED**: Refund exists but not full
- **REFUNDED**: Total refunded >= total

### Delivery Status
- **PENDING**: No items delivered
- **PARTIAL**: Some items delivered
- **DELIVERED**: All items delivered
- **CANCELED**: All items canceled/refunded

## Security & Authorization

### Role-Based Access
- **Admin (owner/manager)**: Full access to dashboard and all reports
- **Staff (cashier)**: No access to dashboard or reports

### Implementation
- Controllers check `$request->user()->isAdmin()` before processing
- Returns 403 if unauthorized
- Frontend can optionally hide navigation items (but backend is authoritative)

## Data Consistency

### Dashboard-Report Alignment
1. Dashboard queries use the same base query methods as reports
2. Dashboard aggregates use the same calculation logic as reports
3. Time-based filters (today, this week, this month) use the same date logic
4. Status filters use the same enum values

### Example: Sales Total
- **Dashboard**: `SalesReportQueryService::getGrossSalesTotal(['date_from' => today])`
- **Report**: `SalesReportQueryService::baseQuery(['date_from' => today])->sum('total')`
- **Result**: Both return the same value

## Why Dashboard is Read-Only

1. **Separation of Concerns**: Dashboard is for viewing, not acting
2. **Data Integrity**: Prevents accidental mutations from summary views
3. **Audit Trail**: All mutations must go through proper transaction flows
4. **BIR Compliance**: Immutable history requirements
5. **User Experience**: Clear distinction between viewing and acting

## Future Enhancements (Not Included)

- Export to Excel/PDF (structure ready, implementation pending)
- Custom date ranges on dashboard (currently fixed: today, week, month)
- Real-time updates (currently requires refresh)
- Charts and graphs (data structure ready)
- Email reports (structure ready)

## Testing Considerations

1. **Authorization Tests**: Verify admin-only access
2. **Data Consistency Tests**: Dashboard totals match report totals
3. **Filter Tests**: All filters work correctly
4. **Pagination Tests**: Pagination works across all reports
5. **Status Tests**: Status calculations are correct

## Notes

- All queries respect BIR compliance (no deletions, immutable history)
- All numbers are calculated from actual database records
- No cached or pre-aggregated data (ensures accuracy)
- Dashboard refresh required to see latest data (no real-time updates)

