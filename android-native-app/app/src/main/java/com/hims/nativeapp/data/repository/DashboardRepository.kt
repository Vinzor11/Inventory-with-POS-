package com.hims.nativeapp.data.repository

import com.hims.nativeapp.core.DataInvalidationManager
import com.hims.nativeapp.core.RefreshKeys
import com.hims.nativeapp.data.model.DashboardData
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException

data class DashboardMetricsResult(
    val dashboard: DashboardData,
    val inventoryDashboard: InventoryDashboardData?,
)

class DashboardRepository(
    private val api: ApiService,
    private val invalidationManager: DataInvalidationManager = DataInvalidationManager,
) {
    private val mutex = Mutex()
    private var cached: DashboardMetricsResult? = null

    suspend fun getMetrics(forceRefresh: Boolean = false): DashboardMetricsResult =
        mutex.withLock {
            val stale = invalidationManager.isInvalid(RefreshKeys.DASHBOARD_METRICS)
            val cachedPayload = cached
            if (!forceRefresh && cachedPayload != null && !stale) {
                return cachedPayload
            }

            val dashboard = api.getDashboard().data
            val inventoryDashboard =
                runCatching { api.getInventoryDashboard().data }
                    .getOrElse { error ->
                        if (isUnauthorized(error)) {
                            throw error
                        }
                        if (isForbidden(error)) {
                            null
                        } else {
                            cachedPayload?.inventoryDashboard
                        }
                    }

            val payload =
                DashboardMetricsResult(
                    dashboard = dashboard,
                    inventoryDashboard = inventoryDashboard,
                )
            cached = payload
            invalidationManager.clearInvalid(RefreshKeys.DASHBOARD_METRICS)
            payload
        }

    private fun isForbidden(error: Throwable): Boolean = (error as? HttpException)?.code() == 403

    private fun isUnauthorized(error: Throwable): Boolean =
        (error as? HttpException)?.code() == 401
}
