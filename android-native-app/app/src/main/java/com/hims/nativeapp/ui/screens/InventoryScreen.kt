package com.hims.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.TrendingDown
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.data.model.InventoryMovement
import com.hims.nativeapp.data.model.InventoryVariant
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.extractDatePart
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.formatTimeLabel
import com.hims.nativeapp.util.fullImageUrl

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun InventoryScreen(
    variants: List<InventoryVariant>,
    dashboard: InventoryDashboardData?,
    movements: List<InventoryMovement>,
    categories: List<ProductCategory>,
    searchQuery: String,
    isActionLoading: Boolean,
    selectedCategoryId: Int?,
    lowStockOnly: Boolean,
    onStockIn: (
        variantId: Int,
        quantity: Int,
        unitCost: Double,
        unitPrice: Double?,
        applyPriceMode: String,
        notes: String,
        onSuccess: () -> Unit,
    ) -> Unit,
    onAdjust: (variantId: Int, quantity: Int, type: String, reason: String, notes: String, onSuccess: () -> Unit) -> Unit,
    onHistoryModeChange: (Boolean) -> Unit = {},
    onBack: () -> Unit,
) {
    var expandedVariantId by remember { mutableStateOf<Int?>(null) }
    var stockInVariant by remember { mutableStateOf<InventoryVariant?>(null) }
    var adjustVariant by remember { mutableStateOf<InventoryVariant?>(null) }
    var showHistory by remember { mutableStateOf(false) }
    var historyVariantFilter by remember { mutableStateOf<InventoryVariant?>(null) }

    LaunchedEffect(showHistory) {
        onHistoryModeChange(showHistory)
    }
    DisposableEffect(Unit) {
        onDispose { onHistoryModeChange(false) }
    }

    BackHandler {
        if (showHistory) {
            showHistory = false
            historyVariantFilter = null
        } else {
            onBack()
        }
    }

    val filtered =
        remember(variants, searchQuery, selectedCategoryId, lowStockOnly) {
            val q = searchQuery.trim()
            variants
                .filter { variant ->
                    val stock = variant.inventory?.quantityOnHand ?: 0.0
                    val matchesSearch =
                        if (q.isBlank()) {
                            true
                        } else {
                            variant.product.name.contains(q, ignoreCase = true) ||
                                variant.description.orEmpty().contains(q, ignoreCase = true) ||
                                variant.product.sku.orEmpty().contains(q, ignoreCase = true)
                        }
                    val matchesCategory = selectedCategoryId == null || variant.product.category?.id == selectedCategoryId
                    val matchesLowStock = !lowStockOnly || stock <= 10.0
                    matchesSearch && matchesCategory && matchesLowStock
                }.sortedWith(
                    compareByDescending<InventoryVariant> { it.inventory?.quantityOnHand ?: 0.0 }
                        .thenBy { it.product.name.lowercase() },
                )
        }

    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleFiltered =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }

    val inStockVariants = remember(visibleFiltered) { visibleFiltered.filter { (it.inventory?.quantityOnHand ?: 0.0) > 10.0 } }
    val lowStockVariants =
        remember(visibleFiltered) {
            visibleFiltered.filter { (it.inventory?.quantityOnHand ?: 0.0) > 0.0 && (it.inventory?.quantityOnHand ?: 0.0) <= 10.0 }
        }
    val outOfStockVariants = remember(visibleFiltered) { visibleFiltered.filter { (it.inventory?.quantityOnHand ?: 0.0) <= 0.0 } }
    val groupedByStock =
        remember(inStockVariants, lowStockVariants, outOfStockVariants) {
            listOf(
                "In Stock" to inStockVariants,
                "Low Stock" to lowStockVariants,
                "Out of Stock" to outOfStockVariants,
            ).filter { it.second.isNotEmpty() }
        }

    val summaryTotal = remember(filtered) { filtered.size }
    val summaryLow = remember(filtered) { filtered.count { (it.inventory?.quantityOnHand ?: 0.0) in 0.0001..10.0 } }
    val summaryOut = remember(filtered) { filtered.count { (it.inventory?.quantityOnHand ?: 0.0) <= 0.0 } }
    val summaryValue = remember(filtered) { filtered.sumOf { (it.inventory?.quantityOnHand ?: 0.0) * it.unitPrice } }
    val summaryHardwareStock =
        remember(filtered) {
            filtered
                .filterNot { isAgriculturalCategory(it.product.category?.name) }
                .sumOf { it.inventory?.quantityOnHand ?: 0.0 }
        }
    val summaryAgriculturalStock =
        remember(filtered) {
            filtered
                .filter { isAgriculturalCategory(it.product.category?.name) }
                .sumOf { it.inventory?.quantityOnHand ?: 0.0 }
        }
    val summaryHardwareValue =
        remember(filtered) {
            filtered
                .filterNot { isAgriculturalCategory(it.product.category?.name) }
                .sumOf { (it.inventory?.quantityOnHand ?: 0.0) * it.unitPrice }
        }
    val summaryAgriculturalValue =
        remember(filtered) {
            filtered
                .filter { isAgriculturalCategory(it.product.category?.name) }
                .sumOf { (it.inventory?.quantityOnHand ?: 0.0) * it.unitPrice }
        }

    if (showHistory) {
        InventoryHistoryPage(
            movements = movements,
            variantFilter = historyVariantFilter,
            onBack = {
                showHistory = false
                historyVariantFilter = null
            },
        )
        return
    }

    val cardMetrics =
        dashboard?.let {
            InventoryMetrics(
                totalItems = it.totalItems,
                lowStock = it.lowStockCount,
                outOfStock = it.outOfStockCount,
                totalValue = it.totalValue,
                hardwareStock = it.hardwareStock,
                agriculturalStock = it.agriculturalStock,
                hardwareValue = it.hardwareValue,
                agriculturalValue = it.agriculturalValue,
            )
        } ?: InventoryMetrics(
            totalItems = summaryTotal,
            lowStock = summaryLow,
            outOfStock = summaryOut,
            totalValue = summaryValue,
            hardwareStock = summaryHardwareStock,
            agriculturalStock = summaryAgriculturalStock,
            hardwareValue = summaryHardwareValue,
            agriculturalValue = summaryAgriculturalValue,
        )

    LazyColumn(
        state = incrementalState.listState,
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (selectedCategoryId != null || lowStockOnly) {
            item("active-filters") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (selectedCategoryId != null) {
                        val categoryName = categories.firstOrNull { it.id == selectedCategoryId }?.name ?: "Category"
                        Box(
                            modifier =
                                Modifier
                                    .background(Color(0xFFE8EEF9), RoundedCornerShape(999.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                        ) {
                            Text(
                                text = categoryName,
                                color = PrimaryBlue,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                    if (lowStockOnly) {
                        Box(
                            modifier =
                                Modifier
                                    .background(Color(0xFFFFEDD5), RoundedCornerShape(999.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                        ) {
                            Text(
                                text = "Low Stock Only",
                                color = SafetyOrange,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }
        }

        item("summary") {
            InventorySummaryCard(
                metrics = cardMetrics,
                onViewHistory = {
                    historyVariantFilter = null
                    showHistory = true
                },
            )
        }

        if (filtered.isEmpty()) {
            item("empty") {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "No inventory items found.",
                        color = Color(0xFF6B7280),
                        fontSize = 14.sp,
                    )
                }
            }
        } else {
            groupedByStock.forEach { (stockLabel, variantsForStatus) ->
                stickyHeader(key = "inventory-stock-$stockLabel") {
                    Box(
                        modifier = Modifier.fillMaxWidth().background(AppBackground).padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = stockLabel,
                            color = TextCharcoal,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }

                items(variantsForStatus, key = { it.id }) { variant ->
                    InventoryVariantCard(
                        variant = variant,
                        expanded = expandedVariantId == variant.id,
                        isActionLoading = isActionLoading,
                        onToggleExpand = {
                            expandedVariantId =
                                if (expandedVariantId == variant.id) {
                                    null
                                } else {
                                    variant.id
                                }
                        },
                        onStockIn = { stockInVariant = variant },
                        onAdjust = { adjustVariant = variant },
                        onHistory = {
                            historyVariantFilter = variant
                            showHistory = true
                        },
                    )
                }
            }
            if (incrementalState.visibleCount < filtered.size) {
                item("load-more-inventory-items") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading more inventory items...",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
    }

    stockInVariant?.let { variant ->
        StockInDialog(
            variant = variant,
            isActionLoading = isActionLoading,
            onDismiss = { if (!isActionLoading) stockInVariant = null },
            onSubmit = { qty, unitCost, unitPrice, applyMode, notes ->
                onStockIn(variant.id, qty, unitCost, unitPrice, applyMode, notes) {
                    stockInVariant = null
                    expandedVariantId = null
                }
            },
        )
    }

    adjustVariant?.let { variant ->
        AdjustmentDialog(
            variant = variant,
            isActionLoading = isActionLoading,
            onDismiss = { if (!isActionLoading) adjustVariant = null },
            onSubmit = { qty, type, reason, notes ->
                onAdjust(variant.id, qty, type, reason, notes) {
                    adjustVariant = null
                    expandedVariantId = null
                }
            },
        )
    }

}

private data class InventoryMetrics(
    val totalItems: Int,
    val lowStock: Int,
    val outOfStock: Int,
    val totalValue: Double,
    val hardwareStock: Double,
    val agriculturalStock: Double,
    val hardwareValue: Double,
    val agriculturalValue: Double,
)

@Composable
private fun InventorySummaryCard(
    metrics: InventoryMetrics,
    onViewHistory: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                    .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Inventory Dashboard",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "View History",
                    color = PrimaryBlue,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable(onClick = onViewHistory),
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SummaryPill(label = "Items", value = metrics.totalItems.toString(), modifier = Modifier.weight(1f))
                SummaryPill(
                    label = "Low Stock",
                    value = metrics.lowStock.toString(),
                    valueColor = SafetyOrange,
                    modifier = Modifier.weight(1f),
                )
                SummaryPill(
                    label = "Out of Stock",
                    value = metrics.outOfStock.toString(),
                    valueColor = Color(0xFFDC2626),
                    modifier = Modifier.weight(1f),
                )
            }

            HorizontalDivider(color = BorderSoft)

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StockValueTile(
                    label = "Hardware",
                    stock = metrics.hardwareStock,
                    value = metrics.hardwareValue,
                    accent = PrimaryBlue,
                    modifier = Modifier.weight(1f),
                )
                StockValueTile(
                    label = "Agricultural",
                    stock = metrics.agriculturalStock,
                    value = metrics.agriculturalValue,
                    accent = Color(0xFF0F766E),
                    modifier = Modifier.weight(1f),
                )
            }

            HorizontalDivider(color = BorderSoft)
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Total Inventory Value",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPeso(metrics.totalValue),
                    color = TextCharcoal,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun StockValueTile(
    label: String,
    stock: Double,
    value: Double,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            text = label,
            color = Color(0xFF6B7280),
            fontSize = 11.sp,
        )
        Text(
            text = "${formatQty(stock)} stock",
            color = accent,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = formatPeso(value),
            color = TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun SummaryPill(
    label: String,
    value: String,
    valueColor: Color = TextCharcoal,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = label,
            color = Color(0xFF6B7280),
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            color = valueColor,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private data class InventoryAction(
    val key: String,
    val label: String,
    val tint: Color,
    val icon: ImageVector,
    val onClick: () -> Unit,
)

@Composable
private fun InventoryVariantCard(
    variant: InventoryVariant,
    expanded: Boolean,
    isActionLoading: Boolean,
    onToggleExpand: () -> Unit,
    onStockIn: () -> Unit,
    onAdjust: () -> Unit,
    onHistory: () -> Unit,
) {
    val stock = variant.inventory?.quantityOnHand ?: 0.0
    val unitLabel = variant.product.baseUnit?.trim().orEmpty().ifBlank { null }
    val stockLabel = if (unitLabel == null) formatQty(stock) else "${formatQty(stock)} $unitLabel"
    val priceLabel = if (unitLabel == null) formatPeso(variant.unitPrice) else "${formatPeso(variant.unitPrice)}/$unitLabel"
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, variant.product.image)
    val statusLabel: String
    val statusColor: Color
    val statusBg: Color
    when {
        stock <= 0.0 -> {
            statusLabel = "Out of Stock"
            statusColor = Color(0xFFDC2626)
            statusBg = Color(0xFFFFE4E6)
        }
        stock <= 10.0 -> {
            statusLabel = "Low Stock"
            statusColor = Color(0xFFB45309)
            statusBg = Color(0xFFFFF7ED)
        }
        else -> {
            statusLabel = "In Stock"
            statusColor = Color(0xFF059669)
            statusBg = Color(0xFFECFDF5)
        }
    }
    val actions =
        listOf(
            InventoryAction(
                key = "stock-in",
                label = "Stock In",
                tint = PrimaryBlue,
                icon = Icons.Outlined.AddCircleOutline,
                onClick = onStockIn,
            ),
            InventoryAction(
                key = "adjust",
                label = "Adjustment",
                tint = SafetyOrange,
                icon = Icons.Outlined.Tune,
                onClick = onAdjust,
            ),
            InventoryAction(
                key = "history",
                label = "History",
                tint = Color(0xFF0F766E),
                icon = Icons.Outlined.History,
                onClick = onHistory,
            ),
        )

    Card(
        modifier = Modifier.fillMaxWidth().clickable { onToggleExpand() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                    .padding(14.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = variant.product.name,
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Box(
                    modifier =
                        Modifier
                            .background(statusBg, RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = statusLabel,
                        color = statusColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Box(
                    modifier =
                        Modifier
                            .size(72.dp)
                            .background(Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = variant.product.name,
                            modifier = Modifier.size(72.dp),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Outlined.Image,
                            contentDescription = null,
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = variant.description ?: "-",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    variant.product.sku?.takeIf { it.isNotBlank() }?.let { sku ->
                        Text(
                            text = "SKU: $sku",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                    Text(
                        text = "Stock: $stockLabel",
                        color = TextCharcoal,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                Text(
                    text = priceLabel,
                    color = TextCharcoal,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            if (expanded) {
                HorizontalDivider(modifier = Modifier.padding(top = 10.dp, bottom = 6.dp), color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    actions.forEachIndexed { index, action ->
                        Column(
                            modifier =
                                Modifier
                                    .weight(1f)
                                    .clickable(enabled = !isActionLoading) { action.onClick() }
                                    .padding(vertical = 3.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Icon(
                                imageVector = action.icon,
                                contentDescription = action.label,
                                tint = action.tint,
                                modifier = Modifier.size(20.dp),
                            )
                            Text(
                                text = action.label,
                                color = action.tint,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        if (index < actions.lastIndex) {
                            Box(
                                modifier =
                                    Modifier
                                        .height(34.dp)
                                        .width(1.dp)
                                        .background(BorderSoft),
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun InventoryHistoryPage(
    movements: List<InventoryMovement>,
    variantFilter: InventoryVariant?,
    onBack: () -> Unit,
) {
    var typeFilter by remember(variantFilter?.id) { mutableStateOf("all") }

    val filteredMovements =
        remember(movements, variantFilter?.id, typeFilter) {
            movements.filter { movement ->
                val matchesVariant =
                    variantFilter == null ||
                        movement.productVariantId == variantFilter.id ||
                        movement.productVariant?.id == variantFilter.id

                val movementType = movement.type.orEmpty().uppercase()
                val matchesType =
                    when (typeFilter) {
                        "in" -> movementType == "IN"
                        "out" -> movementType == "OUT"
                        else -> true
                    }

                matchesVariant && matchesType
            }
        }
    val incrementalState = rememberIncrementalListState(totalItems = filteredMovements.size)
    val visibleFilteredMovements =
        remember(filteredMovements, incrementalState.visibleCount) {
            filteredMovements.take(incrementalState.visibleCount)
        }
    val groupedMovements =
        remember(visibleFilteredMovements) {
            visibleFilteredMovements
                .groupBy { movement ->
                    extractDatePart(movement.createdAt.orEmpty()).takeIf { it.isNotBlank() } ?: "NO_DATE"
                }.toList()
                .sortedWith(
                    compareByDescending<Pair<String, List<InventoryMovement>>> { pair ->
                        if (pair.first == "NO_DATE") {
                            ""
                        } else {
                            pair.first
                        }
                    },
                )
        }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "Back",
                tint = TextCharcoal,
                modifier = Modifier.size(28.dp).clickable(onClick = onBack),
            )
            Text(
                text = "Inventory History",
                color = TextCharcoal,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(start = 6.dp),
            )
        }

        variantFilter?.let { variant ->
            Text(
                text = "${variant.product.name} - ${variant.description ?: "-"}",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 2.dp),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ChoiceChip(
                label = "All",
                selected = typeFilter == "all",
                enabled = true,
                onClick = { typeFilter = "all" },
            )
            ChoiceChip(
                label = "Stock In",
                selected = typeFilter == "in",
                enabled = true,
                onClick = { typeFilter = "in" },
            )
            ChoiceChip(
                label = "Stock Out",
                selected = typeFilter == "out",
                enabled = true,
                onClick = { typeFilter = "out" },
            )
        }

        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 20.dp, top = 6.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (visibleFilteredMovements.isEmpty()) {
                item("empty-history") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "No inventory movements found.",
                            color = Color(0xFF6B7280),
                            fontSize = 14.sp,
                        )
                    }
                }
            } else {
                groupedMovements.forEach { (dateKey, movementsOnDate) ->
                    stickyHeader(key = "inventory-history-date-$dateKey") {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(AppBackground)
                                    .padding(vertical = 6.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = inventoryDateHeaderLabel(dateKey),
                                color = TextCharcoal,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }

                    items(movementsOnDate, key = { it.id }) { movement ->
                        InventoryMovementItem(movement = movement)
                    }
                }
                if (incrementalState.visibleCount < filteredMovements.size) {
                    item("load-more-inventory-history") {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "Loading more movement records...",
                                color = Color(0xFF6B7280),
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InventoryMovementItem(movement: InventoryMovement) {
    val normalizedType = movement.type.orEmpty().uppercase()
    val isStockIn = normalizedType == "IN"
    val typeColor = if (isStockIn) Color(0xFF059669) else Color(0xFFDC2626)
    val typeBackground = if (isStockIn) Color(0xFFECFDF5) else Color(0xFFFFE4E6)
    val typeIcon = if (isStockIn) Icons.AutoMirrored.Outlined.TrendingUp else Icons.AutoMirrored.Outlined.TrendingDown
    val productName = movement.productVariant?.product?.name ?: "-"
    val variantName = movement.productVariant?.description ?: "-"
    val unitLabel = movement.productVariant?.product?.baseUnit?.trim().orEmpty().ifBlank { null }
    val byText = movement.recordedBy?.name ?: "-"
    val dateText = movement.createdAt?.takeIf { it.isNotBlank() }?.let { formatDateHeader(it) } ?: "-"
    val timeText = movement.createdAt?.takeIf { it.isNotBlank() }?.let { formatTimeLabel(it) } ?: "-"
    val quantityText = if (unitLabel == null) formatQty(movement.quantity) else "${formatQty(movement.quantity)} $unitLabel"
    val unitCostText = movement.unitCost?.let { formatPeso(it) } ?: "-"
    val notesText = movement.notes?.takeIf { it.isNotBlank() } ?: "-"

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = productName,
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Box(
                    modifier =
                        Modifier
                            .background(typeBackground, RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = typeIcon,
                            contentDescription = null,
                            tint = typeColor,
                            modifier = Modifier.size(12.dp),
                        )
                        Text(
                            text = normalizedType.ifBlank { "-" },
                            color = typeColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            Text(
                text = variantName,
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = "Qty: $quantityText",
                    color = TextCharcoal,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = prettyMovementReason(movement.reason),
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
            }
            movementFieldRow(label = "Date", value = dateText)
            movementFieldRow(label = "Time", value = timeText)
            movementFieldRow(label = "Unit Cost", value = unitCostText)
            movementFieldRow(label = "Recorded By", value = byText)
            movementFieldRow(label = "Notes", value = notesText)
        }
    }
}

@Composable
private fun movementFieldRow(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            text = label,
            color = Color(0xFF6B7280),
            fontSize = 11.sp,
        )
        Text(
            text = value,
            color = TextCharcoal,
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private fun prettyMovementReason(reason: String?): String {
    val raw = reason.orEmpty().trim()
    if (raw.isBlank()) {
        return "-"
    }
    val normalized = raw.replace('_', ' ')
    return normalized.replaceFirstChar { first ->
        if (first.isLowerCase()) {
            first.titlecase()
        } else {
            first.toString()
        }
    }
}

private fun isAgriculturalCategory(categoryName: String?): Boolean {
    return categoryName?.trim()?.equals("Agricultural Products", ignoreCase = true) == true
}

private fun inventoryDateHeaderLabel(dateKey: String): String {
    return if (dateKey == "NO_DATE") {
        "No Activity Date"
    } else {
        formatDateHeader(dateKey)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StockInDialog(
    variant: InventoryVariant,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (
        quantity: Int,
        unitCost: Double,
        unitPrice: Double?,
        applyPriceMode: String,
        notes: String,
    ) -> Unit,
) {
    var quantityText by remember(variant.id) { mutableStateOf("1") }
    var unitCostText by remember(variant.id) { mutableStateOf("") }
    var unitPriceText by remember(variant.id) { mutableStateOf("") }
    var applyPriceMode by remember(variant.id) { mutableStateOf("all") }
    var notes by remember(variant.id) { mutableStateOf("") }
    var error by remember(variant.id) { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val currentStock = variant.inventory?.quantityOnHand ?: 0.0
    val unitLabel = variant.product.baseUnit?.trim().orEmpty().ifBlank { null }
    val currentStockLabel = if (unitLabel == null) formatQty(currentStock) else "${formatQty(currentStock)} $unitLabel"
    val currentPriceLabel = if (unitLabel == null) formatPeso(variant.unitPrice) else "${formatPeso(variant.unitPrice)}/$unitLabel"

    ModalBottomSheet(
        onDismissRequest = {
            if (!isActionLoading) {
                onDismiss()
            }
        },
        sheetState = sheetState,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BaseWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                            .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = "Stock In",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    Text(
                        text = "${variant.product.name} - ${variant.description ?: "-"}",
                        color = TextCharcoal,
                        fontSize = 13.sp,
                    )
                    Text(
                        text = "Current Stock: $currentStockLabel",
                        color = Color(0xFF374151),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        text = "Current Unit Price: $currentPriceLabel",
                        color = Color(0xFF374151),
                        fontSize = 12.sp,
                    )
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = {
                            quantityText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Quantity") },
                        enabled = !isActionLoading,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    OutlinedTextField(
                        value = unitCostText,
                        onValueChange = {
                            unitCostText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Unit Cost *") },
                        enabled = !isActionLoading,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    OutlinedTextField(
                        value = unitPriceText,
                        onValueChange = {
                            unitPriceText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Unit Price (Optional)") },
                        enabled = !isActionLoading,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    if (unitPriceText.trim().isNotBlank()) {
                        Text(
                            text = "Apply unit price to:",
                            color = TextCharcoal,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ChoiceChip(
                                label = "All Stock",
                                selected = applyPriceMode == "all",
                                enabled = !isActionLoading,
                                onClick = {
                                    applyPriceMode = "all"
                                    error = null
                                },
                            )
                            ChoiceChip(
                                label = "This Batch",
                                selected = applyPriceMode == "batch",
                                enabled = !isActionLoading,
                                onClick = {
                                    applyPriceMode = "batch"
                                    error = null
                                },
                            )
                        }
                        Text(
                            text =
                                if (applyPriceMode == "all") {
                                    "All on-hand stock will use the new unit price immediately."
                                } else {
                                    "New unit price activates after older stock is sold out."
                                },
                            color = Color(0xFF6B7280),
                            fontSize = 11.sp,
                        )
                    }
                    OutlinedTextField(
                        value = notes,
                        onValueChange = {
                            notes = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Notes (Optional)") },
                        enabled = !isActionLoading,
                    )
                    error?.let {
                        Text(
                            text = it,
                            color = Color(0xFFDC2626),
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(
                    enabled = !isActionLoading,
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Cancel", color = Color(0xFF6B7280))
                }
                Button(
                    onClick = {
                        error = null
                        val quantity = quantityText.trim().toIntOrNull()
                        if (quantity == null || quantity <= 0) {
                            error = "Quantity must be greater than zero."
                            return@Button
                        }
                        val unitCost = unitCostText.trim().toDoubleOrNull()
                        if (unitCost == null || unitCost <= 0.0) {
                            error = "Unit cost is required and must be greater than zero."
                            return@Button
                        }
                        val unitPrice =
                            if (unitPriceText.trim().isBlank()) {
                                null
                            } else {
                                unitPriceText.trim().toDoubleOrNull()
                            }
                        if (unitPriceText.trim().isNotBlank() && (unitPrice == null || unitPrice < 0.0)) {
                            error = "Unit price must be a valid non-negative value."
                            return@Button
                        }
                        onSubmit(quantity, unitCost, unitPrice, applyPriceMode, notes.trim())
                    },
                    enabled = !isActionLoading,
                    modifier = Modifier.weight(1f),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = PrimaryBlue,
                            contentColor = BaseWhite,
                            disabledContainerColor = Color(0xFFE5E7EB),
                            disabledContentColor = Color(0xFF9CA3AF),
                        ),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text(
                        text = if (isActionLoading) "Saving..." else "Stock In",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdjustmentDialog(
    variant: InventoryVariant,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (quantity: Int, type: String, reason: String, notes: String) -> Unit,
) {
    var quantityText by remember(variant.id) { mutableStateOf("1") }
    var type by remember(variant.id) { mutableStateOf("IN") }
    var reason by remember(variant.id) { mutableStateOf("adjustment") }
    var notes by remember(variant.id) { mutableStateOf("") }
    var error by remember(variant.id) { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val reasonOptions = listOf("adjustment", "damage", "loss", "found", "correction")
    val currentStock = variant.inventory?.quantityOnHand ?: 0.0
    val unitLabel = variant.product.baseUnit?.trim().orEmpty().ifBlank { null }
    val currentStockLabel = if (unitLabel == null) formatQty(currentStock) else "${formatQty(currentStock)} $unitLabel"

    ModalBottomSheet(
        onDismissRequest = {
            if (!isActionLoading) {
                onDismiss()
            }
        },
        sheetState = sheetState,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BaseWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                            .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = "Adjustment",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    Text(
                        text = "${variant.product.name} - ${variant.description ?: "-"}",
                        color = TextCharcoal,
                        fontSize = 13.sp,
                    )
                    Text(
                        text = "Current Stock: $currentStockLabel",
                        color = Color(0xFF374151),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        ChoiceChip(
                            label = "Add",
                            selected = type == "IN",
                            enabled = !isActionLoading,
                            onClick = {
                                type = "IN"
                                error = null
                            },
                            modifier = Modifier.weight(1f),
                        )
                        ChoiceChip(
                            label = "Remove",
                            selected = type == "OUT",
                            enabled = !isActionLoading,
                            onClick = {
                                type = "OUT"
                                error = null
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = {
                            quantityText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Quantity") },
                        enabled = !isActionLoading,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    Text(
                        text = "Reason",
                        color = TextCharcoal,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        reasonOptions.chunked(2).forEach { rowOptions ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                rowOptions.forEach { option ->
                                    ChoiceChip(
                                        label = option.replaceFirstChar { it.uppercaseChar() },
                                        selected = reason == option,
                                        enabled = !isActionLoading,
                                        onClick = {
                                            reason = option
                                            error = null
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                if (rowOptions.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = notes,
                        onValueChange = {
                            notes = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Notes (Optional)") },
                        enabled = !isActionLoading,
                    )
                    error?.let {
                        Text(
                            text = it,
                            color = Color(0xFFDC2626),
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(
                    enabled = !isActionLoading,
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Cancel", color = Color(0xFF6B7280))
                }
                Button(
                    onClick = {
                        error = null
                        val quantity = quantityText.trim().toIntOrNull()
                        if (quantity == null || quantity <= 0) {
                            error = "Quantity must be greater than zero."
                            return@Button
                        }
                        onSubmit(quantity, type, reason, notes.trim())
                    },
                    enabled = !isActionLoading,
                    modifier = Modifier.weight(1f),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = PrimaryBlue,
                            contentColor = BaseWhite,
                            disabledContainerColor = Color(0xFFE5E7EB),
                            disabledContentColor = Color(0xFF9CA3AF),
                        ),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text(
                        text = if (isActionLoading) "Saving..." else "Apply",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ChoiceChip(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(36.dp)
                .background(if (selected) Color(0xFFE8EEF9) else BaseWhite, RoundedCornerShape(999.dp))
                .border(1.dp, if (selected) PrimaryBlue else BorderSoft, RoundedCornerShape(999.dp))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) PrimaryBlue else TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
