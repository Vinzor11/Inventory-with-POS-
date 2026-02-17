package com.hims.nativeapp.data.model

import com.google.gson.annotations.SerializedName

data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T,
)

data class PaginatedData<T>(
    @SerializedName("current_page")
    val currentPage: Int = 1,
    @SerializedName("last_page")
    val lastPage: Int = 1,
    val total: Int = 0,
    val data: List<T> = emptyList(),
)

data class LoginRequest(
    val email: String,
    val password: String,
    @SerializedName("device_name")
    val deviceName: String = "android-native",
)

data class LoginData(
    val user: User,
    val token: String,
)

data class User(
    val id: Int,
    val name: String,
    val email: String? = null,
    val role: String? = null,
    @SerializedName("is_active")
    val isActive: Boolean = true,
)

data class Product(
    val id: Int,
    val name: String,
    val description: String? = null,
    val brand: String? = null,
    val sku: String? = null,
    @SerializedName(value = "image", alternate = ["image_url"])
    val image: String? = null,
    @SerializedName("base_unit")
    val baseUnit: String? = null,
    @SerializedName("is_active")
    val isActive: Boolean = true,
    @SerializedName("track_stock")
    val trackStock: Boolean = true,
    @SerializedName("created_at")
    val createdAt: String? = null,
    val category: ProductCategory? = null,
    val variants: List<ProductVariant> = emptyList(),
)

data class ProductCategory(
    val id: Int,
    val name: String,
)

data class ProductVariant(
    val id: Int,
    val sku: String? = null,
    val description: String? = null,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    @SerializedName("pending_unit_price")
    val pendingUnitPrice: Double? = null,
    @SerializedName("pending_price_quantity")
    val pendingPriceQuantity: Double? = null,
    @SerializedName("cost_price")
    val costPrice: Double? = null,
    @SerializedName("reserved_for_delivery")
    val reservedForDelivery: Double? = null,
    @SerializedName("available_quantity")
    val availableQuantity: Double? = null,
    val inventory: Inventory? = null,
)

data class ProductVariantUpsertRequest(
    val sku: String? = null,
    val description: String,
    @SerializedName("unit_price")
    val unitPrice: Double,
    @SerializedName("cost_price")
    val costPrice: Double? = null,
)

data class Inventory(
    @SerializedName("quantity_on_hand")
    val quantityOnHand: Double = 0.0,
)

data class ProductVariantInfo(
    val id: Int,
    val description: String? = null,
    val product: ProductLite? = null,
)

data class ProductLite(
    val id: Int,
    val name: String,
    val image: String? = null,
    @SerializedName("base_unit")
    val baseUnit: String? = null,
)

data class SaleItem(
    val id: Int,
    val quantity: Double = 0.0,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    @SerializedName("line_total")
    val lineTotal: Double = 0.0,
    @SerializedName("unit_cost")
    val unitCost: Double? = null,
    @SerializedName("total_cost")
    val totalCost: Double? = null,
    val profit: Double? = null,
    @SerializedName("delivered_quantity")
    val deliveredQuantity: Double? = null,
    @SerializedName("refunded_quantity")
    val refundedQuantity: Double? = null,
    @SerializedName("canceled_quantity")
    val canceledQuantity: Double? = null,
    @SerializedName("item_status")
    val itemStatus: String? = null,
    @SerializedName("product_variant")
    val productVariant: ProductVariantInfo,
)

