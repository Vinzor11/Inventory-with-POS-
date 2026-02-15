package com.hims.nativeapp.data.repository

import com.hims.nativeapp.core.DataInvalidationManager
import com.hims.nativeapp.core.GlobalEvent
import com.hims.nativeapp.core.GlobalEventBus
import com.hims.nativeapp.core.RefreshKeys
import com.hims.nativeapp.data.model.CreateRefundRequest
import com.hims.nativeapp.data.model.RefundForSaleData
import com.hims.nativeapp.data.model.RefundItemRequest
import com.hims.nativeapp.data.model.Sale
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class SalesListQuery(
    val perPage: Int = 30,
    val status: String? = null,
    val paymentStatus: String? = null,
    val deliveryStatus: String? = null,
    val dateFrom: String? = null,
    val dateTo: String? = null,
)

class SalesRepository(
    private val api: ApiService,
    private val invalidationManager: DataInvalidationManager = DataInvalidationManager,
    private val globalEventBus: GlobalEventBus = GlobalEventBus,
) {
    private val listMutex = Mutex()
    private val detailMutex = Mutex()
    private val refundMutex = Mutex()

    private val listCache = mutableMapOf<SalesListQuery, List<Sale>>()
    private val detailCache = mutableMapOf<Int, Sale>()

    suspend fun getSales(
        query: SalesListQuery,
        forceRefresh: Boolean = false,
    ): List<Sale> =
        listMutex.withLock {
            val cached = listCache[query]
            val listStale = invalidationManager.isInvalid(RefreshKeys.SALES_LIST)
            if (!forceRefresh && cached != null && !listStale) {
                return cached
            }

            val sales =
                api.getSales(
                    perPage = query.perPage,
                    status = query.status,
                    paymentStatus = query.paymentStatus,
                    deliveryStatus = query.deliveryStatus,
                    dateFrom = query.dateFrom,
                    dateTo = query.dateTo,
                ).data.data

            listCache[query] = sales

            invalidationManager.clearInvalid(RefreshKeys.SALES_LIST)
            sales
        }

    suspend fun getSale(
        saleId: Int,
        forceRefresh: Boolean = false,
    ): Sale =
        detailMutex.withLock {
            val detailKey = RefreshKeys.saleDetail(saleId)
            val stale =
                invalidationManager.isInvalid(detailKey) ||
                    invalidationManager.isInvalid(RefreshKeys.SALES_LIST)

            val cached = detailCache[saleId]
            if (!forceRefresh && cached != null && !stale) {
                return cached
            }

            val sale = api.getSale(saleId).data
            detailCache[saleId] = sale
            invalidationManager.clearInvalid(detailKey)
            sale
        }

    suspend fun getRefundForSale(saleId: Int): RefundForSaleData = api.getRefundForSale(saleId).data

    suspend fun refundSale(
        saleId: Int,
        items: List<RefundItemRequest>,
        reason: String,
        refundMethod: String,
        affectedInventoryVariantIds: Set<Int> = emptySet(),
    ): String? =
        refundMutex.withLock {
            val response =
                api.createRefund(
                    saleId = saleId,
                    request =
                        CreateRefundRequest(
                            items = items,
                            reason = reason,
                            refundMethod = refundMethod,
                        ),
                )

            val keysToInvalidate = mutableSetOf(
                RefreshKeys.SALES_LIST,
                RefreshKeys.saleDetail(saleId),
                RefreshKeys.DASHBOARD_METRICS,
                RefreshKeys.POS_SUMMARY,
                RefreshKeys.INVENTORY_SUMMARY,
            )
            keysToInvalidate +=
                affectedInventoryVariantIds
                    .filter { id -> id > 0 }
                    .map { id -> RefreshKeys.inventoryProduct(id) }

            listCache.clear()
            detailCache.remove(saleId)

            invalidationManager.invalidate(*keysToInvalidate.toTypedArray())
            globalEventBus.emit(
                GlobalEvent.RefundCompleted(
                    saleId = saleId,
                    affectedKeys = keysToInvalidate,
                ),
            )

            response.message
        }
}
