package com.hims.nativeapp.domain

import com.hims.nativeapp.core.DataTopic

enum class DomainAction {
    SALE_COMPLETED_WALK_IN,
    SALE_CREATED_DELIVERY,
    DELIVERY_MARKED_DELIVERED,
    STOCK_ADJUSTMENT,
    PRODUCT_UPDATED,
    CUSTOMER_CREATED,
}

object ActionImpactRegistry {
    private val map: Map<DomainAction, Set<DataTopic>> = mapOf(
        DomainAction.SALE_COMPLETED_WALK_IN to setOf(
            DataTopic.STOCK,
            DataTopic.INVENTORY,
            DataTopic.TRANSACTIONS,
        ),
        DomainAction.SALE_CREATED_DELIVERY to setOf(
            DataTopic.TRANSACTIONS,
            DataTopic.DELIVERIES,
        ),
        DomainAction.DELIVERY_MARKED_DELIVERED to setOf(
            DataTopic.STOCK,
            DataTopic.INVENTORY,
            DataTopic.TRANSACTIONS,
            DataTopic.DELIVERIES,
        ),
        DomainAction.STOCK_ADJUSTMENT to setOf(
            DataTopic.STOCK,
            DataTopic.INVENTORY,
            DataTopic.PRODUCTS,
        ),
        DomainAction.PRODUCT_UPDATED to setOf(DataTopic.PRODUCTS),
        DomainAction.CUSTOMER_CREATED to setOf(DataTopic.TRANSACTIONS),
    )

    fun topicsFor(action: DomainAction): Set<DataTopic> = map[action].orEmpty()
}
