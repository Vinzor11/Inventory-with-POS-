<?php

use App\Http\Controllers\UsersController;
use App\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

// Delivery Landing page (no auth required)
Route::get('/', [\App\Http\Controllers\DeliveryLandingController::class, 'index'])->name('home');
Route::post('delivery-landing/{sale}/process', [\App\Http\Controllers\DeliveryLandingController::class, 'processDelivery'])->name('delivery-landing.process');
Route::get('delivery-landing/success/{delivery}', [\App\Http\Controllers\DeliveryLandingController::class, 'success'])->name('delivery-landing.success');

// Delivery Receipt Printing (no auth required - for delivery landing page)
Route::get('receipts/deliveries/{delivery}', [\App\Http\Controllers\ReceiptController::class, 'deliveryReceipt'])->name('receipts.deliveries');

// Weigh-Ins Landing page (no auth required)
Route::get('weigh-ins-landing', [\App\Http\Controllers\WeighInsLandingController::class, 'index'])->name('weigh-ins-landing');
Route::post('weigh-ins-landing/store', [\App\Http\Controllers\WeighInsLandingController::class, 'store'])->name('weigh-ins-landing.store');
Route::post('weigh-ins-landing/batch-store', [\App\Http\Controllers\WeighInsLandingController::class, 'batchStore'])->name('weigh-ins-landing.batch-store');
Route::post('weigh-ins-landing/process-payments', [\App\Http\Controllers\WeighInsLandingController::class, 'processPayments'])->name('weigh-ins-landing.process-payments');
Route::post('weigh-ins-landing/{weighIn}/process-payment', [\App\Http\Controllers\WeighInsLandingController::class, 'processPayment'])->name('weigh-ins-landing.process-payment');
Route::get('weigh-ins-landing/success/{id}', [\App\Http\Controllers\WeighInsLandingController::class, 'success'])->name('weigh-ins-landing.success');

// Unpaid weigh-ins (no auth required, PIN required only when marking as paid)
Route::get('weigh-ins-landing/unpaid', [\App\Http\Controllers\WeighInsLandingController::class, 'unpaid'])->name('weigh-ins-landing.unpaid');
Route::post('weigh-ins-landing/{transaction}/mark-as-paid', [\App\Http\Controllers\WeighInsLandingController::class, 'markAsPaid'])->name('weigh-ins-landing.mark-as-paid');

// Weigh-In Receipt Printing (no auth required - for weigh-ins landing page)
Route::get('receipts/weigh-ins/{transaction}', [\App\Http\Controllers\ReceiptController::class, 'weighInReceipt'])->name('receipts.weigh-ins');

Route::get('welcome', function () {
    return Inertia::render('welcome');
})->name('welcome');