data class Sale(
    val id: Int,
    @SerializedName("sale_number")
    val saleNumber: String,
    val status: String,
    @SerializedName("payment_status")
    val paymentStatus: String? = null,
    @SerializedName("delivery_status")
    val deliveryStatus: String? = null,
    @SerializedName("is_for_delivery")
    val isForDelivery: Boolean = false,
    @SerializedName("delivery_name")
    val deliveryName: String? = null,
    @SerializedName("delivery_address")
    val deliveryAddress: String? = null,
    @SerializedName("delivery_contact")
    val deliveryContact: String? = null,
    @SerializedName("created_at")
    val createdAt: String,
    @SerializedName("has_remaining_delivery")
    val hasRemainingDelivery: Boolean? = null,
    val subtotal: Double = 0.0,
    val total: Double = 0.0,
    val notes: String? = null,
    val cashier: User? = null,
    val items: List<SaleItem> = emptyList(),
    val payments: List<SalePayment> = emptyList(),
    val refunds: List<SaleRefund> = emptyList(),
    val deliveries: List<Delivery> = emptyList(),
    @SerializedName("voided_by")
    val voidedBy: User? = null,
    @SerializedName("voided_at")
    val voidedAt: String? = null,
    @SerializedName("void_reason")
    val voidReason: String? = null,
)

data class DeliveryItem(
    val id: Int,
    @SerializedName("sale_item_id")
    val saleItemId: Int? = null,
    val quantity: Double = 0.0,
    @SerializedName("remaining_quantity")
    val remainingQuantity: Double? = null,
    @SerializedName("product_variant")
    val productVariant: ProductVariantInfo,
)

data class DeliverySale(
    val id: Int,
    @SerializedName("sale_number")
    val saleNumber: String,
    @SerializedName("delivery_status")
    val deliveryStatus: String? = null,
    @SerializedName("delivery_name")
    val deliveryName: String? = null,
    @SerializedName("delivery_address")
    val deliveryAddress: String? = null,
    @SerializedName("delivery_contact")
    val deliveryContact: String? = null,
    @SerializedName("created_at")
    val createdAt: String,
)

data class Delivery(
    val id: Int,
    val status: String,
    @SerializedName("delivered_at")
    val deliveredAt: String? = null,
    @SerializedName("delivered_by")
    val deliveredBy: User? = null,
    @SerializedName("created_at")
    val createdAt: String,
    val notes: String? = null,
    val sale: DeliverySale? = null,
    val items: List<DeliveryItem> = emptyList(),
)

data class InventoryVariant(
    val id: Int,
    val description: String? = null,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    val product: InventoryProduct,
    val inventory: Inventory? = null,
)

data class InventoryProduct(
    val id: Int,
    val name: String,
    val brand: String? = null,
    val sku: String? = null,
    val image: String? = null,
    @SerializedName("base_unit")
    val baseUnit: String? = null,
    val category: ProductCategory? = null,
)

data class InventoryDashboardData(
    @SerializedName("total_value")
    val totalValue: Double = 0.0,
    @SerializedName("hardware_stock")
    val hardwareStock: Double = 0.0,
    @SerializedName("agricultural_stock")
    val agriculturalStock: Double = 0.0,
    @SerializedName("hardware_value")
    val hardwareValue: Double = 0.0,
    @SerializedName("agricultural_value")
    val agriculturalValue: Double = 0.0,
    @SerializedName("low_stock_count")
    val lowStockCount: Int = 0,
    @SerializedName("out_of_stock_count")
    val outOfStockCount: Int = 0,
    @SerializedName("total_items")
    val totalItems: Int = 0,
    @SerializedName("low_stock_items")
    val lowStockItems: List<InventoryDashboardItem> = emptyList(),
)

data class InventoryDashboardItem(
    val id: Int,
    val description: String? = null,
    val product: InventoryProduct? = null,
    val inventory: Inventory? = null,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
)

data class CookedCopraStockSummary(
    @SerializedName("variant_id")
    val variantId: Int,
    @SerializedName("product_id")
    val productId: Int,
    val name: String,
    val description: String? = null,
    val unit: String = "kg",
    val stock: Double = 0.0,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    @SerializedName("average_cost")
    val averageCost: Double = 0.0,
)

data class CookedCopraSaleRequest(
    val quantity: Double,
    @SerializedName("unit_price")
    val unitPrice: Double,
    @SerializedName("sale_date")
    val saleDate: String? = null,
    @SerializedName("customer_name")
    val customerName: String? = null,
    val notes: String? = null,
)

