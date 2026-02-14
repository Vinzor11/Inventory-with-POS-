package com.hims.nativeapp.data.repository

import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import androidx.room.withTransaction
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.local.ProductPagedEntity
import com.hims.nativeapp.data.local.ProductRemoteKeyEntity
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.flow.Flow
import java.io.IOException

class ProductsRepository(
    private val api: ApiService,
    private val db: AppDatabase,
) {
    @OptIn(ExperimentalPagingApi::class)
    fun paged(
        search: String,
        categoryId: Int?,
        activeFilter: String,
    ): Flow<PagingData<ProductPagedEntity>> {
        val query = buildQuery(search = search, categoryId = categoryId, activeFilter = activeFilter)

        return Pager(
            config = PagingConfig(
                pageSize = DEFAULT_PAGE_SIZE,
                initialLoadSize = DEFAULT_PAGE_SIZE,
                prefetchDistance = 2,
                enablePlaceholders = false,
            ),
            remoteMediator = ProductsRemoteMediator(
                query = query,
                api = api,
                db = db,
            ),
            pagingSourceFactory = {
                db.productsPagingDao().pagingSource(query.cacheKey)
            },
        ).flow
    }

    private fun normalizeSearch(raw: String): String {
        val value = raw.trim().lowercase()
        return if (value.isBlank()) ALL_SEARCH_KEY else value
    }

    private fun normalizeActiveFilter(raw: String): String {
        return when (raw.trim().lowercase()) {
            "active" -> "active"
            "inactive" -> "inactive"
            else -> "all"
        }
    }

    private fun buildQuery(
        search: String,
        categoryId: Int?,
        activeFilter: String,
    ): ProductQuery {
        val normalizedSearch = normalizeSearch(search)
        val normalizedActive = normalizeActiveFilter(activeFilter)
        val categoryPart = categoryId?.toString() ?: ALL_CATEGORY_KEY
        val cacheKey = "q=$normalizedSearch|cat=$categoryPart|act=$normalizedActive"

        return ProductQuery(
            cacheKey = cacheKey,
            apiSearch = if (normalizedSearch == ALL_SEARCH_KEY) null else normalizedSearch,
            categoryId = categoryId,
            activeFilter = if (normalizedActive == "all") null else normalizedActive,
        )
    }

    companion object {
        private const val ALL_SEARCH_KEY = "__all__"
        private const val ALL_CATEGORY_KEY = "__all__"
        private const val DEFAULT_PAGE_SIZE = 30
        private const val QUERY_TTL_MS = 15L * 60L * 1000L
    }

    private data class ProductQuery(
        val cacheKey: String,
        val apiSearch: String?,
        val categoryId: Int?,
        val activeFilter: String?,
    )

    @OptIn(ExperimentalPagingApi::class)
    private class ProductsRemoteMediator(
        private val query: ProductQuery,
        private val api: ApiService,
        private val db: AppDatabase,
    ) : RemoteMediator<Int, ProductPagedEntity>() {
        override suspend fun initialize(): RemoteMediator.InitializeAction {
            val key = db.productRemoteKeyDao().get(query.cacheKey)
            val stale = key == null || (System.currentTimeMillis() - key.syncedAtEpochMs) > QUERY_TTL_MS
            return if (stale) {
                RemoteMediator.InitializeAction.LAUNCH_INITIAL_REFRESH
            } else {
                RemoteMediator.InitializeAction.SKIP_INITIAL_REFRESH
            }
        }

        override suspend fun load(
            loadType: LoadType,
            state: PagingState<Int, ProductPagedEntity>,
        ): RemoteMediator.MediatorResult {
            val page = when (loadType) {
                LoadType.REFRESH -> 1
                LoadType.PREPEND -> return RemoteMediator.MediatorResult.Success(endOfPaginationReached = true)
                LoadType.APPEND -> {
                    val key = db.productRemoteKeyDao().get(query.cacheKey)
                    key?.nextPage
                        ?: return RemoteMediator.MediatorResult.Success(endOfPaginationReached = true)
                }
            }

            return try {
                val response = api.getProductsPaged(
                    perPage = state.config.pageSize,
                    search = query.apiSearch,
                    categoryId = query.categoryId,
                    activeFilter = query.activeFilter,
                    page = page,
                    compact = true,
                    activeOnly = query.activeFilter == "active",
                )

                if (!response.isSuccessful || response.body() == null) {
                    val code = response.code()
                    if (code == 429 || code in 500..599) {
                        return RemoteMediator.MediatorResult.Error(IOException("Retryable HTTP $code"))
                    }
                    return RemoteMediator.MediatorResult.Error(IllegalStateException("HTTP $code"))
                }

                val pageData = response.body()!!.data
                val now = System.currentTimeMillis()

                val mappedRows = pageData.data.map {
                    ProductPagedEntity(
                        searchKey = query.cacheKey,
                        variantId = it.id,
                        productId = it.productId,
                        name = it.productName,
                        description = it.description.orEmpty(),
                        sku = it.sku,
                        categoryName = it.categoryName,
                        unitPrice = it.unitPrice,
                        availableQuantity = it.quantityOnHand ?: 0.0,
                        isActive = it.isActive,
                    )
                }

                val endReached = pageData.nextPageUrl == null || mappedRows.isEmpty()

                db.withTransaction {
                    if (loadType == LoadType.REFRESH) {
                        db.productsPagingDao().clearBySearchKey(query.cacheKey)
                        db.productRemoteKeyDao().delete(query.cacheKey)
                    }

                    db.productsPagingDao().upsertAll(mappedRows)
                    db.productRemoteKeyDao().upsert(
                        ProductRemoteKeyEntity(
                            searchKey = query.cacheKey,
                            nextPage = if (endReached) null else pageData.currentPage + 1,
                            syncedAtEpochMs = now,
                        ),
                    )
                }

                RemoteMediator.MediatorResult.Success(endOfPaginationReached = endReached)
            } catch (io: IOException) {
                RemoteMediator.MediatorResult.Error(io)
            }
        }
    }
}
