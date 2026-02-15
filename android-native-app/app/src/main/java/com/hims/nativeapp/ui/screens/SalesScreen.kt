package com.hims.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.RemoveCircleOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.DeliveryForSaleData
import com.hims.nativeapp.data.model.RefundForSaleData
import com.hims.nativeapp.data.model.RefundItemRequest
import com.hims.nativeapp.data.model.Sale
import com.hims.nativeapp.data.model.SaleItem
import com.hims.nativeapp.data.model.SaleItemQuantityRequest
import com.hims.nativeapp.data.model.SalePayment
import com.hims.nativeapp.data.model.SaleRefund
import com.hims.nativeapp.ui.components.CopyActionButton
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.util.extractDatePart
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.formatTimeLabel
import com.hims.nativeapp.util.fullImageUrl
import kotlin.math.floor
import java.util.Locale

private data class ActionItem(
    val key: String,
    val label: String,
    val tint: Color,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val onClick: () -> Unit,
)

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    sales: List<Sale>,
    canManageAdminActions: Boolean,
    searchQuery: String,
    expandedIds: Set<Int>,
    isActionLoading: Boolean,
    onToggleExpand: (Int) -> Unit,
    onPrintReceipt: (saleId: Int) -> Unit,
    onFetchSaleDetails: (saleId: Int, onSuccess: (Sale) -> Unit) -> Unit,
    onSubmitDelivery: (saleId: Int, items: List<SaleItemQuantityRequest>, notes: String, onSuccess: () -> Unit) -> Unit,
    onOpenDeliveryCart: (saleId: Int) -> Unit,
    onFetchRefundDetails: (saleId: Int, onSuccess: (RefundForSaleData) -> Unit) -> Unit,
    onSubmitRefund: (saleId: Int, items: List<RefundItemRequest>, reason: String, refundMethod: String, onSuccess: () -> Unit) -> Unit,
    onAddPayment: (saleId: Int, amount: Double, paymentMethod: String, notes: String, onSuccess: () -> Unit) -> Unit,
    onCancelSaleItem: (saleId: Int, saleItemId: Int, quantityToCancel: Double, reason: String, onSuccess: () -> Unit) -> Unit,
    onVoidSale: (saleId: Int, reason: String, onSuccess: () -> Unit) -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit,
) {
    var detailsSale by remember { mutableStateOf<Sale?>(null) }
    var deliveryData by remember { mutableStateOf<DeliveryForSaleData?>(null) }
    var deliveryQty by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    var deliveryNotes by remember { mutableStateOf("") }
    var deliveryError by remember { mutableStateOf<String?>(null) }

    var refundData by remember { mutableStateOf<RefundForSaleData?>(null) }
    var refundQty by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    var refundReason by remember { mutableStateOf("") }
    var refundMethod by remember { mutableStateOf("cash") }
    var refundError by remember { mutableStateOf<String?>(null) }

    var voidSale by remember { mutableStateOf<Sale?>(null) }
    var voidReason by remember { mutableStateOf("") }
    var voidError by remember { mutableStateOf<String?>(null) }

    var addPaymentSale by remember { mutableStateOf<Sale?>(null) }
    var addPaymentAmount by remember { mutableStateOf("") }
    var addPaymentMethod by remember { mutableStateOf("cash") }
    var addPaymentNotes by remember { mutableStateOf("") }
    var addPaymentError by remember { mutableStateOf<String?>(null) }

    var cancelItemTarget by remember { mutableStateOf<Pair<Sale, SaleItem>?>(null) }
    var cancelItemQty by remember { mutableStateOf("") }
    var cancelItemReason by remember { mutableStateOf("") }
    var cancelItemError by remember { mutableStateOf<String?>(null) }

    BackHandler(
        enabled =
            detailsSale != null &&
                addPaymentSale == null &&
                cancelItemTarget == null &&
                voidSale == null &&
                deliveryData == null &&
                refundData == null,
    ) {
        detailsSale = null
    }

    LaunchedEffect(detailsSale != null) {
        onFullscreenModeChange(detailsSale != null)
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val filtered =
        remember(sales, searchQuery) {
            val q = searchQuery.trim()
            sales.filter { sale ->
                if (q.isBlank()) {
                    true
                } else {
                    sale.saleNumber.contains(q, ignoreCase = true) ||
                        sale.items.any { item ->
                            item.productVariant.product?.name.orEmpty().contains(q, ignoreCase = true) ||
                                item.productVariant.description.orEmpty().contains(q, ignoreCase = true)
                        }
                }
            }
        }
    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleSales =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }

    val grouped = remember(visibleSales) { visibleSales.groupBy { extractDatePart(it.createdAt) } }

    Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding =
                androidx.compose.foundation.layout.PaddingValues(
                    start = 12.dp,
                    end = 12.dp,
                    top = 10.dp,
                    bottom = 96.dp,
                ),
        ) {
            grouped.forEach { (dateKey, dateSales) ->
                stickyHeader(key = dateKey) {
                    Box(
                        modifier = Modifier.fillMaxWidth().background(AppBackground).padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = formatDateHeader(dateKey),
                            color = TextCharcoal,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }

                items(dateSales, key = { it.id }) { sale ->
                    SaleCard(
                        sale = sale,
                        canManageAdminActions = canManageAdminActions,
                        expanded = expandedIds.contains(sale.id),
                        isActionLoading = isActionLoading,
                        onToggleExpand = { onToggleExpand(sale.id) },
                        onView = {
                            detailsSale = sale
                            onFetchSaleDetails(sale.id) { details ->
                                detailsSale = details
                            }
                        },
                        onPrint = { onPrintReceipt(sale.id) },
                        onDeliver = {
                            onOpenDeliveryCart(sale.id)
                        },
                        onRefund = {
                            refundData = null
                            refundQty = emptyMap()
                            refundReason = ""
                            refundMethod = "cash"
                            refundError = null
                            onFetchRefundDetails(sale.id) { data ->
                                refundData = data
                                refundQty = data.refundableItems.associate { it.saleItem.id to "" }
                            }
                        },
                        onVoid = {
                            voidSale = sale
                            voidReason = ""
                            voidError = null
                        },
                    )
                }
            }
            if (incrementalState.visibleCount < filtered.size) {
                item("load-more-sales") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading more sales...",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
    }

    detailsSale?.let { sale ->
        SaleDetailsFullScreen(
            sale = sale,
            canManageAdminActions = canManageAdminActions,
            isActionLoading = isActionLoading,
            onDismiss = { detailsSale = null },
            onRequestAddPayment = {
                val summary = computeSalePaymentSummary(it)
                addPaymentSale = it
                addPaymentAmount = if (summary.balance > 0.0) String.format(Locale.US, "%.2f", summary.balance) else ""
                addPaymentMethod = "cash"
                addPaymentNotes = ""
                addPaymentError = null
            },
            onRequestCancelItem = { saleForCancel, item ->
                cancelItemTarget = saleForCancel to item
                val deliveredQty = deliveredQtyForItem(saleForCancel, item)
                val maxCancelable = (item.quantity - deliveredQty - (item.canceledQuantity ?: 0.0)).coerceAtLeast(0.0)
                cancelItemQty = String.format(Locale.US, "%.2f", maxCancelable)
                cancelItemReason = ""
                cancelItemError = null
            },
        )
    }

    addPaymentSale?.let { sale ->
        val paymentSummary = remember(sale) { computeSalePaymentSummary(sale) }
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = {
                if (!isActionLoading) {
                    addPaymentSale = null
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
                            text = "Add Payment",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = sale.saleNumber,
                            color = Color(0xFF374151),
                            fontSize = 13.sp,
                        )
                        Text(
                            text = "Balance: ${formatPeso(paymentSummary.balance)}",
                            color = if (paymentSummary.balance > 0.0) Color(0xFFB45309) else Color(0xFF059669),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        OutlinedTextField(
                            value = addPaymentAmount,
                            onValueChange = { addPaymentAmount = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("Amount") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            enabled = !isActionLoading,
                        )
                        Text(
                            text = "Payment Method",
                            color = TextCharcoal,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            PaymentMethodChoiceChip(
                                label = "Cash",
                                selected = addPaymentMethod == "cash",
                                onClick = { addPaymentMethod = "cash" },
                            )
                            PaymentMethodChoiceChip(
                                label = "GCash",
                                selected = addPaymentMethod == "gcash",
                                onClick = { addPaymentMethod = "gcash" },
                            )
                            PaymentMethodChoiceChip(
                                label = "Cheque",
                                selected = addPaymentMethod == "cheque",
                                onClick = { addPaymentMethod = "cheque" },
                            )
                            PaymentMethodChoiceChip(
                                label = "Credit",
                                selected = addPaymentMethod == "credit",
                                onClick = { addPaymentMethod = "credit" },
                            )
                        }
                        OutlinedTextField(
                            value = addPaymentNotes,
                            onValueChange = { addPaymentNotes = it },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            label = { Text("Notes (Optional)") },
                            enabled = !isActionLoading,
                        )
                        addPaymentError?.let {
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
                ) {
                    TextButton(
                        enabled = !isActionLoading,
                        onClick = { addPaymentSale = null },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Cancel", color = Color(0xFF6B7280))
                    }
                    Button(
                        onClick = {
                            addPaymentError = null
                            val amount = addPaymentAmount.trim().toDoubleOrNull()
                            if (amount == null || amount <= 0.0) {
                                addPaymentError = "Enter a valid amount greater than 0."
                                return@Button
                            }
                            onAddPayment(sale.id, amount, addPaymentMethod, addPaymentNotes.trim()) {
                                onFetchSaleDetails(sale.id) { details ->
                                    detailsSale = details
                                }
                                addPaymentSale = null
                                addPaymentAmount = ""
                                addPaymentNotes = ""
                                addPaymentError = null
                            }
                        },
                        enabled = !isActionLoading,
                        modifier = Modifier.weight(1f),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF059669),
                                contentColor = BaseWhite,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text(text = if (isActionLoading) "Saving..." else "Add Payment")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }

    cancelItemTarget?.let { (sale, item) ->
        val totalQty = item.quantity
        val deliveredQty = deliveredQtyForItem(sale, item)
        val canceledQty = item.canceledQuantity ?: 0.0
        val maxCancelable = (totalQty - deliveredQty - canceledQty).coerceAtLeast(0.0)
        val enteredCancelQty = cancelItemQty.trim().toDoubleOrNull() ?: maxCancelable
        val effectiveCancelQty = enteredCancelQty.coerceIn(0.0, maxCancelable)
        val lineTotal = if (item.lineTotal > 0.0) item.lineTotal else (item.unitPrice * item.quantity)
        val canceledAmount = if (totalQty > 0.0) (effectiveCancelQty / totalQty) * lineTotal else 0.0
        val paymentSummary = computeSalePaymentSummary(sale)
        val newSaleTotal = (sale.total - canceledAmount).coerceAtLeast(0.0)
        val newBalance = (newSaleTotal - paymentSummary.totalPaid).coerceAtLeast(0.0)
        val newChange = (paymentSummary.totalPaid - newSaleTotal).coerceAtLeast(0.0)

        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = {
                if (!isActionLoading) {
                    cancelItemTarget = null
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
                            text = "Cancel Sale Item",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = sale.saleNumber,
                            color = Color(0xFF374151),
                            fontSize = 13.sp,
                        )
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFF9FAFB), RoundedCornerShape(10.dp))
                                    .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                SaleDetailsRow(
                                    label = "Product",
                                    value = item.productVariant.product?.name ?: "-",
                                )
                                SaleDetailsRow(
                                    label = "Variant",
                                    value = item.productVariant.description ?: "-",
                                )
                                SaleDetailsRow(
                                    label = "Total Qty",
                                    value = formatQty(totalQty),
                                )
                                SaleDetailsRow(
                                    label = "Delivered",
                                    value = formatQty(deliveredQty),
                                )
                                SaleDetailsRow(
                                    label = "Already Canceled",
                                    value = formatQty(canceledQty),
                                    valueColor = Color(0xFFDC2626),
                                )
                                SaleDetailsRow(
                                    label = "Available to Cancel",
                                    value = formatQty(maxCancelable),
                                    valueColor = Color(0xFF059669),
                                )
                            }
                        }
                        Text(
                            text = "Quantity to Cancel",
                            color = TextCharcoal,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        OutlinedTextField(
                            value = cancelItemQty,
                            onValueChange = { cancelItemQty = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("Quantity") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            enabled = !isActionLoading,
                        )
                        Text(
                            text = "Maximum: ${formatQty(maxCancelable)}",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFF9FAFB), RoundedCornerShape(10.dp))
                                    .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                SaleDetailsRow(
                                    label = "Amount to Remove",
                                    value = formatPeso(canceledAmount),
                                    valueColor = Color(0xFFDC2626),
                                )
                                SaleDetailsRow(
                                    label = "Current Sale Total",
                                    value = formatPeso(sale.total),
                                )
                                SaleDetailsRow(
                                    label = "New Sale Total",
                                    value = formatPeso(newSaleTotal),
                                    valueColor = Color(0xFF059669),
                                )
                                SaleDetailsRow(
                                    label = "Current Balance",
                                    value = formatPeso(paymentSummary.balance),
                                )
                                SaleDetailsRow(
                                    label = "New Balance",
                                    value = formatPeso(newBalance),
                                )
                                if (newChange > 0.0) {
                                    SaleDetailsRow(
                                        label = "Change to Return",
                                        value = formatPeso(newChange),
                                        valueColor = PrimaryBlue,
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = cancelItemReason,
                            onValueChange = { cancelItemReason = it },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            label = { Text("Reason (Optional)") },
                            enabled = !isActionLoading,
                        )
                        cancelItemError?.let {
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
                ) {
                    TextButton(
                        enabled = !isActionLoading,
                        onClick = {
                            cancelItemTarget = null
                            cancelItemQty = ""
                            cancelItemReason = ""
                            cancelItemError = null
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Cancel", color = Color(0xFF6B7280))
                    }
                    Button(
                        onClick = {
                            cancelItemError = null
                            val quantityToCancel = cancelItemQty.trim().toDoubleOrNull()
                            if (quantityToCancel == null || quantityToCancel <= 0.0) {
                                cancelItemError = "Enter a valid quantity to cancel."
                                return@Button
                            }
                            if (quantityToCancel > maxCancelable) {
                                cancelItemError = "Quantity exceeds maximum cancelable amount."
                                return@Button
                            }
                            onCancelSaleItem(sale.id, item.id, quantityToCancel, cancelItemReason.trim()) {
                                onFetchSaleDetails(sale.id) { details ->
                                    detailsSale = details
                                }
                                cancelItemTarget = null
                                cancelItemQty = ""
                                cancelItemReason = ""
                                cancelItemError = null
                            }
                        },
                        enabled = !isActionLoading,
                        modifier = Modifier.weight(1f),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFDC2626),
                                contentColor = BaseWhite,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text(text = if (isActionLoading) "Cancelling..." else "Confirm")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }

    deliveryData?.let { data ->
        DeliverySheet(
            data = data,
            qtyInputs = deliveryQty,
            notes = deliveryNotes,
            error = deliveryError,
            isActionLoading = isActionLoading,
            onQtyChange = { saleItemId, value ->
                deliveryQty = deliveryQty + (saleItemId to value)
            },
            onNotesChange = { deliveryNotes = it },
            onDismiss = {
                deliveryData = null
                deliveryQty = emptyMap()
                deliveryNotes = ""
                deliveryError = null
            },
            onSubmit = {
                deliveryError = null
                val payload = mutableListOf<SaleItemQuantityRequest>()
                data.deliverableItems.forEach { deliverable ->
                    val maxQty = floor(deliverable.deliverableQuantity).toInt().coerceAtLeast(0)
                    val qty = deliveryQty[deliverable.saleItem.id].orEmpty().trim().toIntOrNull() ?: 0
                    if (qty > 0) {
                        if (qty > maxQty) {
                            deliveryError = "Some quantity values exceed remaining deliverable amount."
                            return@DeliverySheet
                        }
                        payload.add(SaleItemQuantityRequest(deliverable.saleItem.id, qty.toDouble()))
                    }
                }
                if (payload.isEmpty()) {
                    deliveryError = "Enter at least one quantity to deliver."
                    return@DeliverySheet
                }

                onSubmitDelivery(data.sale.id, payload, deliveryNotes.trim()) {
                    deliveryData = null
                    deliveryQty = emptyMap()
                    deliveryNotes = ""
                    deliveryError = null
                }
            },
        )
    }

    refundData?.let { data ->
        RefundSheet(
            data = data,
            qtyInputs = refundQty,
            reason = refundReason,
            method = refundMethod,
            error = refundError,
            isActionLoading = isActionLoading,
            onQtyChange = { saleItemId, value ->
                refundQty = refundQty + (saleItemId to value)
            },
            onReasonChange = { refundReason = it },
            onMethodChange = { refundMethod = it },
            onDismiss = {
                refundData = null
                refundQty = emptyMap()
                refundReason = ""
                refundMethod = "cash"
                refundError = null
            },
            onSubmit = {
                refundError = null
                if (refundReason.trim().isBlank()) {
                    refundError = "Refund reason is required."
                    return@RefundSheet
                }
                val payload = mutableListOf<RefundItemRequest>()
                data.refundableItems.forEach { refundable ->
                    val maxQty = floor(refundable.refundableQuantity).toInt().coerceAtLeast(0)
                    val qty = refundQty[refundable.saleItem.id].orEmpty().trim().toIntOrNull() ?: 0
                    if (qty > 0) {
                        if (qty > maxQty) {
                            refundError = "Some quantity values exceed remaining refundable amount."
                            return@RefundSheet
                        }
                        payload.add(RefundItemRequest(refundable.saleItem.id, qty))
                    }
                }
                if (payload.isEmpty()) {
                    refundError = "Enter at least one quantity to refund."
                    return@RefundSheet
                }

                onSubmitRefund(data.sale.id, payload, refundReason.trim(), refundMethod) {
                    refundData = null
                    refundQty = emptyMap()
                    refundReason = ""
                    refundMethod = "cash"
                    refundError = null
                }
            },
        )
    }

    voidSale?.let { sale ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = {
                if (!isActionLoading) {
                    voidSale = null
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
                            text = "Void Sale",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = sale.saleNumber,
                            color = Color(0xFF374151),
                            fontSize = 13.sp,
                        )
                        OutlinedTextField(
                            value = voidReason,
                            onValueChange = { voidReason = it },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            label = { Text("Reason") },
                            enabled = !isActionLoading,
                        )
                        voidError?.let {
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
                ) {
                    TextButton(
                        enabled = !isActionLoading,
                        onClick = { voidSale = null },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Cancel", color = Color(0xFF6B7280))
                    }
                    Button(
                        onClick = {
                            voidError = null
                            if (voidReason.trim().isBlank()) {
                                voidError = "Void reason is required."
                                return@Button
                            }
                            onVoidSale(sale.id, voidReason.trim()) {
                                voidSale = null
                                voidReason = ""
                                voidError = null
                            }
                        },
                        enabled = !isActionLoading,
                        modifier = Modifier.weight(1f),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFDC2626),
                                contentColor = BaseWhite,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text(text = if (isActionLoading) "Voiding..." else "Confirm")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun SaleCard(
    sale: Sale,
    canManageAdminActions: Boolean,
    expanded: Boolean,
    isActionLoading: Boolean,
    onToggleExpand: () -> Unit,
    onView: () -> Unit,
    onPrint: () -> Unit,
    onDeliver: () -> Unit,
    onRefund: () -> Unit,
    onVoid: () -> Unit,
) {
    val firstItem = sale.items.firstOrNull()
    val visibleItems = if (expanded) sale.items else listOfNotNull(firstItem)
    val hasMoreItems = sale.items.size > 1
    val totalItems = sale.items.size
    val paymentSummary = remember(sale) { computeSalePaymentSummary(sale) }
    val amountDisplay = remember(sale, paymentSummary) { computeSaleAmountDisplay(sale, paymentSummary) }
    val actions =
        buildList {
            add(
                ActionItem(
                    key = "view",
                    label = "View",
                    tint = TextCharcoal,
                    icon = Icons.Outlined.Visibility,
                    onClick = onView,
                ),
            )
            if (canPrint(sale)) {
                add(
                    ActionItem(
                        key = "print",
                        label = "Print",
                        tint = SafetyOrange,
                        icon = Icons.Outlined.Print,
                        onClick = onPrint,
                    ),
                )
            }
            if (canAddDelivery(sale)) {
                add(
                    ActionItem(
                        key = "deliver",
                        label = "Deliver",
                        tint = PrimaryBlue,
                        icon = Icons.Outlined.LocalShipping,
                        onClick = onDeliver,
                    ),
                )
            }
            if (canManageAdminActions && canRefund(sale)) {
                add(
                    ActionItem(
                        key = "refund",
                        label = "Refund",
                        tint = Color(0xFFBE185D),
                        icon = Icons.Outlined.Refresh,
                        onClick = onRefund,
                    ),
                )
            }
            if (canManageAdminActions && canVoid(sale)) {
                add(
                    ActionItem(
                        key = "void",
                        label = "Void",
                        tint = Color(0xFFDC2626),
                        icon = Icons.Outlined.RemoveCircleOutline,
                        onClick = onVoid,
                    ),
                )
            }
        }

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
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = sale.saleNumber,
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CopyActionButton(
                        value = sale.saleNumber,
                        copiedMessage = "Sale reference copied",
                    )
                }
                Text(
                    text = statusLabel(sale.status),
                    color = saleStatusColor(sale.status),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            visibleItems.forEachIndexed { index, item ->
                SaleItemRow(item = item)
                if (index < visibleItems.lastIndex) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = BorderSoft)
                }
            }

            if (hasMoreItems) {
                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.clickable { onToggleExpand() },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = if (expanded) "View Less" else "View More",
                        color = TextCharcoal,
                        fontSize = 16.sp,
                    )
                    Icon(
                        imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = null,
                        tint = TextCharcoal,
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(top = 8.dp, bottom = 8.dp), color = BorderSoft)
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = formatTimeLabel(sale.createdAt),
                    color = TextCharcoal,
                    fontSize = 13.sp,
                )
                Spacer(modifier = Modifier.weight(1f))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        text = "Total $totalItems item${if (totalItems == 1) "" else "s"}:",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    Column(horizontalAlignment = Alignment.End) {
                        if (amountDisplay.showAdjusted) {
                            Text(
                                text = formatPeso(amountDisplay.originalTotal),
                                color = Color(0xFF6B7280),
                                fontSize = 14.sp,
                                textDecoration = TextDecoration.LineThrough,
                            )
                            Text(
                                text = formatPeso(amountDisplay.adjustedTotal),
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                        } else {
                            Text(
                                text = formatPeso(amountDisplay.originalTotal),
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                        }
                    }
                }
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

@Composable
private fun SaleItemRow(
    item: SaleItem,
    showAdjustmentBreakdown: Boolean = false,
    showPartialAdjustedBadge: Boolean = false,
) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, item.productVariant.product?.image)
    val lineTotal = if (item.lineTotal > 0.0) item.lineTotal else (item.unitPrice * item.quantity)
    val canceledQty = (item.canceledQuantity ?: 0.0).coerceAtLeast(0.0)
    val itemStatus = item.itemStatus.orEmpty().uppercase()
    val isCanceled = itemStatus == "CANCELED"
    val isPartiallyAdjusted = itemStatus == "PARTIAL_ADJUSTED"
    val statusLabel =
        when {
            isCanceled -> "Canceled"
            isPartiallyAdjusted && showPartialAdjustedBadge -> "Partial Adjusted"
            else -> null
        }
    val statusColor =
        when {
            isCanceled -> Color(0xFFDC2626)
            isPartiallyAdjusted -> Color(0xFFB45309)
            else -> Color(0xFF6B7280)
        }
    val statusBg =
        when {
            isCanceled -> Color(0xFFFEE2E2)
            isPartiallyAdjusted -> Color(0xFFFFEDD5)
            else -> Color(0xFFE5E7EB)
        }

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .background(Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
        ) {
            if (imageUrl != null) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = item.productVariant.product?.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.productVariant.product?.name ?: "-",
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.productVariant.description ?: "-",
                color = Color(0xFF374151),
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "Unit Price: ${formatPeso(item.unitPrice)}",
                color = Color(0xFF374151),
                fontSize = 12.sp,
            )
            statusLabel?.let { label ->
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier =
                        Modifier
                            .background(statusBg, RoundedCornerShape(999.dp))
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text(
                        text = label,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            if (canceledQty > 0.0) {
                Spacer(modifier = Modifier.height(3.dp))
                if (showAdjustmentBreakdown) {
                    val effectiveCanceledQty = canceledQty.coerceAtMost(item.quantity)
                    val deductedAmount = canceledDeductionForItem(item)
                    val finalQty = (item.quantity - effectiveCanceledQty).coerceAtLeast(0.0)
                    val finalTotal = (lineTotal - deductedAmount).coerceAtLeast(0.0)

                    Text(
                        text = "Canceled: x${formatQty(effectiveCanceledQty)}",
                        color = Color(0xFFDC2626),
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                    Text(
                        text = "Deducted: ${formatPeso(deductedAmount)}",
                        color = Color(0xFFDC2626),
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                    Text(
                        text = "Final Qty: x${formatQty(finalQty)}",
                        color = Color(0xFF065F46),
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                    Text(
                        text = "Final Total: ${formatPeso(finalTotal)}",
                        color = Color(0xFF065F46),
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                } else {
                    Text(
                        text = "Canceled: x${formatQty(canceledQty)}",
                        color = Color(0xFFDC2626),
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Qty: x${formatQty(item.quantity)}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = formatPeso(lineTotal),
                    color = if (isCanceled) Color(0xFF6B7280) else TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    textDecoration = if (isCanceled) TextDecoration.LineThrough else null,
                )
            }
        }
    }
}

@Composable
private fun SaleDetailsFullScreen(
    sale: Sale,
    canManageAdminActions: Boolean,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onRequestAddPayment: (Sale) -> Unit,
    onRequestCancelItem: (Sale, SaleItem) -> Unit,
) {
    val refunds = remember(sale) { safeSaleRefunds(sale) }
    val payments = remember(sale) { safeSalePayments(sale) }
    val paymentSummary = remember(sale, payments, refunds) { computeSalePaymentSummary(sale, payments, refunds) }
    val hasCancelableItems = remember(sale, canManageAdminActions) { sale.items.any { canCancelSaleItem(sale, it, canManageAdminActions) } }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Back",
                        tint = Color(0xFF6B7280),
                        modifier = Modifier.size(30.dp),
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = sale.saleNumber,
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CopyActionButton(
                        value = sale.saleNumber,
                        copiedMessage = "Sale reference copied",
                    )
                }
            }

            if (canAddPayment(sale)) {
                Button(
                    onClick = { onRequestAddPayment(sale) },
                    enabled = !isActionLoading,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF059669),
                            contentColor = BaseWhite,
                            disabledContainerColor = Color(0xFFE5E7EB),
                            disabledContentColor = Color(0xFF9CA3AF),
                        ),
                ) {
                    Text(
                        text = if (isActionLoading) "Processing..." else "Add Payment",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            SaleDetailsSection(title = "Sale Information") {
                SaleDetailsRow(label = "Sale Number", value = sale.saleNumber)
                SaleDetailsRow(
                    label = "Date & Time",
                    value = "${formatDateHeader(sale.createdAt)} ${formatTimeLabel(sale.createdAt)}",
                )
                SaleDetailsRow(label = "Cashier", value = sale.cashier?.name ?: "-")
                SaleDetailsRow(
                    label = "Sale Status",
                    value = statusLabel(sale.status),
                    valueColor = saleStatusColor(sale.status),
                )
                SaleDetailsRow(
                    label = "Payment Status",
                    value = statusLabel(sale.paymentStatus.orEmpty()),
                    valueColor = paymentStatusColor(sale.paymentStatus),
                )
                if (sale.isForDelivery) {
                    SaleDetailsRow(
                        label = "Delivery Status",
                        value = statusLabel(sale.deliveryStatus.orEmpty().ifBlank { "Pending" }),
                        valueColor = deliveryStatusColor(sale.deliveryStatus),
                    )
                    SaleDetailsRow(
                        label = "To",
                        value = "${sale.deliveryName.orEmpty()} ${sale.deliveryContact.orEmpty()}".trim().ifBlank { "-" },
                    )
                }
                if (!sale.notes.isNullOrBlank()) {
                    SaleDetailsRow(label = "Notes", value = sale.notes)
                }
                if (!sale.voidedAt.isNullOrBlank()) {
                    SaleDetailsRow(
                        label = "Voided",
                        value = "By ${sale.voidedBy?.name ?: "Unknown"} on ${formatDateHeader(sale.voidedAt)} ${formatTimeLabel(sale.voidedAt)}",
                        valueColor = Color(0xFFDC2626),
                    )
                }
                if (!sale.voidReason.isNullOrBlank()) {
                    SaleDetailsRow(label = "Void Reason", value = sale.voidReason, valueColor = Color(0xFFDC2626))
                }
                if (hasCancelableItems) {
                    SaleDetailsRow(
                        label = "Adjustments",
                        value = "Cancelable delivery items available",
                        valueColor = Color(0xFFB45309),
                    )
                }
            }

            SaleDetailsSection(title = "Payment Summary") {
                SaleDetailsRow(label = "Sale Total", value = formatPeso(sale.total))
                if (paymentSummary.totalCanceledDeductions > 0.0) {
                    SaleDetailsRow(
                        label = "Canceled Item Deductions",
                        value = "-${formatPeso(paymentSummary.totalCanceledDeductions)}",
                        valueColor = Color(0xFFDC2626),
                    )
                }
                if (paymentSummary.totalRefunded > 0.0) {
                    SaleDetailsRow(
                        label = "Total Refunded",
                        value = "-${formatPeso(paymentSummary.totalRefunded)}",
                        valueColor = Color(0xFFDC2626),
                    )
                    SaleDetailsRow(label = "Net Total", value = formatPeso(paymentSummary.netTotal))
                }
                SaleDetailsRow(
                    label = "Total Paid",
                    value = formatPeso(paymentSummary.totalPaid),
                    valueColor = if (paymentSummary.totalPaid > 0) Color(0xFF059669) else TextCharcoal,
                )
                if (paymentSummary.balance > 0.0) {
                    SaleDetailsRow(
                        label = "Balance Remaining",
                        value = formatPeso(paymentSummary.balance),
                        valueColor = Color(0xFFB45309),
                    )
                }
                if (paymentSummary.change > 0.0) {
                    SaleDetailsRow(
                        label = "Change",
                        value = formatPeso(paymentSummary.change),
                        valueColor = PrimaryBlue,
                    )
                }
                if (paymentSummary.amountToReturn > 0.0) {
                    SaleDetailsRow(
                        label = "Amount to Return",
                        value = formatPeso(paymentSummary.amountToReturn),
                        valueColor = PrimaryBlue,
                    )
                }
            }

            SaleDetailsSection(title = "Items (${sale.items.size})") {
                val amountDisplay = remember(sale, paymentSummary) { computeSaleAmountDisplay(sale, paymentSummary) }
                sale.items.forEachIndexed { index, item ->
                    SaleItemRow(
                        item = item,
                        showAdjustmentBreakdown = true,
                        showPartialAdjustedBadge = true,
                    )
                    if (canCancelSaleItem(sale, item, canManageAdminActions)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            Button(
                                onClick = { onRequestCancelItem(sale, item) },
                                enabled = !isActionLoading,
                                colors =
                                    ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFFFEE2E2),
                                        contentColor = Color(0xFFDC2626),
                                        disabledContainerColor = Color(0xFFE5E7EB),
                                        disabledContentColor = Color(0xFF9CA3AF),
                                    ),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    text = "Cancel Item",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                    if (index < sale.items.lastIndex) {
                        HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(top = 8.dp), color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Total ${sale.items.size} item${if (sale.items.size == 1) "" else "s"}",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Column(horizontalAlignment = Alignment.End) {
                        if (amountDisplay.showAdjusted) {
                            Text(
                                text = formatPeso(amountDisplay.originalTotal),
                                color = Color(0xFF6B7280),
                                fontSize = 14.sp,
                                textDecoration = TextDecoration.LineThrough,
                            )
                            Text(
                                text = formatPeso(amountDisplay.adjustedTotal),
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                            )
                        } else {
                            Text(
                                text = formatPeso(amountDisplay.originalTotal),
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                            )
                        }
                    }
                }
            }

            if (refunds.isNotEmpty()) {
                SaleDetailsSection(title = "Refunds") {
                    refunds.forEachIndexed { index, refund ->
                        SaleDetailsRow(
                            label = refund.type?.replaceFirstChar { it.uppercaseChar() } ?: "Refund",
                            value = formatPeso(refund.refundAmount),
                            valueColor = Color(0xFFDC2626),
                        )
                        SaleDetailsRow(
                            label = "Processed By",
                            value = refund.processedBy?.name ?: "Unknown",
                        )
                        SaleDetailsRow(
                            label = "Date",
                            value = refund.createdAt?.let { "${formatDateHeader(it)} ${formatTimeLabel(it)}" } ?: "-",
                        )
                        if (!refund.reason.isNullOrBlank()) {
                            SaleDetailsRow(label = "Reason", value = refund.reason)
                        }
                        if (index < refunds.lastIndex) {
                            HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                }
            }

            if (payments.isNotEmpty()) {
                SaleDetailsSection(title = "Payment History") {
                    payments.forEachIndexed { index, payment ->
                        val amount = payment.amount
                        val amountColor = if (amount < 0) Color(0xFFDC2626) else Color(0xFF059669)
                        SaleDetailsRow(
                            label = payment.paymentMethod?.replaceFirstChar { it.uppercaseChar() } ?: "Payment",
                            value = (if (amount < 0) "-" else "+") + formatPeso(kotlin.math.abs(amount)),
                            valueColor = amountColor,
                        )
                        SaleDetailsRow(label = "Received By", value = payment.receivedBy?.name ?: "Unknown")
                        SaleDetailsRow(
                            label = "Date",
                            value = payment.receivedAt?.let { "${formatDateHeader(it)} ${formatTimeLabel(it)}" } ?: "-",
                        )
                        if (!payment.notes.isNullOrBlank()) {
                            SaleDetailsRow(label = "Notes", value = payment.notes)
                        }
                        if (index < payments.lastIndex) {
                            HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SaleDetailsSection(
    title: String,
    content: @Composable () -> Unit,
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
                text = title,
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
            )
            content()
        }
    }
}

@Composable
private fun SaleDetailsRow(
    label: String,
    value: String,
    valueColor: Color = TextCharcoal,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(
            text = label,
            color = Color(0xFF6B7280),
            fontSize = 12.sp,
            modifier = Modifier.weight(1f),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = value,
            color = valueColor,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun PaymentMethodChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(if (selected) Color(0xFFE8EEF9) else Color(0xFFF3F4F6))
                .border(1.dp, if (selected) PrimaryBlue else BorderSoft, RoundedCornerShape(999.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) PrimaryBlue else TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeliverySheet(
    data: DeliveryForSaleData,
    qtyInputs: Map<Int, String>,
    notes: String,
    error: String?,
    isActionLoading: Boolean,
    onQtyChange: (saleItemId: Int, value: String) -> Unit,
    onNotesChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Deliver Items",
                color = TextCharcoal,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
            Text(
                text = data.sale.saleNumber,
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
            if (data.deliverableItems.isEmpty()) {
                Text(
                    text = "No deliverable items remaining.",
                    color = Color(0xFF6B7280),
                    fontSize = 14.sp,
                )
            } else {
                data.deliverableItems.forEach { deliverable ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = deliverable.saleItem.productVariant.product?.name ?: "-",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        )
                        Text(
                            text = deliverable.saleItem.productVariant.description ?: "-",
                            color = Color(0xFF374151),
                            fontSize = 13.sp,
                        )
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Remaining: x${formatQty(deliverable.deliverableQuantity)}",
                                color = Color(0xFF6B7280),
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                value = qtyInputs[deliverable.saleItem.id].orEmpty(),
                                onValueChange = { onQtyChange(deliverable.saleItem.id, it) },
                                modifier = Modifier.width(108.dp),
                                singleLine = true,
                                label = { Text("Qty") },
                                keyboardOptions =
                                    KeyboardOptions(
                                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                                    ),
                            )
                        }
                    }
                    HorizontalDivider(color = BorderSoft)
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = onNotesChange,
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                label = { Text("Notes (Optional)") },
            )
            error?.let {
                Text(
                    text = it,
                    color = Color(0xFFDC2626),
                    fontSize = 12.sp,
                )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(
                    enabled = !isActionLoading,
                    onClick = onDismiss,
                ) {
                    Text("Cancel", color = Color(0xFF6B7280))
                }
                TextButton(
                    enabled = !isActionLoading && data.deliverableItems.isNotEmpty(),
                    onClick = onSubmit,
                ) {
                    Text(
                        text = if (isActionLoading) "Processing..." else "Deliver",
                        color = PrimaryBlue,
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
private fun RefundSheet(
    data: RefundForSaleData,
    qtyInputs: Map<Int, String>,
    reason: String,
    method: String,
    error: String?,
    isActionLoading: Boolean,
    onQtyChange: (saleItemId: Int, value: String) -> Unit,
    onReasonChange: (String) -> Unit,
    onMethodChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 320.dp, max = 640.dp)
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Refund Items",
                color = TextCharcoal,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
            Text(
                text = data.sale.saleNumber,
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
            if (data.refundableItems.isEmpty()) {
                Text(
                    text = "No refundable items available.",
                    color = Color(0xFF6B7280),
                    fontSize = 14.sp,
                )
            } else {
                Column(
                    modifier = Modifier.fillMaxWidth().heightIn(max = 240.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    data.refundableItems.forEach { refundable ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = refundable.saleItem.productVariant.product?.name ?: "-",
                                color = TextCharcoal,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                            )
                            Text(
                                text = refundable.saleItem.productVariant.description ?: "-",
                                color = Color(0xFF374151),
                                fontSize = 13.sp,
                            )
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Refundable: x${formatQty(refundable.refundableQuantity)}",
                                    color = Color(0xFF6B7280),
                                    fontSize = 12.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                OutlinedTextField(
                                    value = qtyInputs[refundable.saleItem.id].orEmpty(),
                                    onValueChange = { onQtyChange(refundable.saleItem.id, it) },
                                    modifier = Modifier.width(108.dp),
                                    singleLine = true,
                                    label = { Text("Qty") },
                                    keyboardOptions =
                                        KeyboardOptions(
                                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                                        ),
                                )
                            }
                        }
                        HorizontalDivider(color = BorderSoft)
                    }
                }
            }

            OutlinedTextField(
                value = reason,
                onValueChange = onReasonChange,
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                label = { Text("Reason") },
            )
            Text(
                text = "Refund Method",
                color = TextCharcoal,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MethodChip(label = "Cash", selected = method == "cash") { onMethodChange("cash") }
                MethodChip(label = "Card", selected = method == "card") { onMethodChange("card") }
                MethodChip(label = "GCash", selected = method == "gcash") { onMethodChange("gcash") }
                MethodChip(label = "Maya", selected = method == "maya") { onMethodChange("maya") }
                MethodChip(label = "Store Credit", selected = method == "store_credit") { onMethodChange("store_credit") }
            }

            error?.let {
                Text(
                    text = it,
                    color = Color(0xFFDC2626),
                    fontSize = 12.sp,
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(
                    enabled = !isActionLoading,
                    onClick = onDismiss,
                ) {
                    Text("Cancel", color = Color(0xFF6B7280))
                }
                TextButton(
                    enabled = !isActionLoading && data.refundableItems.isNotEmpty(),
                    onClick = onSubmit,
                ) {
                    Text(
                        text = if (isActionLoading) "Processing..." else "Refund",
                        color = SafetyOrange,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun MethodChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .background(if (selected) PrimaryBlue else BaseWhite, RoundedCornerShape(8.dp))
                .border(1.dp, if (selected) PrimaryBlue else BorderSoft, RoundedCornerShape(8.dp))
                .clickable { onClick() }
                .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            text = label,
            color = if (selected) BaseWhite else TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

private data class SalePaymentSummary(
    val totalPaid: Double,
    val totalRefunded: Double,
    val netTotal: Double,
    val balance: Double,
    val change: Double,
    val totalCanceledDeductions: Double,
    val amountToReturn: Double,
)

private data class SaleAmountDisplay(
    val originalTotal: Double,
    val adjustedTotal: Double,
    val showAdjusted: Boolean,
)

private fun computeSalePaymentSummary(
    sale: Sale,
    payments: List<SalePayment> = safeSalePayments(sale),
    refunds: List<SaleRefund> = safeSaleRefunds(sale),
): SalePaymentSummary {
    val totalCanceledDeductions = computeTotalCanceledDeductions(sale)
    val totalRefundedFromItems = computeTotalRefundDeductions(sale)
    val totalPaidFromPayments =
        payments
            .filter { it.amount > 0 }
            .sumOf { it.amount }
    val totalRefundedFromPayments =
        payments
            .filter { it.amount < 0 }
            .sumOf { kotlin.math.abs(it.amount) }
    val totalRefundedFromRefunds = refunds.sumOf { it.refundAmount }
    val totalRefunded = maxOf(totalRefundedFromRefunds, totalRefundedFromPayments, totalRefundedFromItems)
    val netTotal = (sale.total - totalRefunded).coerceAtLeast(0.0)
    val totalPaid =
        when {
            totalPaidFromPayments > 0.0 -> totalPaidFromPayments
            sale.paymentStatus.orEmpty().uppercase() == "FULLY_PAID" -> netTotal
            else -> 0.0
        }
    val balance = (netTotal - totalPaid).coerceAtLeast(0.0)
    val totalOverpayment = (totalPaid - netTotal).coerceAtLeast(0.0)
    val baseNetTotal = (netTotal + totalCanceledDeductions).coerceAtLeast(0.0)
    val change = (totalPaid - baseNetTotal).coerceAtLeast(0.0)
    val amountToReturn = (totalOverpayment - change).coerceAtLeast(0.0)
    return SalePaymentSummary(
        totalPaid = totalPaid,
        totalRefunded = totalRefunded,
        netTotal = netTotal,
        balance = balance,
        change = change,
        totalCanceledDeductions = totalCanceledDeductions,
        amountToReturn = amountToReturn,
    )
}

private fun computeSaleAmountDisplay(
    sale: Sale,
    paymentSummary: SalePaymentSummary = computeSalePaymentSummary(sale),
): SaleAmountDisplay {
    val saleStatus = sale.status.uppercase()
    val paymentStatus = sale.paymentStatus.orEmpty().uppercase()
    val forceZero = saleStatus == "VOIDED" || saleStatus == "REFUNDED" || paymentStatus == "REFUNDED"
    val totalRefunded = paymentSummary.totalRefunded.coerceAtLeast(0.0)
    val totalCanceledDeductions = paymentSummary.totalCanceledDeductions.coerceAtLeast(0.0)
    val adjustedTotal =
        if (forceZero) {
            0.0
        } else {
            (sale.total - totalRefunded - totalCanceledDeductions).coerceAtLeast(0.0)
        }
    val showAdjusted =
        forceZero ||
            saleStatus == "PARTIALLY_REFUNDED" ||
            paymentStatus == "PARTIALLY_REFUNDED" ||
            totalRefunded > 0.0 ||
            totalCanceledDeductions > 0.0
    return SaleAmountDisplay(
        originalTotal = sale.total.coerceAtLeast(0.0),
        adjustedTotal = adjustedTotal,
        showAdjusted = showAdjusted,
    )
}

private fun canceledDeductionForItem(item: SaleItem): Double {
    val totalQty = item.quantity
    val canceledQty = (item.canceledQuantity ?: 0.0).coerceAtLeast(0.0)
    if (totalQty <= 0.0 || canceledQty <= 0.0) {
        return 0.0
    }
    val effectiveCanceledQty = canceledQty.coerceAtMost(totalQty)
    val lineTotal = if (item.lineTotal > 0.0) item.lineTotal else (item.unitPrice * totalQty)
    return ((effectiveCanceledQty / totalQty) * lineTotal).coerceAtLeast(0.0)
}

private fun computeTotalCanceledDeductions(sale: Sale): Double = sale.items.sumOf { canceledDeductionForItem(it) }.coerceAtLeast(0.0)

private fun refundedDeductionForItem(item: SaleItem): Double {
    val totalQty = item.quantity
    val refundedQty = (item.refundedQuantity ?: 0.0).coerceAtLeast(0.0)
    if (totalQty <= 0.0 || refundedQty <= 0.0) {
        return 0.0
    }
    val effectiveRefundedQty = refundedQty.coerceAtMost(totalQty)
    val lineTotal = if (item.lineTotal > 0.0) item.lineTotal else (item.unitPrice * totalQty)
    return ((effectiveRefundedQty / totalQty) * lineTotal).coerceAtLeast(0.0)
}

private fun computeTotalRefundDeductions(sale: Sale): Double = sale.items.sumOf { refundedDeductionForItem(it) }.coerceAtLeast(0.0)

@Suppress("UNCHECKED_CAST")
private fun safeSalePayments(sale: Sale): List<SalePayment> = (sale.payments as? List<SalePayment>).orEmpty()

@Suppress("UNCHECKED_CAST")
private fun safeSaleRefunds(sale: Sale): List<SaleRefund> = (sale.refunds as? List<SaleRefund>).orEmpty()

@Suppress("UNCHECKED_CAST")
private fun safeSaleDeliveries(sale: Sale): List<com.hims.nativeapp.data.model.Delivery> =
    (sale.deliveries as? List<com.hims.nativeapp.data.model.Delivery>).orEmpty()

private fun deliveredQtyForItem(
    sale: Sale,
    item: SaleItem,
): Double {
    val deliveredFromField = item.deliveredQuantity ?: 0.0
    val deliveredFromTrips =
        safeSaleDeliveries(sale)
            .flatMap { it.items }
            .filter { deliveryItem -> (deliveryItem.saleItemId ?: deliveryItem.id) == item.id }
            .sumOf { it.quantity }
    return maxOf(deliveredFromField, deliveredFromTrips)
}

private fun deliveryStatusColor(status: String?): Color {
    return when (status.orEmpty().uppercase()) {
        "PENDING" -> Color(0xFFE11D48)
        "PARTIAL" -> Color(0xFFB45309)
        "DELIVERED" -> Color(0xFF059669)
        "RETURNED", "CANCELED" -> Color(0xFF6B7280)
        else -> TextCharcoal
    }
}

private fun canAddPayment(sale: Sale): Boolean {
    val saleStatus = sale.status.uppercase()
    val paymentStatus = sale.paymentStatus.orEmpty().uppercase()
    if (saleStatus == "VOIDED" || saleStatus == "REFUNDED") {
        return false
    }
    if (paymentStatus == "FULLY_PAID" || paymentStatus == "REFUNDED") {
        return false
    }
    return true
}

private fun canCancelSaleItem(
    sale: Sale,
    item: SaleItem,
    canManageAdminActions: Boolean,
): Boolean {
    if (!canManageAdminActions) {
        return false
    }
    val saleStatus = sale.status.uppercase()
    if (saleStatus == "VOIDED" || saleStatus == "REFUNDED" || saleStatus == "PARTIALLY_REFUNDED") {
        return false
    }
    if (!sale.isForDelivery) {
        return false
    }
    if (item.itemStatus.orEmpty().uppercase() == "CANCELED") {
        return false
    }
    val canceledQty = item.canceledQuantity ?: 0.0
    val refundedQty = item.refundedQuantity ?: 0.0
    val remainingQty = item.quantity - canceledQty - refundedQty
    return remainingQty > 0.0
}

private fun canPrint(sale: Sale): Boolean {
    val saleStatus = sale.status.uppercase()
    val paymentStatus = sale.paymentStatus.orEmpty().uppercase()
    return saleStatus != "REFUNDED" && saleStatus != "VOIDED" && paymentStatus != "REFUNDED"
}

private fun canRefund(sale: Sale): Boolean {
    val saleStatus = sale.status.uppercase()
    val paymentStatus = sale.paymentStatus.orEmpty().uppercase()
    if (saleStatus == "VOIDED" || saleStatus == "REFUNDED") {
        return false
    }
    if (paymentStatus == "REFUNDED") {
        return false
    }
    return paymentStatus == "FULLY_PAID" ||
        paymentStatus == "PAID" ||
        paymentStatus == "PARTIALLY_REFUNDED"
}

private fun canVoid(sale: Sale): Boolean {
    val saleStatus = sale.status.uppercase()
    val paymentStatus = sale.paymentStatus.orEmpty().uppercase()
    val deliveryStatus = sale.deliveryStatus.orEmpty().uppercase()

    if (saleStatus == "VOIDED" || saleStatus == "REFUNDED" || saleStatus == "PARTIALLY_REFUNDED") {
        return false
    }
    if (deliveryStatus == "DELIVERED" || deliveryStatus == "PARTIAL") {
        return false
    }
    if (paymentStatus == "REFUNDED" || paymentStatus == "PARTIALLY_REFUNDED") {
        return false
    }
    return true
}

private fun canAddDelivery(sale: Sale): Boolean {
    if (!sale.isForDelivery) {
        return false
    }
    val saleStatus = sale.status.uppercase()
    val deliveryStatus = sale.deliveryStatus.orEmpty().uppercase()
    if (saleStatus == "VOIDED" || saleStatus == "REFUNDED") {
        return false
    }
    if (deliveryStatus.isBlank()) {
        return false
    }
    if (deliveryStatus == "DELIVERED" || deliveryStatus == "RETURNED" || deliveryStatus == "CANCELED") {
        return false
    }
    if (sale.hasRemainingDelivery != true) {
        return false
    }
    return deliveryStatus == "PENDING" || deliveryStatus == "PARTIAL"
}

private fun statusLabel(status: String): String {
    if (status.isBlank()) {
        return "-"
    }
    return when (status.uppercase()) {
        "PARTIALLY_REFUNDED" -> "Partially Refunded"
        "FULLY_PAID" -> "Fully Paid"
        "PARTIALLY_PAID" -> "Partially Paid"
        else -> status.lowercase().replace('_', ' ').replaceFirstChar { it.uppercaseChar() }
    }
}

private fun saleStatusColor(status: String): Color {
    return when (status.uppercase()) {
        "COMPLETED" -> Color(0xFFEA580C)
        "OPEN" -> PrimaryBlue
        "PARTIAL" -> Color(0xFFB45309)
        "REFUNDED", "PARTIALLY_REFUNDED" -> Color(0xFFBE185D)
        "VOIDED" -> Color(0xFF6B7280)
        else -> TextCharcoal
    }
}

private fun paymentStatusColor(status: String?): Color {
    return when (status.orEmpty().uppercase()) {
        "FULLY_PAID", "PAID" -> Color(0xFF059669)
        "PARTIALLY_PAID" -> Color(0xFFB45309)
        "REFUNDED", "PARTIALLY_REFUNDED" -> Color(0xFFBE185D)
        "REVERSED" -> Color(0xFF6B7280)
        else -> Color(0xFF6B7280)
    }
}