data class CookedCopraSaleResult(
    @SerializedName("production_run_id")
    val productionRunId: Int,
    @SerializedName("batch_code")
    val batchCode: String,
    val quantity: Double = 0.0,
    val unit: String = "kg",
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    @SerializedName("unit_cost")
    val unitCost: Double = 0.0,
    @SerializedName("total_revenue")
    val totalRevenue: Double = 0.0,
    @SerializedName("total_cost")
    val totalCost: Double = 0.0,
    @SerializedName("gross_profit")
    val grossProfit: Double = 0.0,
    @SerializedName("production_date")
    val productionDate: String? = null,
)

data class InventoryMovement(
    val id: Int,
    @SerializedName("product_variant_id")
    val productVariantId: Int? = null,
    val quantity: Double = 0.0,
    val type: String? = null,
    val reason: String? = null,
    @SerializedName("reference_id")
    val referenceId: Int? = null,
    @SerializedName("unit_cost")
    val unitCost: Double? = null,
    val notes: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("product_variant")
    val productVariant: ProductVariantInfo? = null,
    @SerializedName("recorded_by")
    val recordedBy: User? = null,
)

data class ProductionLine(
    val id: Int,
    val direction: String = "",
    val qty: Double = 0.0,
    val unit: String? = null,
    @SerializedName("unit_cost")
    val unitCost: Double? = null,
    @SerializedName("total_cost")
    val totalCost: Double? = null,
)

data class ProductionRun(
    val id: Int,
    @SerializedName("batch_code")
    val batchCode: String = "",
    @SerializedName("run_type")
    val runType: String = "",
    @SerializedName("production_date")
    val productionDate: String = "",
    @SerializedName("input_qty")
    val inputQty: Double = 0.0,
    @SerializedName("output_qty")
    val outputQty: Double = 0.0,
    @SerializedName("yield_percent")
    val yieldPercent: Double? = null,
    @SerializedName("shrinkage_qty")
    val shrinkageQty: Double? = null,
    @SerializedName("shrinkage_percent")
    val shrinkagePercent: Double? = null,
    @SerializedName("total_input_cost")
    val totalInputCost: Double = 0.0,
    @SerializedName("output_unit_cost")
    val outputUnitCost: Double = 0.0,
    val notes: String? = null,
    val operator: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    val lines: List<ProductionLine> = emptyList(),
)

data class ProductionRunRequest(
    @SerializedName("run_type")
    val runType: String,
    @SerializedName("input_qty")
    val inputQty: Double,
    @SerializedName("output_weight_kg")
    val outputWeightKg: Double,
    @SerializedName("production_date")
    val productionDate: String,
    val operator: String? = null,
    @SerializedName("supplier_source")
    val supplierSource: String? = null,
    @SerializedName("drying_method")
    val dryingMethod: String? = null,
    val notes: String? = null,
)

data class PosCheckoutItemRequest(
    @SerializedName("product_variant_id")
    val productVariantId: Int,
    val quantity: Double,
    @SerializedName("unit_price")
    val unitPrice: Double? = null,
)

data class PosCheckoutRequest(
    val pin: String,
    val items: List<PosCheckoutItemRequest>,
    val notes: String? = null,
    @SerializedName("payment_amount")
    val paymentAmount: Double = 0.0,
    @SerializedName("payment_method")
    val paymentMethod: String = "cash",
    @SerializedName("is_for_delivery")
    val isForDelivery: Boolean = false,
    @SerializedName("delivery_name")
    val deliveryName: String? = null,
    @SerializedName("delivery_address")
    val deliveryAddress: String? = null,
    @SerializedName("delivery_contact")
    val deliveryContact: String? = null,
)

