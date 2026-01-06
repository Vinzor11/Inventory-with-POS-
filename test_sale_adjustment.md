# Testing Guide: Sale Adjustment (Cancel Undelivered Items)

## Prerequisites
- At least 3 products with variants in the system
- A user account with admin/staff role
- Access to POS, Sales, and Deliveries pages

## Test Scenario: Cancel Undelivered Item After Partial Payment

### Step 1: Create a Sale with Multiple Items
1. Navigate to `/pos`
2. Add 3 different items to cart:
   - Item A: ₱40 (quantity: 1)
   - Item B: ₱40 (quantity: 1)  
   - Item C: ₱40 (quantity: 1)
3. **Total: ₱120**
4. Check "For Delivery" checkbox
5. Complete checkout
6. Note the Sale Number (e.g., SALE-20251218-0001)

### Step 2: Make Partial Payment
1. Go to `/sales` and find your sale
2. Click on the sale to view details
3. Click "Add Payment" button
4. Enter payment amount: **₱100** (less than total of ₱120)
5. Select payment method (e.g., Cash)
6. Submit payment
7. **Expected**: 
   - Payment Status: PARTIALLY_PAID
   - Balance Remaining: ₱20
   - Sale Status: PARTIAL or OPEN

### Step 3: Deliver Some Items
1. Navigate to `/sales/{sale_id}/delivery` (or via Deliveries menu)
2. Add delivery items:
   - Item A: Deliver quantity 1
   - Item B: Deliver quantity 1
   - Item C: Leave undelivered (quantity 0)
3. Assign delivery person and date
4. Complete delivery
5. **Expected**:
   - Item A & B: Delivered quantity = 1
   - Item C: Delivered quantity = 0
   - Delivery Status: PARTIAL

### Step 4: Cancel Undelivered Item
1. Return to sale detail page: `/sales/{sale_id}`
2. In the Items table, locate **Item C**:
   - Should show: Delivered = 0.00, Status = Active
   - Should have a "Cancel" button
3. Click "Cancel" button on Item C
4. **Verify Modal Shows**:
   - Product: Item C name
   - Amount to Remove: ₱40
   - Current Sale Total: ₱120
   - New Sale Total: ₱80
   - Current Balance: ₱20
   - New Balance: ₱0 (or negative if overpaid)
5. Enter reason (optional): "Customer no longer needs this item"
6. Click "Confirm Cancellation"

### Step 5: Verify Results

#### ✅ Sale Total Recalculation
- **Before**: ₱120
- **After**: ₱80
- Sale total should be reduced by canceled item amount (₱40)

#### ✅ Payment Reconciliation
- **Paid**: ₱100
- **New Total**: ₱80
- **Balance**: ₱0 (or ₱20 change if system allows)
- **Payment Status**: Should update to FULLY_PAID (since ₱100 >= ₱80)

#### ✅ Status Updates
- **Sale Status**: COMPLETED (no balance due, no deliverable items remaining)
- **Delivery Status**: PARTIAL (some items delivered, some canceled)
- **Payment Status**: FULLY_PAID

#### ✅ Item Status
- **Item C**: 
  - Status badge shows "Canceled" (red)
  - Line total has strikethrough
  - No "Cancel" button visible
  - Delivered quantity still shows 0.00

#### ✅ Items A & B
- Status: Active
- Delivered: 1.00
- No "Cancel" button (because delivered_quantity > 0)

#### ✅ Audit Trail
- Check `sale_adjustments` table:
  ```sql
  SELECT * FROM sale_adjustments WHERE sale_id = {your_sale_id};
  ```
- Should show:
  - sale_id: your sale ID
  - sale_item_id: Item C's ID
  - amount_removed: 40.00
  - reason: "Customer no longer needs this item"
  - processed_by_user_id: your user ID

### Step 6: Test Edge Cases

#### ❌ Try to Cancel Delivered Item
1. Try to cancel Item A or B (delivered quantity > 0)
2. **Expected**: Cancel button should NOT be visible
3. If button appears, clicking should show error: "Item cannot be canceled. Only undelivered items can be canceled."

#### ❌ Try to Cancel Already Canceled Item
1. Try to cancel Item C again
2. **Expected**: Cancel button should NOT be visible (item status = CANCELED)

#### ✅ Verify No Inventory Restoration
1. Check inventory for Item C's product variant
2. **Expected**: Inventory quantity should NOT increase
3. Canceled items do NOT restore inventory (different from void)

#### ✅ Verify No Refund Created
1. Check refunds table/UI
2. **Expected**: No refund record created
3. This is an adjustment, not a refund

## Database Verification Queries

```sql
-- Check sale items status
SELECT id, quantity, delivered_quantity, item_status, line_total 
FROM sale_items 
WHERE sale_id = {your_sale_id};

-- Check sale adjustments
SELECT * FROM sale_adjustments WHERE sale_id = {your_sale_id};

-- Check sale totals and status
SELECT sale_number, total, status, payment_status, delivery_status 
FROM sales 
WHERE id = {your_sale_id};

-- Check payments
SELECT amount, payment_method FROM payments WHERE sale_id = {your_sale_id};
```

## Expected Final State

| Item | Quantity | Delivered | Status | Line Total |
|------|----------|-----------|--------|------------|
| Item A | 1.00 | 1.00 | Active | ₱40 |
| Item B | 1.00 | 1.00 | Active | ₱40 |
| Item C | 1.00 | 0.00 | **CANCELED** | ~~₱40~~ |

**Sale Summary:**
- Original Total: ₱120
- Adjusted Total: ₱80
- Paid: ₱100
- Balance: ₱0
- Payment Status: FULLY_PAID
- Sale Status: COMPLETED
- Delivery Status: PARTIAL

## Troubleshooting

### Issue: Cancel button not showing
- **Check**: Item must have `delivered_quantity = 0` and `item_status = 'ACTIVE'`
- **Check**: Sale must not be VOIDED or REFUNDED

### Issue: Error "Column not found: delivered_quantity"
- **Solution**: Run migrations: `php artisan migrate`

### Issue: Balance not updating correctly
- **Check**: Payment status update logic in `Sale::updatePaymentStatus()`
- **Check**: Sale total recalculation in `Sale::adjustSale()`

### Issue: Status not updating to COMPLETED
- **Check**: `Sale::computeSaleStatus()` method
- **Verify**: No balance due AND no deliverable items remaining

