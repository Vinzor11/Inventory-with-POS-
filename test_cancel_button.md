# Quick Debug: Cancel Button Not Showing

## Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to a sale detail page: `/sales/{sale_id}`
4. Look for logs like:
   ```
   Item cancel check: { itemId: X, deliveredQty: 0, itemStatus: 'ACTIVE', canCancel: true }
   ```

## Step 2: Verify Data in Database
Run this SQL query to check a specific sale:
```sql
SELECT 
    si.id,
    si.quantity,
    si.delivered_quantity,
    si.item_status,
    si.line_total,
    s.status as sale_status,
    s.payment_status
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE si.sale_id = YOUR_SALE_ID;
```

## Step 3: Check Network Response
1. Open DevTools → Network tab
2. Navigate to sale detail page
3. Find the request to `/sales/{sale_id}`
4. Check the response JSON
5. Verify `items` array contains:
   - `delivered_quantity` field
   - `item_status` field

## Step 4: Manual Test
If you see in the Actions column:
- "Cannot cancel" → Item has delivered_quantity > 0 or is already canceled
- "Sale voided" → Sale status is VOIDED
- "Sale refunded" → Sale status is REFUNDED
- Nothing → Button should be visible

## Common Issues:

### Issue: Button not showing, no error message
**Possible causes:**
- Frontend not rebuilt (run `npm run build` or `npm run dev`)
- Browser cache (hard refresh: Ctrl+Shift+R)
- Data not being sent from backend

### Issue: "Cannot cancel" showing
**Check:**
- Is `delivered_quantity` > 0? (Item was delivered)
- Is `item_status` = 'CANCELED'? (Already canceled)

### Issue: Console shows `deliveredQty: undefined`
**Fix:** Backend not sending the field. Check:
```php
// In SalesController::show()
$sale->load(['items.productVariant.product.category']);
// Items should automatically include delivered_quantity and item_status
```

## Quick Fix: Force Show Button (for testing)
Temporarily modify the condition in `resources/js/pages/sales/show.tsx`:
```typescript
// Change this line (around line 530):
{canCancel && sale.status !== 'VOIDED' && sale.status !== 'REFUNDED' && sale.status !== 'PARTIALLY_REFUNDED' ? (

// To this (for testing only):
{true && sale.status !== 'VOIDED' && sale.status !== 'REFUNDED' && sale.status !== 'PARTIALLY_REFUNDED' ? (
```
This will show the button for all items (for testing purposes only).

