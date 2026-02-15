package com.hims.nativeapp.core

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed interface GlobalEvent {
    val affectedKeys: Set<String>
    val occurredAtEpochMs: Long

    data class DataInvalidated(
        override val affectedKeys: Set<String>,
        val reason: String,
        val entityId: Int? = null,
        override val occurredAtEpochMs: Long = System.currentTimeMillis(),
    ) : GlobalEvent

    data class RefundCompleted(
        val saleId: Int,
        override val affectedKeys: Set<String>,
        override val occurredAtEpochMs: Long = System.currentTimeMillis(),
    ) : GlobalEvent
}

object GlobalEventBus {
    private val _events = MutableSharedFlow<GlobalEvent>(extraBufferCapacity = 128)
    val events: SharedFlow<GlobalEvent> = _events.asSharedFlow()

    suspend fun emit(event: GlobalEvent) {
        _events.emit(event)
    }

    fun tryEmit(event: GlobalEvent) {
        _events.tryEmit(event)
    }
}
