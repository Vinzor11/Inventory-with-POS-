package com.hims.nativeapp.core

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

enum class DataTopic {
    STOCK,
    INVENTORY,
    PRODUCTS,
    TRANSACTIONS,
    DELIVERIES,
}

data class DataChangedEvent(
    val topic: DataTopic,
    val reason: String,
    val entityId: Int? = null,
    val relatedIds: Map<String, String> = emptyMap(),
    val occurredAtEpochMs: Long = System.currentTimeMillis(),
)

object DataChangeBus {
    private val _events = MutableSharedFlow<DataChangedEvent>(
        replay = 0,
        extraBufferCapacity = 256,
    )
    val events: SharedFlow<DataChangedEvent> = _events.asSharedFlow()

    suspend fun emit(event: DataChangedEvent) {
        _events.emit(event)
    }

    suspend fun emitStockChanged(reason: String, variantId: Int? = null) {
        emit(DataChangedEvent(topic = DataTopic.STOCK, reason = reason, entityId = variantId))
    }

    suspend fun emitInventoryChanged(reason: String) {
        emit(DataChangedEvent(topic = DataTopic.INVENTORY, reason = reason))
    }

    suspend fun emitProductsChanged(reason: String, productId: Int? = null) {
        emit(DataChangedEvent(topic = DataTopic.PRODUCTS, reason = reason, entityId = productId))
    }

    suspend fun emitTransactionsChanged(reason: String, saleId: Int? = null) {
        emit(DataChangedEvent(topic = DataTopic.TRANSACTIONS, reason = reason, entityId = saleId))
    }

    suspend fun emitDeliveriesChanged(reason: String, deliveryId: Int? = null) {
        emit(DataChangedEvent(topic = DataTopic.DELIVERIES, reason = reason, entityId = deliveryId))
    }
}
