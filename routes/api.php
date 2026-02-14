<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CookedCopraSaleController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\ProductionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RefundController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WeighInController;
use App\Http\Controllers\Api\WeighInPriceController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

// Public routes (no authentication required)
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/login-pin', [AuthController::class, 'loginWithPin']);

// Protected routes (require Sanctum token)
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    // Authentication
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/update-profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/update-password', [AuthController::class, 'updatePassword']);
    Route::put('/auth/update-pin', [AuthController::class, 'updatePin']);

    // POS endpoints
    Route::prefix('pos')->group(function () {
        Route::get('/products', [PosController::class, 'getProducts']);
        Route::get('/categories', [PosController::class, 'getCategories']);
        Route::post('/checkout', [PosController::class, 'checkout']);
        Route::post('/verify-pin', [PosController::class, 'verifyPin']);
    });

    // Categories
    Route::apiResource('categories', CategoryController::class);
    Route::patch('/categories/{category}/toggle', [CategoryController::class, 'toggle']);

    // Products
    Route::apiResource('products', ProductController::class);
    Route::get('/products/{product}/variants', [ProductController::class, 'getVariants']);
    Route::post('/products/{product}/variants', [ProductController::class, 'storeVariant']);
    Route::put('/products/{product}/variants/{variant}', [ProductController::class, 'updateVariant']);
    Route::delete('/products/{product}/variants/{variant}', [ProductController::class, 'destroyVariant']);
    Route::patch('/products/{product}/toggle-stock', [ProductController::class, 'toggleStock']);
    Route::patch('/products/{product}/toggle-active', [ProductController::class, 'toggleActive']);

    // Sales
    Route::apiResource('sales', SaleController::class)->only(['index', 'show']);
    Route::post('/sales/{sale}/void', [SaleController::class, 'void']);
    Route::post('/sales/{sale}/cancel-item', [SaleController::class, 'cancelItem']);

    // Payments
    Route::get('/sales/{sale}/payments', [PaymentController::class, 'index']);
    Route::post('/sales/{sale}/payments', [PaymentController::class, 'store']);

    // Refunds
    Route::get('/refunds', [RefundController::class, 'index']);
    Route::get('/sales/{sale}/refund', [RefundController::class, 'show']);
    Route::post('/sales/{sale}/refund', [RefundController::class, 'store']);

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/dashboard', [InventoryController::class, 'dashboard']);
    Route::get('/inventory/movements', [InventoryController::class, 'movements']);
    Route::get('/inventory/{variant}', [InventoryController::class, 'show']);
    Route::post('/inventory/{variant}/adjust', [InventoryController::class, 'adjust']);
    Route::post('/inventory/{variant}/set-initial', [InventoryController::class, 'setInitialStock']);
    Route::post('/inventory/stock-in', [InventoryController::class, 'stockIn']);

    // Production
    Route::get('/production/runs', [ProductionController::class, 'index']);
    Route::post('/production/runs', [ProductionController::class, 'store']);

    // Agricultural stock-out (Cooked Copra)
    Route::get('/cooked-copra/stock-summary', [CookedCopraSaleController::class, 'stockSummary']);
    Route::post('/cooked-copra/sales', [CookedCopraSaleController::class, 'store']);

    // Deliveries
    Route::get('/deliveries', [DeliveryController::class, 'index']);
    Route::get('/deliveries/{delivery}', [DeliveryController::class, 'show']);
    Route::get('/sales/{sale}/delivery', [DeliveryController::class, 'forSale']);
    Route::post('/sales/{sale}/deliveries', [DeliveryController::class, 'addItems']);

    // Weigh-ins
    Route::get('/weigh-ins', [WeighInController::class, 'index']);
    Route::get('/weigh-ins/unpaid', [WeighInController::class, 'unpaid']);
    Route::get('/weigh-ins/landing', [WeighInPriceController::class, 'landing']);
    Route::get('/weigh-ins/{weighIn}', [WeighInController::class, 'show']);
    Route::post('/weigh-ins', [WeighInController::class, 'store']);
    Route::post('/weigh-ins/batch-store', [WeighInController::class, 'batchStore']);
    Route::put('/weigh-ins/{weighIn}/status', [WeighInController::class, 'updateStatus']);
    Route::post('/weigh-ins/{weighIn}/process-payment', [WeighInController::class, 'processPayment']);
    Route::post('/weigh-ins/{weighIn}/mark-as-paid', [WeighInController::class, 'markAsPaid']);

    // Weigh-in Prices
    Route::get('/weigh-in-prices', [WeighInPriceController::class, 'index']);
    Route::put('/weigh-in-prices/{type}', [WeighInPriceController::class, 'update']);

    // Users (admin only)
    Route::apiResource('users', UserController::class);

    // Dashboard & Reports (admin only)
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::prefix('reports')->group(function () {
        Route::get('/sales', [ReportController::class, 'sales']);
        Route::get('/payments', [ReportController::class, 'payments']);
        Route::get('/refunds-adjustments', [ReportController::class, 'refundsAdjustments']);
        Route::get('/deliveries', [ReportController::class, 'deliveries']);
        Route::get('/inventory-movements', [ReportController::class, 'inventoryMovements']);
        Route::get('/weigh-ins', [ReportController::class, 'weighIns']);
    });

    // Receipts
    Route::get('/receipts/sales/{sale}', [SaleController::class, 'receipt']);
    Route::get('/receipts/deliveries/{delivery}', [DeliveryController::class, 'receipt']);
    Route::get('/receipts/weigh-ins/{transaction}', [WeighInController::class, 'receipt']);
});

