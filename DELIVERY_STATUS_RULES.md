# Delivery Status Rules

## Overview
There are two types of delivery statuses in the system:
1. **Delivery Status** (`delivery.status`) - Status of individual Delivery record (lowercase)
2. **Sale Delivery Status** (`sale.delivery_status`) - Overall delivery status of the Sale (uppercase)

---

## Delivery Status Rules (`delivery.status`)

### Values: `pending`, `partial`, `delivered`

### Calculation Logic:
The status is computed automatically based on delivered quantities vs remaining quantities (after refunds and cancellations).

#### Formula:
```
Remaining Quantity = Sold Quantity - Refunded Quantity - Canceled Quantity
Delivered Quantity = Sum of all delivery items for this variant
```

### Rules:

#### 1. **`pending`** (No items delivered)
**Conditions:**
- No delivery items exist, AND
- There are items remaining to deliver (not all refunded/canceled)

**OR**

- Some items exist but none have been delivered yet
- `delivered_quantity = 0` for all items

**Example:**
- Sale: 5 items sold, 0 delivered, 0 refunded, 0 canceled
- Status: `pending`

---

#### 2. **`partial`** (Some items delivered, but not all)
**Conditions:**
- At least one item has been delivered (`delivered_quantity > 0`)
- At least one item still has remaining quantity to deliver
- `delivered_quantity < remaining_quantity` for at least one item

**Example:**
- Sale: 5 items sold, 3 delivered, 0 refunded, 0 canceled
- Remaining: 5 - 3 = 2 items
- Status: `partial`

**OR**

- Sale: 5 items sold, 3 delivered, 0 refunded, 2 canceled
- Remaining: 5 - 0 - 2 = 3 items (but 3 already delivered)
- Status: `partial` (because some items were canceled, creating partial state)

---

#### 3. **`delivered`** (All remaining items delivered)
**Conditions:**
- At least one item has been delivered (`delivered_quantity > 0`)
- All remaining items (after refunds/cancellations) are fully delivered
- `delivered_quantity >= remaining_quantity` for all items
- No items left to deliver

**Example:**
- Sale: 5 items sold, 5 delivered, 0 refunded, 0 canceled
- Status: `delivered`

**OR**

- Sale: 5 items sold, 3 delivered, 0 refunded, 2 canceled
- Remaining: 5 - 0 - 2 = 3 items
- Delivered: 3 items
- Status: `delivered` (all remaining items delivered)

---

## Sale Delivery Status Rules (`sale.delivery_status`)

### Values: `PENDING`, `PARTIAL`, `DELIVERED`, `CANCELED`, `RETURNED`

### Calculation Logic:
The status is computed automatically and updated when:
- Delivery items are added/removed
- Items are refunded
- Items are canceled/adjusted
- Sale is adjusted

---

### Rules:

#### 1. **`PENDING`** (Delivery not started)
**Conditions:**
- Sale is for delivery (`is_for_delivery = true`)
- No items have been delivered yet (`delivered_quantity = 0` for all items)
- There are items remaining to deliver (not all canceled/refunded)

**Example:**
- Sale: 5 items sold, 0 delivered, 0 refunded, 0 canceled
- Status: `PENDING`

---

#### 2. **`PARTIAL`** (Some items delivered, some pending/canceled)
**Conditions:**
- At least one item has been delivered (`delivered_quantity > 0`)
- At least one item still has remaining quantity to deliver
- OR: Some items delivered AND some items canceled/adjusted

**Specific Cases:**
- **Case A:** Some delivered, some pending
  - Sale: 5 items sold, 3 delivered, 0 refunded, 0 canceled
  - Status: `PARTIAL`

- **Case B:** Some delivered, some canceled
  - Sale: 5 items sold, 3 delivered, 0 refunded, 2 canceled
  - Status: `PARTIAL`

- **Case C:** Items with `PARTIAL_ADJUSTED` status
  - Sale: 5 items sold, 3 delivered, 0 refunded, 2 canceled (item_status = PARTIAL_ADJUSTED)
  - Status: `PARTIAL`

**Code Logic:**
```php
if (($hasDeliveredItems && $hasCanceledItems) || $hasPartiallyAdjustedItems) {
    // Some items delivered, some canceled → PARTIAL
    $this->update(['delivery_status' => 'PARTIAL']);
}
```

---

#### 3. **`DELIVERED`** (All remaining items delivered)
**Conditions:**
- All remaining items (after refunds/cancellations) are fully delivered
- No items left to deliver
- `delivered_quantity >= remaining_quantity` for all items
- `hasDeliverableItems = false` AND `hasDeliveredItems = true`