data class StockInItemRequest(
    @SerializedName("product_variant_id")
    val productVariantId: Int,
    val quantity: Int,
    @SerializedName("unit_cost")
    val unitCost: Double,
    @SerializedName("unit_price")
    val unitPrice: Double? = null,
    @SerializedName("price_apply_mode")
    val priceApplyMode: String? = null,
)

data class StockInRequest(
    val items: List<StockInItemRequest>,
    val notes: String? = null,
)

data class ProductUpsertRequest(
    val name: String,
    val description: String? = null,
    @SerializedName("category_id")
    val categoryId: Int,
    @SerializedName("base_unit")
    val baseUnit: String,
    @SerializedName("image_url")
    val imageUrl: String? = null,
    @SerializedName("is_active")
    val isActive: Boolean = true,
    @SerializedName("track_stock")
    val trackStock: Boolean = true,
)

data class InventoryAdjustRequest(
    val quantity: Int,
    val type: String,
    val reason: String,
    val notes: String? = null,
)

data class DashboardKpiValue(
    val count: Int = 0,
    @SerializedName("gross_sales")
    val grossSales: Double = 0.0,
    @SerializedName("total_cost")
    val totalCost: Double = 0.0,
    @SerializedName("gross_profit")
    val grossProfit: Double = 0.0,
    @SerializedName("net_sales")
    val netSales: Double = 0.0,
    @SerializedName("total_refunded")
    val totalRefunded: Double = 0.0,
    @SerializedName("total_payments")
    val totalPayments: Double = 0.0,
    @SerializedName("outstanding_balances")
    val outstandingBalances: Double = 0.0,
    val pending: Int = 0,
    val partial: Int = 0,
    val delivered: Int = 0,
    val canceled: Int = 0,
    @SerializedName("total_amount")
    val totalAmount: Double = 0.0,
    @SerializedName("total_weight_kg")
    val totalWeightKg: Double = 0.0,
    @SerializedName("total_count")
    val totalCount: Double = 0.0,
)

data class DashboardSales(
    val today: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_week")
    val thisWeek: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_month")
    val thisMonth: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("by_status")
    val byStatus: Map<String, DashboardKpiValue> = emptyMap(),
)

data class DashboardPayments(
    val today: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_week")
    val thisWeek: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_month")
    val thisMonth: DashboardKpiValue = DashboardKpiValue(),
)

data class DashboardDeliveries(
    val today: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_week")
    val thisWeek: DashboardKpiValue = DashboardKpiValue(),
    @SerializedName("this_month")
    val thisMonth: DashboardKpiValue = DashboardKpiValue(),
)

data class DashboardInventory(
    @SerializedName("inventory_value")
    val inventoryValue: Double = 0.0,
    @SerializedName("hardware_inventory_value")
    val hardwareInventoryValue: Double = 0.0,
    @SerializedName("agricultural_inventory_value")
    val agriculturalInventoryValue: Double = 0.0,
    @SerializedName("potential_profit")
    val potentialProfit: Double = 0.0,
    @SerializedName("potential_profit_basis")
    val potentialProfitBasis: String? = null,
    @SerializedName("low_stock_items")
    val lowStockItems: List<InventoryDashboardItem> = emptyList(),
    @SerializedName("fast_moving_items")
    val fastMovingItems: List<InventoryDashboardItem> = emptyList(),
)

data class DashboardWeighPeriod(
    @SerializedName("total_amount")
    val totalAmount: Double = 0.0,
    val count: Int = 0,
    @SerializedName("by_type")
    val byType: Map<String, DashboardKpiValue> = emptyMap(),
    @SerializedName("by_status")
    val byStatus: Map<String, DashboardKpiValue> = emptyMap(),
)

data class DashboardWeighIns(
    val today: DashboardWeighPeriod = DashboardWeighPeriod(),
    @SerializedName("this_week")
    val thisWeek: DashboardWeighPeriod = DashboardWeighPeriod(),
    @SerializedName("this_month")
    val thisMonth: DashboardWeighPeriod = DashboardWeighPeriod(),
)

