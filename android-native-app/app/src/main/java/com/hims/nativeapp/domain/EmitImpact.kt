package com.hims.nativeapp.domain

import com.hims.nativeapp.core.DataChangeBus
import com.hims.nativeapp.core.DataChangedEvent

object EmitImpact {
    suspend fun emit(
        action: DomainAction,
        reason: String,
        entityId: Int? = null,
        relatedIds: Map<String, String> = emptyMap(),
    ) {
        ActionImpactRegistry.topicsFor(action).forEach { topic ->
            DataChangeBus.emit(
                DataChangedEvent(
                    topic = topic,
                    reason = reason,
                    entityId = entityId,
                    relatedIds = relatedIds,
                ),
            )
        }
    }
}
