package com.hims.nativeapp.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.hims.nativeapp.ui.AppTab
import com.hims.nativeapp.ui.AppUiState
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.TextCharcoal

@Suppress("UNUSED_PARAMETER")
@Composable
fun TabFiltersDialog(
    selectedTab: AppTab,
    state: AppUiState,
    onDismiss: () -> Unit,
    onApplyPos: (categoryId: Int?) -> Unit,
    onClearPos: () -> Unit,
    onApplySales: (status: String, paymentStatus: String, deliveryStatus: String, dateFrom: String, dateTo: String) -> Unit,
    onClearSales: () -> Unit,
    onApplyDelivery: (status: String, dateFrom: String, dateTo: String) -> Unit,
    onClearDelivery: () -> Unit,
    onApplyWeigh: (type: String, status: String, dateFrom: String, dateTo: String) -> Unit,
    onClearWeigh: () -> Unit,
    onApplyInventory: (categoryId: Int?, lowStockOnly: Boolean) -> Unit,
    onClearInventory: () -> Unit,
    onApplyProduct: (categoryId: Int?, activeFilter: String) -> Unit,
    onClearProduct: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = BaseWhite,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 2.dp,
            shadowElevation = 8.dp,
        ) {
            when (selectedTab) {
                AppTab.POS -> {
                    PosFiltersContent(
                        state = state,
                        onApply = {
                            onApplyPos(it)
                            onDismiss()
                        },
                    )
                }
                AppTab.SALES -> {
                    SalesFiltersContent(
                        state = state,
                        onApply = { status, paymentStatus, deliveryStatus, dateFrom, dateTo ->
                            onApplySales(status, paymentStatus, deliveryStatus, dateFrom, dateTo)
                            onDismiss()
                        },
                    )
                }
                AppTab.DELIVERY -> {
                    DeliveryFiltersContent(
                        state = state,
                        onApply = { status, dateFrom, dateTo ->
                            onApplyDelivery(status, dateFrom, dateTo)
                            onDismiss()
                        },
                    )
                }
                AppTab.WEIGH -> {
                    WeighFiltersContent(
                        state = state,
                        onApply = { type, status, dateFrom, dateTo ->
                            onApplyWeigh(type, status, dateFrom, dateTo)
                            onDismiss()
                        },
                    )
                }
                AppTab.INVENTORY -> {
                    InventoryFiltersContent(
                        state = state,
                        onApply = { categoryId, lowStockOnly ->
                            onApplyInventory(categoryId, lowStockOnly)
                            onDismiss()
                        },
                    )
                }
                AppTab.PRODUCT_MENU -> {
                    ProductFiltersContent(
                        state = state,
                        onApply = { categoryId, activeFilter ->
                            onApplyProduct(categoryId, activeFilter)
                            onDismiss()
                        },
                    )
                }
                else -> {
                    NoFilterContent()
                }
            }
        }
    }
}

@Composable
private fun InventoryFiltersContent(
    state: AppUiState,
    onApply: (categoryId: Int?, lowStockOnly: Boolean) -> Unit,
) {
    var selectedCategoryId by remember(state.inventoryCategoryFilter) { mutableStateOf(state.inventoryCategoryFilter) }
    var lowStockOnly by remember(state.inventoryLowStockOnly) { mutableStateOf(state.inventoryLowStockOnly) }

    val categoryOptions =
        remember(state.inventoryCategories) {
            buildList {
                add(FilterOption(value = "all", label = "All"))
                state.inventoryCategories
                    .sortedBy { it.name.lowercase() }
                    .forEach { category ->
                        add(FilterOption(value = category.id.toString(), label = category.name))
                    }
            }
        }

    FilterContainer(
        title = "Inventory Filters",
        onApply = { onApply(selectedCategoryId, lowStockOnly) },
        onClear = {
            selectedCategoryId = null
            lowStockOnly = false
        },
    ) {
        FilterOptionGrid(
            label = "Category",
            options = categoryOptions,
            selectedValue = selectedCategoryId?.toString() ?: "all",
            onSelect = { selected ->
                selectedCategoryId = if (selected == "all") null else selected.toIntOrNull()
            },
        )
        FilterOptionGrid(
            label = "Stock",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("low", "Low Stock"),
                ),
            selectedValue = if (lowStockOnly) "low" else "all",
            onSelect = { selected -> lowStockOnly = selected == "low" },
        )
    }
}