Route::middleware(['auth', 'verified'])->group(function () {
    // Phase 6: Owner/Manager Dashboard & Reports (Admin only)
    Route::get('dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');
    
    Route::prefix('reports')->name('reports.')->group(function () {
        Route::get('sales', [\App\Http\Controllers\ReportsController::class, 'sales'])->name('sales');
        Route::get('payments', [\App\Http\Controllers\ReportsController::class, 'payments'])->name('payments');
        Route::get('refunds-adjustments', [\App\Http\Controllers\ReportsController::class, 'refundsAdjustments'])->name('refunds-adjustments');
        Route::get('deliveries', [\App\Http\Controllers\ReportsController::class, 'deliveries'])->name('deliveries');
        Route::get('inventory-movements', [\App\Http\Controllers\ReportsController::class, 'inventoryMovements'])->name('inventory-movements');
        Route::get('weigh-ins', [\App\Http\Controllers\ReportsController::class, 'weighIns'])->name('weigh-ins');
    });
    
    Route::get('pos', [PosController::class, 'index'])->name('pos');

    // Phase 3: POS Sales
    Route::post('pos/checkout', [PosController::class, 'checkout'])->name('pos.checkout');
    Route::get('pos/checkout/success/{sale}', [PosController::class, 'checkoutSuccess'])->name('pos.checkout.success');
    
    // Sales Receipt Printing (ESC/POS) - requires auth
    Route::get('receipts/sales/{sale}', [\App\Http\Controllers\ReceiptController::class, 'salesReceipt'])->name('receipts.sales');
    
    // Agricultural Products Sales (for copra/coconut)
    Route::get('agricultural-sales/stock-summary', [\App\Http\Controllers\AgriculturalSalesController::class, 'getStockSummary'])->name('agricultural-sales.stock-summary');
    Route::post('agricultural-sales/checkout', [\App\Http\Controllers\AgriculturalSalesController::class, 'checkout'])->name('agricultural-sales.checkout');
    
    // Sales Management
    Route::get('sales', [\App\Http\Controllers\SalesController::class, 'index'])->name('sales.index');
    Route::get('sales/{sale}', [\App\Http\Controllers\SalesController::class, 'show'])->name('sales.show');
    Route::post('sales/{sale}/void', [\App\Http\Controllers\SalesController::class, 'void'])->name('sales.void');
    Route::post('sales/{sale}/cancel-item', [\App\Http\Controllers\SalesController::class, 'cancelItem'])->name('sales.cancel-item');
    
    // Payments (Phase 3.5)
    Route::post('sales/{sale}/payments', [\App\Http\Controllers\PaymentController::class, 'store'])->name('sales.payments.store');
    
    // Refunds (Phase 6)
    Route::get('sales/{sale}/refund', [\App\Http\Controllers\RefundController::class, 'show'])->name('sales.refund.show');
    Route::post('sales/{sale}/refund', [\App\Http\Controllers\RefundController::class, 'store'])->name('sales.refund.store');
    Route::get('refunds', [\App\Http\Controllers\RefundController::class, 'index'])->name('refunds.index');

    Route::resource('users', UsersController::class)->except(['create', 'edit']);

    // Hardware Inventory Management System (HIMS) Routes
    Route::resource('product-categories', \App\Http\Controllers\ProductCategoriesController::class);
    Route::patch('product-categories/{product_category}/toggle', [\App\Http\Controllers\ProductCategoriesController::class, 'toggle'])->name('product-categories.toggle');

    Route::resource('products', \App\Http\Controllers\ProductsController::class);
    Route::patch('products/{product}/toggle-stock', [\App\Http\Controllers\ProductsController::class, 'toggleStock'])->name('products.toggle-stock');
    Route::patch('products/{product}/toggle-active', [\App\Http\Controllers\ProductsController::class, 'toggleActive'])->name('products.toggle-active');

    // Product Variants (nested under products)
    Route::resource('products.variants', \App\Http\Controllers\ProductVariantsController::class)->shallow();

    // Inventory Management - Phase 2
    // IMPORTANT: Specific routes must come BEFORE parameterized routes
    Route::get('inventory', [\App\Http\Controllers\InventoryController::class, 'index'])->name('inventory.index');
    
    // Inventory Dashboard
    Route::get('inventory/dashboard', [\App\Http\Controllers\InventoryDashboardController::class, 'index'])->name('inventory.dashboard');
    
    // Stock-In (Admin only)
    Route::get('inventory/stock-in', [\App\Http\Controllers\StockInController::class, 'create'])->name('inventory.stock-in.create');
    Route::post('inventory/stock-in', [\App\Http\Controllers\StockInController::class, 'store'])->name('inventory.stock-in.store');
    
    // Inventory Adjustment (Admin only)
    Route::get('inventory/adjustment', [\App\Http\Controllers\InventoryAdjustmentController::class, 'create'])->name('inventory.adjustment.create');
    Route::post('inventory/adjustment', [\App\Http\Controllers\InventoryAdjustmentController::class, 'store'])->name('inventory.adjustment.store');
    
    // Inventory Movement History (View only)
    Route::get('inventory/movements', [\App\Http\Controllers\InventoryMovementHistoryController::class, 'index'])->name('inventory.movements.index');
    
    // Parameterized routes must come AFTER specific routes
    Route::get('inventory/{variant}', [\App\Http\Controllers\InventoryController::class, 'show'])->name('inventory.show');
    Route::post('inventory/{variant}/adjust', [\App\Http\Controllers\InventoryController::class, 'adjust'])->name('inventory.adjust');
    Route::post('inventory/{variant}/set-initial', [\App\Http\Controllers\InventoryController::class, 'setInitialStock'])->name('inventory.set-initial');

    // Phase 4: Operational Tracking
    // Deliveries
    Route::get('deliveries', [\App\Http\Controllers\DeliveriesController::class, 'index'])->name('deliveries.index');
    Route::get('deliveries/{delivery}', [\App\Http\Controllers\DeliveriesController::class, 'show'])->name('deliveries.show');
    
    // Phase 4.5: Delivery for specific sale
    Route::get('sales/{sale}/delivery', [\App\Http\Controllers\DeliveriesController::class, 'forSale'])->name('deliveries.for-sale');
    Route::post('sales/{sale}/deliveries', [\App\Http\Controllers\DeliveriesController::class, 'addItems'])->name('deliveries.add-items');
    
    // Delivery Landing Page (also accessible without auth)
    Route::get('delivery-landing', [\App\Http\Controllers\DeliveryLandingController::class, 'index'])->name('delivery-landing');


    // Weigh-ins
    Route::get('weigh-ins', [\App\Http\Controllers\WeighInsController::class, 'index'])->name('weigh-ins.index');
    Route::get('weigh-ins/create', [\App\Http\Controllers\WeighInsController::class, 'create'])->name('weigh-ins.create');
    Route::post('weigh-ins', [\App\Http\Controllers\WeighInsController::class, 'store'])->name('weigh-ins.store');
    
    // Weigh-in Prices Management (must come before parameterized route)
    Route::get('weigh-ins/prices', [\App\Http\Controllers\WeighInPricesController::class, 'index'])->name('weigh-ins.prices.index');
    Route::put('weigh-ins/prices/{type}', [\App\Http\Controllers\WeighInPricesController::class, 'update'])->name('weigh-ins.prices.update');
    
    // Parameterized route must come last
    Route::get('weigh-ins/{weighIn}', [\App\Http\Controllers\WeighInsController::class, 'show'])->name('weigh-ins.show');
    Route::put('weigh-ins/{id}/status', [\App\Http\Controllers\WeighInsController::class, 'updateStatus'])->name('weigh-ins.update-status');
});

require __DIR__.'/settings.php';
