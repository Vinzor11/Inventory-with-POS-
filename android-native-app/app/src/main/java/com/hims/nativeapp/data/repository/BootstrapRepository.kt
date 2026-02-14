package com.hims.nativeapp.data.repository

import androidx.room.withTransaction
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.local.BootstrapStateEntity
import com.hims.nativeapp.data.local.CacheMetaEntity
import com.hims.nativeapp.data.local.CategoryEntity
import com.hims.nativeapp.data.local.PaymentMethodEntity
import com.hims.nativeapp.data.model.BootstrapResponse
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException

sealed interface BootstrapRefreshResult {
    data class Updated(val snapshot: BootstrapSnapshot) : BootstrapRefreshResult
    data object NotModified : BootstrapRefreshResult
    data object Unauthorized : BootstrapRefreshResult
    data class NetworkError(val retryable: Boolean) : BootstrapRefreshResult
}

data class BootstrapSnapshot(
    val state: BootstrapStateEntity,
    val categories: List<CategoryEntity>,
    val paymentMethods: List<PaymentMethodEntity>,
    val posSeed: List<Product>,
)

class BootstrapRepository(
    private val api: ApiService,
    private val db: AppDatabase,
    private val gson: Gson = Gson(),
) {
    private val refreshMutex = Mutex()

    suspend fun currentSnapshot(): BootstrapSnapshot? {
        val state = db.bootstrapStateDao().get() ?: return null
        val categories = db.categoryDao().getAll()
        val paymentMethods = db.paymentMethodDao().getAll()
        val posSeed = decodePosSeed(state.posSeedJson)

        return BootstrapSnapshot(
            state = state,
            categories = categories,
            paymentMethods = paymentMethods,
            posSeed = posSeed,
        )
    }

    suspend fun refreshSWR(force: Boolean): BootstrapRefreshResult = refreshMutex.withLock {
        val now = System.currentTimeMillis()
        val meta = db.cacheMetaDao().get(CACHE_KEY)
        val cached = db.bootstrapStateDao().get()

        if (!force && cached != null && meta != null && !meta.isStale(now)) {
            return BootstrapRefreshResult.NotModified
        }

        return try {
            val response = api.getBootstrap(
                ifNoneMatch = meta?.etag,
            )

            when (response.code()) {
                304 -> {
                    val existingMeta = meta ?: CacheMetaEntity(
                        key = CACHE_KEY,
                        etag = response.headers()[HEADER_ETAG],
                        fetchedAtEpochMs = now,
                        ttlSeconds = BOOTSTRAP_TTL_SECONDS,
                        lastModified = response.headers()[HEADER_LAST_MODIFIED],
                    )
                    db.cacheMetaDao().upsert(
                        existingMeta.copy(
                            etag = response.headers()[HEADER_ETAG] ?: existingMeta.etag,
                            lastModified = response.headers()[HEADER_LAST_MODIFIED] ?: existingMeta.lastModified,
                            fetchedAtEpochMs = now,
                        ),
                    )
                    BootstrapRefreshResult.NotModified
                }

                200 -> {
                    val body = response.body() ?: return BootstrapRefreshResult.NetworkError(retryable = false)

                    db.withTransaction {
                        db.bootstrapStateDao().upsert(body.toEntity(now, gson))

                        db.categoryDao().clear()
                        db.categoryDao().upsertAll(
                            body.lookups.categories.map {
                                CategoryEntity(
                                    id = it.id,
                                    name = it.name,
                                )
                            },
                        )

                        db.paymentMethodDao().clear()
                        db.paymentMethodDao().upsertAll(
                            body.lookups.paymentMethods.map {
                                PaymentMethodEntity(
                                    id = it.id,
                                    name = it.name,
                                )
                            },
                        )

                        db.cacheMetaDao().upsert(
                            CacheMetaEntity(
                                key = CACHE_KEY,
                                etag = response.headers()[HEADER_ETAG],
                                fetchedAtEpochMs = now,
                                ttlSeconds = BOOTSTRAP_TTL_SECONDS,
                                lastModified = response.headers()[HEADER_LAST_MODIFIED],
                            ),
                        )
                    }

                    val snapshot = currentSnapshot()
                    if (snapshot == null) {
                        BootstrapRefreshResult.NetworkError(retryable = false)
                    } else {
                        BootstrapRefreshResult.Updated(snapshot)
                    }
                }

                401, 403 -> BootstrapRefreshResult.Unauthorized
                429 -> BootstrapRefreshResult.NetworkError(retryable = true)
                in 500..599 -> BootstrapRefreshResult.NetworkError(retryable = true)
                else -> BootstrapRefreshResult.NetworkError(retryable = false)
            }
        } catch (_: IOException) {
            BootstrapRefreshResult.NetworkError(retryable = true)
        }
    }

    private fun BootstrapResponse.toEntity(nowEpochMs: Long, gson: Gson): BootstrapStateEntity {
        return BootstrapStateEntity(
            id = 1,
            userId = user.id,
            userName = user.name,
            userRole = user.role,
            branchId = branch.id,
            branchName = branch.name,
            currency = branch.currency,
            timezone = branch.timezone,
            permissionsJson = gson.toJson(permissions),
            configJson = gson.toJson(config),
            posSeedJson = gson.toJson(posSeed),
            updatedAtEpochMs = nowEpochMs,
        )
    }

    private fun decodePosSeed(raw: String): List<Product> {
        if (raw.isBlank()) return emptyList()
        val type = object : TypeToken<List<Product>>() {}.type
        return runCatching { gson.fromJson<List<Product>>(raw, type) }.getOrDefault(emptyList())
    }

    companion object {
        const val BOOTSTRAP_TTL_SECONDS: Long = 24L * 60L * 60L
        private const val CACHE_KEY = "bootstrap"
        private const val HEADER_ETAG = "ETag"
        private const val HEADER_LAST_MODIFIED = "Last-Modified"
    }
}
