package com.hims.nativeapp.data.repository

import com.hims.nativeapp.core.DataInvalidationManager
import com.hims.nativeapp.core.RefreshKeys
import com.hims.nativeapp.data.model.CookedCopraStockSummary
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.data.model.InventoryMovement
import com.hims.nativeapp.data.model.InventoryVariant
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException

data class InventorySummaryQuery(
    val categoryId: Int? = null,
    val lowStockOnly: Boolean? = null,
    val perPage: Int = 200,
)

data class InventorySummaryResult(
    val categories: List<ProductCategory>,
    val variants: List<InventoryVariant>,
    val dashboard: InventoryDashboardData?,
    val movements: List<InventoryMovement>,
    val cookedCopraStockSummary: CookedCopraStockSummary?,
    val warningMessage: String? = null,
)

class InventoryRepository(
    private val api: ApiService,
    private val invalidationManager: DataInvalidationManager = DataInvalidationManager,
) {
    private val mutex = Mutex()

    private val variantsCache = mutableMapOf<InventorySummaryQuery, List<InventoryVariant>>()
    private var categoriesCache: List<ProductCategory>? = null
    private var dashboardCache: InventoryDashboardData? = null
    private var movementsCache: List<InventoryMovement>? = null
    private var cookedSummaryCache: CookedCopraStockSummary? = null

    suspend fun getSummary(
        query: InventorySummaryQuery,
        forceRefresh: Boolean = false,
    ): InventorySummaryResult =
        mutex.withLock {
            val summaryStale = invalidationManager.isInvalid(RefreshKeys.INVENTORY_SUMMARY)
            val productStale =
                invalidationManager.hasInvalidWithPrefix(RefreshKeys.INVENTORY_PRODUCT_PREFIX)

            val cachedCategories = categoriesCache
            val cachedVariants = variantsCache[query]
            val shouldFetch =
                forceRefresh ||
                    cachedCategories == null ||
                    cachedVariants == null ||
                    summaryStale ||
                    productStale

            if (!shouldFetch) {
                return InventorySummaryResult(
                    categories = requireNotNull(cachedCategories),
                    variants = requireNotNull(cachedVariants),
                    dashboard = dashboardCache,
                    movements = movementsCache.orEmpty(),
                    cookedCopraStockSummary = cookedSummaryCache,
                )
            }

            if (summaryStale || productStale) {
                variantsCache.clear()
            }

            val categories = api.getPosCategories().data
            val variants =
                api.getInventory(
                    perPage = query.perPage,
                    categoryId = query.categoryId,
                    lowStockOnly = query.lowStockOnly,
                ).data.data

            val warningMessages = mutableListOf<String>()

            val dashboard =
                runCatching { api.getInventoryDashboard().data }
                    .getOrElse { error ->
                        if (isForbidden(error)) {
                            null
                        } else {
                            warningMessages += "Inventory dashboard failed to load."
                            dashboardCache
                        }
                    }

            val movements =
                runCatching { api.getInventoryMovements(perPage = query.perPage).data.data }
                    .getOrElse { error ->
                        if (!isForbidden(error)) {
                            warningMessages += "Inventory history failed to load."
                        }
                        movementsCache.orEmpty()
                    }

            val cookedSummary =
                runCatching { api.getCookedCopraStockSummary().data }
                    .getOrElse { error ->
                        if (isForbidden(error)) {
                            null
                        } else {
                            warningMessages += "Cooked copra stock summary failed to load."
                            cookedSummaryCache
                        }
                    }

            categoriesCache = categories
            variantsCache[query] = variants
            dashboardCache = dashboard
            movementsCache = movements
            cookedSummaryCache = cookedSummary

            invalidationManager.clearInvalid(RefreshKeys.INVENTORY_SUMMARY)
            invalidationManager.clearInvalidByPrefix(RefreshKeys.INVENTORY_PRODUCT_PREFIX)

            InventorySummaryResult(
                categories = categories,
                variants = variants,
                dashboard = dashboard,
                movements = movements,
                cookedCopraStockSummary = cookedSummary,
                warningMessage = warningMessages.firstOrNull(),
            )
        }

    private fun isForbidden(error: Throwable): Boolean =
        (error as? HttpException)?.code() == 403
}
