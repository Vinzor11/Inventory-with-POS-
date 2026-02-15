package com.hims.nativeapp.ui

import com.hims.nativeapp.data.model.Delivery
import com.hims.nativeapp.data.model.DashboardData
import com.hims.nativeapp.data.model.CookedCopraStockSummary
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.data.model.InventoryMovement
import com.hims.nativeapp.data.model.InventoryVariant
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.data.model.ProductionRun
import com.hims.nativeapp.data.model.Sale
import com.hims.nativeapp.data.model.SalesReportData
import com.hims.nativeapp.data.model.WeighLandingProduct
import com.hims.nativeapp.data.model.WeighInTransaction

data class PosCartItem(
    val productId: Int,
    val variantId: Int,
    val productName: String,
    val variantName: String,
    val image: String? = null,
    val unitPrice: Double = 0.0,
    val customUnitPrice: Double? = null,
    val quantity: Double = 1.0,
)

data class DeliveryCartItem(
    val cartKey: String,
    val deliveryId: Int,
    val saleId: Int,
    val saleNumber: String,
    val saleItemId: Int,
    val productVariantId: Int,
    val productName: String,
    val description: String,
    val image: String? = null,
    val quantity: Double = 1.0,
    val remainingQuantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val createdAt: String,
)

data class WeighCartItem(
    val transactionId: Int,
    val refNumber: String,
    val title: String,
    val amount: Double = 0.0,
    val weighedAt: String,
)

data class WeighDraftItem(
    val localId: String,
    val type: String,
    val weightKg: Double? = null,
    val count: Int? = null,
    val unitPrice: Double = 0.0,
    val customUnitPrice: Double? = null,
    val totalAmount: Double = 0.0,
)

data class AppUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isOfflineMode: Boolean = false,
    val errorMessage: String? = null,
    val deactivationMessage: String? = null,
    val successMessage: String? = null,
    val userName: String? = null,
    val userRole: String? = null,
    val selectedTab: AppTab = AppTab.POS,
    val searchQuery: String = "",
    val posCategoryFilter: Int? = null,
    val products: List<Product> = emptyList(),
    val productMenuItems: List<Product> = emptyList(),
    val sales: List<Sale> = emptyList(),
    val deliveryQueue: List<Delivery> = emptyList(),
    val deliveries: List<Delivery> = emptyList(),
    val inventoryVariants: List<InventoryVariant> = emptyList(),
    val inventoryDashboard: InventoryDashboardData? = null,
    val cookedCopraStockSummary: CookedCopraStockSummary? = null,
    val inventoryMovements: List<InventoryMovement> = emptyList(),
    val dashboardData: DashboardData? = null,
    val dashboardAccessDenied: Boolean = false,
    val dashboardStatusMessage: String? = null,
    val salesReportData: SalesReportData? = null,
    val weighReportTransactions: List<WeighInTransaction> = emptyList(),
    val productionRuns: List<ProductionRun> = emptyList(),
    val inventoryCategories: List<ProductCategory> = emptyList(),
    val weighIns: List<WeighInTransaction> = emptyList(),
    val expandedSaleIds: Set<Int> = emptySet(),
    val expandedDeliveryIds: Set<Int> = emptySet(),
    val salesStatusFilter: String = "all",
    val salesPaymentStatusFilter: String = "all",
    val salesDeliveryStatusFilter: String = "all",
    val salesDateFrom: String = "",
    val salesDateTo: String = "",
    val salesReportStatusFilter: String = "all",
    val salesReportDateFrom: String = "",
    val salesReportDateTo: String = "",
    val weighReportTypeFilter: String = "all",
    val weighReportStatusFilter: String = "all",
    val weighReportDateFrom: String = "",
    val weighReportDateTo: String = "",
    val deliveryStatusFilter: String = "all",
    val deliveryDateFrom: String = "",
    val deliveryDateTo: String = "",
    val inventoryCategoryFilter: Int? = null,
    val inventoryLowStockOnly: Boolean = false,
    val productCategoryFilter: Int? = null,
    val productActiveFilter: String = "all",
    val weighTypeFilter: String = "all",
    val weighStatusFilter: String = "all",
    val weighDateFrom: String = "",
    val weighDateTo: String = "",
    val weighPrices: Map<String, Double> = emptyMap(),
    val weighProducts: Map<String, WeighLandingProduct?> = emptyMap(),
    val unpaidWeighTransactions: List<WeighInTransaction> = emptyList(),
    val isActionLoading: Boolean = false,
    val posCartItems: List<PosCartItem> = emptyList(),
    val deliveryCartItems: List<DeliveryCartItem> = emptyList(),
    val deliveryCartOpenSignal: Int = 0,
    val weighCartItems: List<WeighCartItem> = emptyList(),
    val weighDraftItems: List<WeighDraftItem> = emptyList(),
)