data class DashboardAlert(
    val type: String = "",
    val title: String = "",
    val message: String = "",
    val count: Int = 0,
)

data class DashboardTopProduct(
    val id: Int = 0,
    val name: String = "",
    val description: String? = null,
    @SerializedName("total_quantity")
    val totalQuantity: Double = 0.0,
    @SerializedName("total_revenue")
    val totalRevenue: Double = 0.0,
)

data class DashboardTopProducts(
    @SerializedName("by_quantity")
    val byQuantity: List<DashboardTopProduct> = emptyList(),
    @SerializedName("by_revenue")
    val byRevenue: List<DashboardTopProduct> = emptyList(),
)

data class DashboardData(
    val sales: DashboardSales = DashboardSales(),
    val payments: DashboardPayments = DashboardPayments(),
    val deliveries: DashboardDeliveries = DashboardDeliveries(),
    val inventory: DashboardInventory = DashboardInventory(),
    @SerializedName("weigh_ins")
    val weighIns: DashboardWeighIns = DashboardWeighIns(),
    val alerts: List<DashboardAlert> = emptyList(),
    @SerializedName("top_products")
    val topProducts: DashboardTopProducts = DashboardTopProducts(),
    @SerializedName("last_updated")
    val lastUpdated: String? = null,
)

data class SalesReportSummary(
    val count: Int = 0,
    @SerializedName("gross_sales")
    val grossSales: Double = 0.0,
    @SerializedName("total_cost")
    val totalCost: Double = 0.0,
    @SerializedName("gross_profit")
    val grossProfit: Double = 0.0,
    @SerializedName("total_refunded")
    val totalRefunded: Double = 0.0,
    @SerializedName("net_sales")
    val netSales: Double = 0.0,
    @SerializedName("by_status")
    val byStatus: Map<String, DashboardKpiValue> = emptyMap(),
)

data class SalesReportData(
    val sales: PaginatedData<Sale> = PaginatedData(),
    val summary: SalesReportSummary = SalesReportSummary(),
)

data class PaymentSummary(
    @SerializedName("total_paid")
    val totalPaid: Double = 0.0,
    val balance: Double = 0.0,
    val change: Double = 0.0,
)

data class PosCheckoutData(
    val sale: Sale,
    @SerializedName("payment_summary")
    val paymentSummary: PaymentSummary,
)

data class SaleReceiptData(
    val sale: Sale? = null,
    @SerializedName("payment_summary")
    val paymentSummary: PaymentSummary? = null,
    @SerializedName("receipt_text")
    val receiptText: String? = null,
)

data class DeliveryReceiptData(
    val delivery: Delivery? = null,
    @SerializedName("receipt_text")
    val receiptText: String? = null,
)

data class WeighInReceiptData(
    val transaction: WeighInTransaction? = null,
    @SerializedName("receipt_text")
    val receiptText: String? = null,
)

data class SalePayment(
    val id: Int,
    val amount: Double = 0.0,
    @SerializedName("payment_method")
    val paymentMethod: String? = null,
    @SerializedName("received_at")
    val receivedAt: String? = null,
    val notes: String? = null,
    @SerializedName("received_by")
    val receivedBy: User? = null,
)

data class SaleRefund(
    val id: Int,
    @SerializedName("refund_amount")
    val refundAmount: Double = 0.0,
    val reason: String? = null,
    val type: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("processed_by")
    val processedBy: User? = null,
)

data class AddPaymentRequest(
    val amount: Double,
    @SerializedName("payment_method")
    val paymentMethod: String,
    val notes: String? = null,
)

data class AddPaymentData(
    val payment: SalePayment? = null,
    val sale: Sale? = null,
)

data class VoidSaleRequest(
    val reason: String,
)

data class CancelSaleItemRequest(
    @SerializedName("sale_item_id")
    val saleItemId: Int,
    val reason: String,
    @SerializedName("quantity_to_cancel")
    val quantityToCancel: Double? = null,
)

