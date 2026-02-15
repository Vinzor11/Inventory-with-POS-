package com.hims.nativeapp.core

object RefreshKeys {
    const val SALES_LIST = "SALES_LIST"
    fun saleDetail(saleId: Int): String = "SALE_DETAIL_$saleId"

    const val INVENTORY_SUMMARY = "INVENTORY_SUMMARY"
    const val INVENTORY_PRODUCT_PREFIX = "INVENTORY_PRODUCT_"
    fun inventoryProduct(productVariantId: Int): String = "$INVENTORY_PRODUCT_PREFIX$productVariantId"

    const val DASHBOARD_METRICS = "DASHBOARD_METRICS"
    const val POS_SUMMARY = "POS_SUMMARY"
}