@Composable
private fun PosFiltersContent(
    state: AppUiState,
    onApply: (categoryId: Int?) -> Unit,
) {
    val categories =
        remember(state.products) {
            state.products
                .mapNotNull { it.category }
                .distinctBy { it.id }
                .sortedBy { it.name.lowercase() }
        }
    var selectedCategoryId by remember(state.posCategoryFilter) { mutableStateOf(state.posCategoryFilter) }

    val categoryOptions =
        remember(categories) {
            buildList {
                add(FilterOption(value = "all", label = "All"))
                categories.forEach { category ->
                    add(FilterOption(value = category.id.toString(), label = category.name))
                }
            }
        }

    FilterContainer(
        title = "POS Filters",
        onApply = { onApply(selectedCategoryId) },
        onClear = { selectedCategoryId = null },
    ) {
        FilterOptionGrid(
            label = "Category",
            options = categoryOptions,
            selectedValue = selectedCategoryId?.toString() ?: "all",
            onSelect = { selected ->
                selectedCategoryId = if (selected == "all") null else selected.toIntOrNull()
            },
        )
    }
}

@Composable
private fun ProductFiltersContent(
    state: AppUiState,
    onApply: (categoryId: Int?, activeFilter: String) -> Unit,
) {
    var selectedCategoryId by remember(state.productCategoryFilter) { mutableStateOf(state.productCategoryFilter) }
    var activeFilter by remember(state.productActiveFilter) { mutableStateOf(state.productActiveFilter) }
    val categoryOptions =
        remember(state.inventoryCategories) {
            buildList {
                add(FilterOption(value = "all", label = "All"))
                state.inventoryCategories
                    .sortedBy { it.name.lowercase() }
                    .forEach { category ->
                        add(FilterOption(value = category.id.toString(), label = category.name))
                    }
            }
        }

    FilterContainer(
        title = "Product Filters",
        onApply = { onApply(selectedCategoryId, activeFilter) },
        onClear = {
            selectedCategoryId = null
            activeFilter = "all"
        },
    ) {
        FilterOptionGrid(
            label = "Category",
            options = categoryOptions,
            selectedValue = selectedCategoryId?.toString() ?: "all",
            onSelect = { selected ->
                selectedCategoryId = if (selected == "all") null else selected.toIntOrNull()
            },
        )
        FilterOptionGrid(
            label = "Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("active", "Active"),
                    FilterOption("inactive", "Inactive"),
                ),
            selectedValue = activeFilter,
            onSelect = { activeFilter = it },
        )
    }
}

@Composable
private fun SalesFiltersContent(
    state: AppUiState,
    onApply: (status: String, paymentStatus: String, deliveryStatus: String, dateFrom: String, dateTo: String) -> Unit,
) {
    var status by remember(state.salesStatusFilter) { mutableStateOf(state.salesStatusFilter) }
    var paymentStatus by remember(state.salesPaymentStatusFilter) { mutableStateOf(state.salesPaymentStatusFilter) }
    var deliveryStatus by remember(state.salesDeliveryStatusFilter) { mutableStateOf(state.salesDeliveryStatusFilter) }
    var dateFrom by remember(state.salesDateFrom) { mutableStateOf(state.salesDateFrom) }
    var dateTo by remember(state.salesDateTo) { mutableStateOf(state.salesDateTo) }
    var showDatePicker by remember { mutableStateOf(false) }

    FilterContainer(
        title = "Sales Filters",
        onApply = { onApply(status, paymentStatus, deliveryStatus, dateFrom, dateTo) },
        onClear = {
            status = "all"
            paymentStatus = "all"
            deliveryStatus = "all"
            dateFrom = ""
            dateTo = ""
        },
    ) {
        FilterOptionGrid(
            label = "Sale Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("OPEN", "Open"),
                    FilterOption("COMPLETED", "Completed"),
                    FilterOption("PARTIAL", "Partial"),
                    FilterOption("PARTIALLY_REFUNDED", "Partially Refunded"),
                    FilterOption("REFUNDED", "Refunded"),
                    FilterOption("VOIDED", "Voided"),
                ),
            selectedValue = status,
            onSelect = { status = it },
        )
        FilterOptionGrid(
            label = "Payment Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("UNPAID", "Unpaid"),
                    FilterOption("PARTIALLY_PAID", "Partially Paid"),
                    FilterOption("FULLY_PAID", "Fully Paid"),
                    FilterOption("PARTIALLY_REFUNDED", "Partially Refunded"),
                    FilterOption("REFUNDED", "Refunded"),
                    FilterOption("REVERSED", "Reversed"),
                ),
            selectedValue = paymentStatus,
            onSelect = { paymentStatus = it },
        )
        FilterOptionGrid(
            label = "Delivery Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("PENDING", "Pending"),
                    FilterOption("PARTIAL", "Partial"),
                    FilterOption("DELIVERED", "Delivered"),
                    FilterOption("RETURNED", "Returned"),
                    FilterOption("CANCELED", "Canceled"),
                    FilterOption("WALK_IN", "Walk In"),
                ),
            selectedValue = deliveryStatus,
            onSelect = { deliveryStatus = it },
        )
        FilterDateRangeSummary(
            dateFrom = dateFrom,
            dateTo = dateTo,
            onClick = { showDatePicker = true },
        )
    }

    if (showDatePicker) {
        DateRangePickerDialog(
            title = "Select date",
            initialDateFrom = dateFrom,
            initialDateTo = dateTo,
            onDismiss = { showDatePicker = false },
            onApply = { from, to ->
                dateFrom = from
                dateTo = to
                showDatePicker = false
            },
            onClear = {
                dateFrom = ""
                dateTo = ""
                showDatePicker = false
            },
        )
    }
}