**Example:**
- Sale: 5 items sold, 5 delivered, 0 refunded, 0 canceled
- Status: `DELIVERED`

**OR**

- Sale: 5 items sold, 3 delivered, 0 refunded, 2 canceled
- Remaining: 5 - 0 - 2 = 3 items
- Delivered: 3 items
- Status: `DELIVERED` (all remaining items delivered)

**Code Logic:**
```php
if (!$hasDeliverableItems && $hasDeliveredItems) {
    // All remaining items delivered
    $this->update(['delivery_status' => 'DELIVERED']);
}
```

---

#### 4. **`CANCELED`** (No delivery needed)
**Conditions:**
- All items are canceled or refunded
- No items remaining to deliver
- `hasDeliverableItems = false` AND `hasDeliveredItems = false`

**Specific Cases:**
- **Case A:** All items canceled
  - Sale: 5 items sold, 0 delivered, 0 refunded, 5 canceled
  - Status: `CANCELED`

- **Case B:** All items refunded
  - Sale: 5 items sold, 0 delivered, 5 refunded, 0 canceled
  - Status: `CANCELED`

- **Case C:** Mix of canceled and refunded
  - Sale: 5 items sold, 0 delivered, 2 refunded, 3 canceled
  - Status: `CANCELED`

**Code Logic:**
```php
if (!$hasDeliverableItems && !$hasDeliveredItems) {
    // All items canceled, no delivery needed
    $this->update(['delivery_status' => 'CANCELED']);
}
```

---

#### 5. **`RETURNED`** (Items were delivered then returned/refunded)
**Note:** This status is defined in the enum but may not be actively used in current logic. It would apply when:
- Items were previously delivered
- Those delivered items are then refunded/returned
- This creates a "returned" state

---

## Key Formulas

### Remaining Quantity Calculation:
```
Remaining = Sold - Delivered - Refunded - Canceled
```

### Deliverable Items Check:
```sql
(quantity - COALESCE(delivered_quantity, 0) - COALESCE(canceled_quantity, 0)) > 0
```

### Status Update Triggers:
1. When delivery items are added (`Delivery::computeStatus()`)
2. When items are refunded
3. When items are canceled/adjusted (`Sale::adjustSale()`)
4. When sale is updated

---

## Status Synchronization

- When `Delivery::computeStatus()` runs, it updates both:
  - `delivery.status` (lowercase: pending/partial/delivered)
  - `sale.delivery_status` (uppercase: PENDING/PARTIAL/DELIVERED/CANCELED)

- When `Sale::adjustSale()` runs (after item cancellation), it updates:
  - `sale.delivery_status` based on deliverable/delivered/canceled items

---

## Examples

### Example 1: Simple Partial Delivery
- **Sale:** 10 items sold
- **Delivered:** 6 items
- **Refunded:** 0
- **Canceled:** 0
- **Remaining:** 10 - 6 = 4 items
- **Delivery Status:** `partial`
- **Sale Delivery Status:** `PARTIAL`

### Example 2: Partial with Cancellation
- **Sale:** 10 items sold
- **Delivered:** 6 items
- **Refunded:** 0
- **Canceled:** 2 items
- **Remaining:** 10 - 6 - 2 = 2 items (but 2 are canceled, so 0 deliverable)
- **Delivery Status:** `partial` (some delivered, some canceled)
- **Sale Delivery Status:** `PARTIAL`

### Example 3: Fully Delivered After Cancellation
- **Sale:** 10 items sold
- **Delivered:** 8 items
- **Refunded:** 0
- **Canceled:** 2 items
- **Remaining:** 10 - 8 - 2 = 0 items (all remaining delivered)
- **Delivery Status:** `delivered`
- **Sale Delivery Status:** `DELIVERED`

### Example 4: All Canceled
- **Sale:** 10 items sold
- **Delivered:** 0 items
- **Refunded:** 0
- **Canceled:** 10 items
- **Remaining:** 10 - 0 - 10 = 0 items (all canceled)
- **Delivery Status:** `pending` (no delivery needed)
- **Sale Delivery Status:** `CANCELED`

---

## Important Notes

1. **Statuses are computed automatically** - They are not manually set
2. **Refunded items** are excluded from delivery calculations
3. **Canceled items** are excluded from delivery calculations
4. **Both statuses are updated** when delivery items are added/removed
5. **Sale delivery status** considers all items across the entire sale
6. **Delivery status** considers only the specific delivery record