data class SaleItemQuantityRequest(
    @SerializedName("sale_item_id")
    val saleItemId: Int,
    val quantity: Double,
)

data class AddDeliveryRequest(
    val items: List<SaleItemQuantityRequest>,
    val notes: String? = null,
)

data class DeliverableItem(
    @SerializedName("sale_item")
    val saleItem: SaleItem,
    @SerializedName("delivered_quantity")
    val deliveredQuantity: Double = 0.0,
    @SerializedName("deliverable_quantity")
    val deliverableQuantity: Double = 0.0,
)

data class DeliveryForSaleData(
    val sale: Sale,
    @SerializedName("deliverable_items")
    val deliverableItems: List<DeliverableItem> = emptyList(),
)

data class RefundableItem(
    @SerializedName("sale_item")
    val saleItem: SaleItem,
    @SerializedName("refunded_quantity")
    val refundedQuantity: Double = 0.0,
    @SerializedName("refundable_quantity")
    val refundableQuantity: Double = 0.0,
)

data class RefundForSaleData(
    val sale: Sale,
    @SerializedName("refundable_items")
    val refundableItems: List<RefundableItem> = emptyList(),
)

data class RefundItemRequest(
    @SerializedName("sale_item_id")
    val saleItemId: Int,
    val quantity: Int,
)

data class CreateRefundRequest(
    val items: List<RefundItemRequest>,
    val reason: String,
    @SerializedName("refund_method")
    val refundMethod: String,
)

data class WeighInPrice(
    val id: Int? = null,
    val type: String? = null,
    val price: Double = 0.0,
)

data class WeighPrices(
    @SerializedName("cooked_copra")
    val cookedCopra: WeighInPrice? = null,
    @SerializedName("uncooked_copra")
    val uncookedCopra: WeighInPrice? = null,
    @SerializedName("coconut")
    val coconut: WeighInPrice? = null,
)

data class WeighLandingProduct(
    val id: Int,
    val name: String,
    val sku: String? = null,
    @SerializedName(value = "image", alternate = ["image_url"])
    val image: String? = null,
)

data class WeighLandingData(
    val prices: Map<String, WeighInPrice> = emptyMap(),
    val products: Map<String, WeighLandingProduct?> = emptyMap(),
)

data class WeighBatchItemRequest(
    val type: String,
    @SerializedName("weight_kg")
    val weightKg: Double? = null,
    val count: Int? = null,
    @SerializedName("unit_price")
    val unitPrice: Double? = null,
)

data class WeighBatchStoreRequest(
    val pin: String,
    @SerializedName("weigh_ins")
    val weighIns: List<WeighBatchItemRequest>,
)

data class WeighPriceUpdateRequest(
    val price: Double,
)

data class PinRequest(
    val pin: String,
)

data class WeighInItem(
    val id: Int,
    @SerializedName(value = "ref_num", alternate = ["reference_number"])
    val refNum: String? = null,
    val type: String? = null,
    @SerializedName(value = "weight_kg", alternate = ["weight"])
    val weightKg: Double? = null,
    val count: Double? = null,
    @SerializedName(value = "unit_price", alternate = ["price_per_kg"])
    val unitPrice: Double = 0.0,
    @SerializedName(value = "total_amount", alternate = ["amount"])
    val totalAmount: Double = 0.0,
    val status: String? = null,
)

data class WeighInTransaction(
    val id: Int,
    @SerializedName(value = "ref_num", alternate = ["transaction_number"])
    val refNum: String? = null,
    @SerializedName("supplier_name")
    val supplierName: String? = null,
    @SerializedName("total_weight")
    val totalWeight: Double? = null,
    @SerializedName("total_amount")
    val totalAmount: Double = 0.0,
    @SerializedName(value = "status", alternate = ["payment_status"])
    val status: String? = null,
    @SerializedName("weighed_at")
    val weighedAt: String? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("weighed_by")
    val weighedBy: User? = null,
    @SerializedName("paid_by")
    val paidBy: User? = null,
    @SerializedName("weigh_ins")
    val weighIns: List<WeighInItem> = emptyList(),
)