@Composable
private fun DeliveryFiltersContent(
    state: AppUiState,
    onApply: (status: String, dateFrom: String, dateTo: String) -> Unit,
) {
    var status by remember(state.deliveryStatusFilter) { mutableStateOf(state.deliveryStatusFilter) }
    var dateFrom by remember(state.deliveryDateFrom) { mutableStateOf(state.deliveryDateFrom) }
    var dateTo by remember(state.deliveryDateTo) { mutableStateOf(state.deliveryDateTo) }
    var showDatePicker by remember { mutableStateOf(false) }

    FilterContainer(
        title = "Delivery Filters",
        onApply = { onApply(status, dateFrom, dateTo) },
        onClear = {
            status = "all"
            dateFrom = ""
            dateTo = ""
        },
    ) {
        FilterOptionGrid(
            label = "Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("pending", "Pending"),
                    FilterOption("partial", "Partial"),
                ),
            selectedValue = status,
            onSelect = { status = it },
        )
        FilterDateRangeSummary(
            dateFrom = dateFrom,
            dateTo = dateTo,
            onClick = { showDatePicker = true },
        )
    }

    if (showDatePicker) {
        DateRangePickerDialog(
            title = "Select date",
            initialDateFrom = dateFrom,
            initialDateTo = dateTo,
            onDismiss = { showDatePicker = false },
            onApply = { from, to ->
                dateFrom = from
                dateTo = to
                showDatePicker = false
            },
            onClear = {
                dateFrom = ""
                dateTo = ""
                showDatePicker = false
            },
        )
    }
}

@Composable
private fun WeighFiltersContent(
    state: AppUiState,
    onApply: (type: String, status: String, dateFrom: String, dateTo: String) -> Unit,
) {
    var type by remember(state.weighTypeFilter) { mutableStateOf(state.weighTypeFilter) }
    var status by remember(state.weighStatusFilter) { mutableStateOf(state.weighStatusFilter) }
    var dateFrom by remember(state.weighDateFrom) { mutableStateOf(state.weighDateFrom) }
    var dateTo by remember(state.weighDateTo) { mutableStateOf(state.weighDateTo) }
    var showDatePicker by remember { mutableStateOf(false) }

    FilterContainer(
        title = "Weigh-In Filters",
        onApply = { onApply(type, status, dateFrom, dateTo) },
        onClear = {
            type = "all"
            status = "all"
            dateFrom = ""
            dateTo = ""
        },
    ) {
        FilterOptionGrid(
            label = "Type",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("cooked_copra", "Cooked Copra"),
                    FilterOption("uncooked_copra", "Uncooked Copra"),
                    FilterOption("coconut", "Coconut"),
                ),
            selectedValue = type,
            onSelect = { type = it },
        )
        FilterOptionGrid(
            label = "Status",
            options =
                listOf(
                    FilterOption("all", "All"),
                    FilterOption("unpaid", "Unpaid"),
                    FilterOption("paid", "Paid"),
                ),
            selectedValue = status,
            onSelect = { status = it },
        )
        FilterDateRangeSummary(
            dateFrom = dateFrom,
            dateTo = dateTo,
            onClick = { showDatePicker = true },
        )
    }

    if (showDatePicker) {
        DateRangePickerDialog(
            title = "Select date",
            initialDateFrom = dateFrom,
            initialDateTo = dateTo,
            onDismiss = { showDatePicker = false },
            onApply = { from, to ->
                dateFrom = from
                dateTo = to
                showDatePicker = false
            },
            onClear = {
                dateFrom = ""
                dateTo = ""
                showDatePicker = false
            },
        )
    }
}

@Composable
private fun NoFilterContent() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "No filters available for this page.",
            color = TextCharcoal,
        )
    }
}

@Composable
private fun FilterContainer(
    title: String,
    onApply: () -> Unit,
    onClear: () -> Unit,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = title,
            color = TextCharcoal,
        )
        content()
        FilterActionRow(
            onClear = onClear,
            onApply = onApply,
        )
    }
}
