package com.hims.nativeapp.data.repository

import com.google.gson.Gson
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.local.OutboxEventEntity
import com.hims.nativeapp.data.model.OutboxSaleCreateRequest
import com.hims.nativeapp.data.model.OutboxStockMovementCreateRequest
import com.hims.nativeapp.data.network.ApiService
import com.hims.nativeapp.domain.DomainAction
import com.hims.nativeapp.domain.EmitImpact
import java.io.IOException
import java.util.UUID

object OutboxEventTypes {
    const val SALE_CREATE = "sale_create"
    const val STOCK_MOVEMENT_CREATE = "stock_movement_create"
}

object OutboxStatuses {
    const val PENDING = "PENDING"
    const val RETRY = "RETRY"
    const val PROCESSING = "PROCESSING"
    const val SENT = "SENT"
    const val FAILED_PERMANENT = "FAILED_PERMANENT"
}

sealed interface OutboxFlushResult {
    data class Success(val actions: Set<DomainAction>) : OutboxFlushResult
    data object RetryLater : OutboxFlushResult
    data object NeedsLogin : OutboxFlushResult
}

class OutboxRepository(
    private val api: ApiService,
    private val db: AppDatabase,
    private val gson: Gson = Gson(),
) {
    suspend fun enqueueEvent(type: String, payloadJson: String): String {
        val id = UUID.randomUUID().toString()
        db.outboxEventDao().insert(
            OutboxEventEntity(
                id = id,
                type = type,
                payloadJson = payloadJson,
                status = OutboxStatuses.PENDING,
                retries = 0,
                createdAtEpochMs = System.currentTimeMillis(),
            ),
        )
        actionForOutbox(type, payloadJson)?.let { action ->
            EmitImpact.emit(action = action, reason = "queued")
        }
        return id
    }

    suspend fun flushPending(limit: Int = 30): OutboxFlushResult {
        val rows = db.outboxEventDao().getPending(limit)
        if (rows.isEmpty()) return OutboxFlushResult.Success(emptySet())
        val syncedActions = linkedSetOf<DomainAction>()

        for (row in rows) {
            db.outboxEventDao().updateStatus(row.id, OutboxStatuses.PROCESSING, row.retries)

            val outcome = runCatching { execute(row) }.getOrElse {
                if (it is IOException) HttpOutcome.RETRYABLE else HttpOutcome.PERMANENT
            }

            when (outcome) {
                HttpOutcome.SUCCESS -> {
                    db.outboxEventDao().updateStatus(row.id, OutboxStatuses.SENT, row.retries)
                    actionFor(row)?.let { syncedActions.add(it) }
                }

                HttpOutcome.NEEDS_LOGIN -> {
                    db.outboxEventDao().updateStatus(row.id, OutboxStatuses.RETRY, row.retries + 1)
                    return OutboxFlushResult.NeedsLogin
                }

                HttpOutcome.RETRYABLE -> {
                    db.outboxEventDao().updateStatus(row.id, OutboxStatuses.RETRY, row.retries + 1)
                    return OutboxFlushResult.RetryLater
                }

                HttpOutcome.PERMANENT -> {
                    db.outboxEventDao().updateStatus(row.id, OutboxStatuses.FAILED_PERMANENT, row.retries + 1)
                }
            }
        }

        val sevenDaysAgo = System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L
        db.outboxEventDao().deleteOldSent(sevenDaysAgo)

        return OutboxFlushResult.Success(syncedActions)
    }

    private suspend fun execute(row: OutboxEventEntity): HttpOutcome {
        val responseCode = when (row.type) {
            OutboxEventTypes.SALE_CREATE -> {
                val payload = gson.fromJson(row.payloadJson, OutboxSaleCreateRequest::class.java)
                api.createSaleFromOutbox(payload).code()
            }

            OutboxEventTypes.STOCK_MOVEMENT_CREATE -> {
                val payload = gson.fromJson(row.payloadJson, OutboxStockMovementCreateRequest::class.java)
                api.createStockMovementFromOutbox(payload).code()
            }

            else -> return HttpOutcome.PERMANENT
        }

        return when {
            responseCode in 200..299 -> HttpOutcome.SUCCESS
            responseCode == 401 || responseCode == 403 -> HttpOutcome.NEEDS_LOGIN
            responseCode == 429 || responseCode in 500..599 -> HttpOutcome.RETRYABLE
            else -> HttpOutcome.PERMANENT
        }
    }

    private enum class HttpOutcome {
        SUCCESS,
        NEEDS_LOGIN,
        RETRYABLE,
        PERMANENT,
    }

    fun actionForOutbox(type: String, payloadJson: String): DomainAction? {
        return actionFor(
            OutboxEventEntity(
                id = "",
                type = type,
                payloadJson = payloadJson,
                status = "",
                retries = 0,
                createdAtEpochMs = 0L,
            ),
        )
    }

    private fun actionFor(row: OutboxEventEntity): DomainAction? {
        return when (row.type) {
            OutboxEventTypes.SALE_CREATE -> {
                val payload = runCatching { gson.fromJson(row.payloadJson, OutboxSaleCreateRequest::class.java) }.getOrNull()
                if (payload?.isForDelivery == true) {
                    DomainAction.SALE_CREATED_DELIVERY
                } else {
                    DomainAction.SALE_COMPLETED_WALK_IN
                }
            }

            OutboxEventTypes.STOCK_MOVEMENT_CREATE -> DomainAction.STOCK_ADJUSTMENT
            else -> null
        }
    }
}
