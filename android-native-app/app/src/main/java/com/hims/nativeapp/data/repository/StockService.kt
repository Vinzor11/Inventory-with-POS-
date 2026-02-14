package com.hims.nativeapp.data.repository

import androidx.room.withTransaction
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.local.LocalStockMovementEntity
import com.hims.nativeapp.data.local.StockOnHandEntity
import com.hims.nativeapp.domain.DomainAction
import com.hims.nativeapp.domain.EmitImpact
import kotlinx.coroutines.flow.Flow

data class StockDeltaRequest(
    val movementKey: String,
    val productVariantId: Int,
    val deltaQty: Double,
    val source: String,
    val action: DomainAction,
    val reason: String,
)

class StockService(
    private val db: AppDatabase,
) {
    fun observeOnHand(variantId: Int): Flow<Double?> = db.stockOnHandDao().observeQuantity(variantId)

    suspend fun applyLocalMovement(request: StockDeltaRequest): Boolean {
        val now = System.currentTimeMillis()
        var applied = false

        db.withTransaction {
            val exists = db.localStockMovementDao().exists(request.movementKey)
            if (exists) {
                return@withTransaction
            }

            val current = db.stockOnHandDao().get(request.productVariantId)
            val currentQty = current?.quantityOnHand ?: 0.0
            val nextQty = (currentQty + request.deltaQty).coerceAtLeast(0.0)

            db.localStockMovementDao().insert(
                LocalStockMovementEntity(
                    movementKey = request.movementKey,
                    productVariantId = request.productVariantId,
                    deltaQty = request.deltaQty,
                    source = request.source,
                    createdAtEpochMs = now,
                ),
            )
            db.stockOnHandDao().upsert(
                StockOnHandEntity(
                    productVariantId = request.productVariantId,
                    quantityOnHand = nextQty,
                    updatedAtEpochMs = now,
                ),
            )
            applied = true
        }

        if (applied) {
            EmitImpact.emit(
                action = request.action,
                reason = request.reason,
                entityId = request.productVariantId,
            )
        }
        return applied
    }
}