data class BootstrapResponse(
    @SerializedName("server_time")
    val serverTime: String,
    val user: BootstrapUser,
    val branch: BootstrapBranch,
    val permissions: List<String>,
    val config: BootstrapConfig,
    val lookups: BootstrapLookups,
    @SerializedName("pos_seed")
    val posSeed: List<Product> = emptyList(),
)

data class BootstrapUser(
    val id: Int,
    val name: String,
    val role: String,
    @SerializedName("is_active")
    val isActive: Boolean,
)

data class BootstrapBranch(
    val id: Int,
    val name: String,
    val timezone: String,
    val currency: String,
)

data class BootstrapConfig(
    @SerializedName("tax_mode")
    val taxMode: String,
    @SerializedName("tax_rate")
    val taxRate: Double,
    @SerializedName("price_precision")
    val pricePrecision: Int,
)

data class BootstrapLookups(
    val categories: List<ProductCategory>,
    @SerializedName("payment_methods")
    val paymentMethods: List<BootstrapPaymentMethod>,
    val uom: List<BootstrapUom>,
)

data class BootstrapPaymentMethod(
    val id: String,
    val name: String,
)

data class BootstrapUom(
    val id: Int,
    val code: String,
    val name: String,
)

data class SimplePaginatedData<T>(
    @SerializedName("current_page")
    val currentPage: Int,
    @SerializedName("next_page_url")
    val nextPageUrl: String?,
    @SerializedName("per_page")
    val perPage: Int,
    val data: List<T>,
)

data class CompactProductRow(
    val id: Int,
    val sku: String? = null,
    val description: String? = null,
    @SerializedName("unit_price")
    val unitPrice: Double = 0.0,
    @SerializedName("product_id")
    val productId: Int,
    @SerializedName("product_name")
    val productName: String,
    @SerializedName("category_name")
    val categoryName: String? = null,
    @SerializedName("quantity_on_hand")
    val quantityOnHand: Double? = null,
    @SerializedName("is_active")
    val isActive: Int = 1,
)

data class TransactionRow(
    val id: Int,
    val number: String,
    @SerializedName("customer_name")
    val customerName: String? = null,
    val total: Double,
    val status: String,
    @SerializedName("created_at")
    val createdAt: String,
)

data class OutboxSaleCreateRequest(
    @SerializedName("client_request_id")
    val clientRequestId: String,
    val items: List<OutboxSaleItemRequest>,
    @SerializedName("payment_amount")
    val paymentAmount: Double? = null,
    @SerializedName("payment_method")
    val paymentMethod: String? = null,
    @SerializedName("is_for_delivery")
    val isForDelivery: Boolean = false,
    @SerializedName("delivery_name")
    val deliveryName: String? = null,
    @SerializedName("delivery_address")
    val deliveryAddress: String? = null,
    @SerializedName("delivery_contact")
    val deliveryContact: String? = null,
    val notes: String? = null,
)

data class OutboxSaleItemRequest(
    @SerializedName("product_variant_id")
    val productVariantId: Int,
    val quantity: Double,
    @SerializedName("unit_price")
    val unitPrice: Double? = null,
)

data class OutboxStockMovementCreateRequest(
    @SerializedName("client_request_id")
    val clientRequestId: String,
    @SerializedName("product_variant_id")
    val productVariantId: Int,
    @SerializedName("movement_type")
    val movementType: String,
    val qty: Double,
    val reason: String? = null,
    val notes: String? = null,
    @SerializedName("unit_cost")
    val unitCost: Double? = null,
)

data class OutboxWriteAck(
    val id: Int,
    @SerializedName("client_request_id")
    val clientRequestId: String,
)
