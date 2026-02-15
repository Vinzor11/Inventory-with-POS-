package com.hims.nativeapp.data.repository

import com.hims.nativeapp.core.DataInvalidationManager
import com.hims.nativeapp.core.RefreshKeys
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class PosRepository(
    private val api: ApiService,
    private val bootstrapRepository: BootstrapRepository,
    private val invalidationManager: DataInvalidationManager = DataInvalidationManager,
) {
    private val mutex = Mutex()
    private var cachedProducts: List<Product>? = null

    suspend fun getPosSummary(forceRefresh: Boolean = false): List<Product> =
        mutex.withLock {
            val cached = cachedProducts
            val isStale = invalidationManager.isInvalid(RefreshKeys.POS_SUMMARY)
            if (!forceRefresh && cached != null && !isStale) {
                return cached
            }

            val products = api.getPosProducts().data
            bootstrapRepository.updatePosSeed(products)
            cachedProducts = products
            invalidationManager.clearInvalid(RefreshKeys.POS_SUMMARY)
            products
        }

    fun primeCache(products: List<Product>) {
        cachedProducts = products
    }
}
