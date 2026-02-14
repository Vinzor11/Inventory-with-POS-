package com.hims.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.RemoveCircleOutline
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.Delivery
import com.hims.nativeapp.data.model.DeliveryItem
import com.hims.nativeapp.ui.DeliveryCartItem
import com.hims.nativeapp.ui.components.CompactNumberField
import com.hims.nativeapp.ui.components.PinCodeField
import com.hims.nativeapp.ui.components.formatCompactNumber
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

@Composable
fun DeliveryScreen(
    deliveries: List<Delivery>,
    searchQuery: String,
    expandedIds: Set<Int>,
    isActionLoading: Boolean,
    onToggleExpand: (Int) -> Unit,
    cartItems: List<DeliveryCartItem>,
    onToggleCart: (Delivery) -> Unit,
    onUpdateCartQuantity: (cartKey: String, delta: Double) -> Unit,
    onSetCartQuantity: (cartKey: String, quantity: Double) -> Unit,
    onRemoveCartItem: (cartKey: String) -> Unit,
    onClearCart: () -> Unit,
    onProcessCart: (pin: String, notes: String, onSuccess: () -> Unit) -> Unit,
    openCartSignal: Int = 0,
    onFullscreenModeChange: (Boolean) -> Unit,
) {
    var showCart by remember { mutableStateOf(false) }

    LaunchedEffect(showCart) {
        onFullscreenModeChange(showCart)
    }
    LaunchedEffect(openCartSignal) {
        if (openCartSignal > 0 && cartItems.isNotEmpty()) {
            showCart = true
        }
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val filtered =
        remember(deliveries, searchQuery) {
            deliveries.filter { delivery ->
                val q = searchQuery.trim()
                if (q.isBlank()) {
                    true
                } else {
                    delivery.sale?.saleNumber.orEmpty().contains(q, ignoreCase = true) ||
                        delivery.sale?.deliveryName.orEmpty().contains(q, ignoreCase = true) ||
                        delivery.items.any { item ->
                            item.productVariant.product?.name.orEmpty().contains(q, ignoreCase = true) ||
                                item.productVariant.description.orEmpty().contains(q, ignoreCase = true)
                        }
                }
            }
        }
    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleDeliveries =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }
    val activeSaleId = cartItems.firstOrNull()?.saleId

    Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding =
                androidx.compose.foundation.layout.PaddingValues(
                    start = 12.dp,
                    end = 12.dp,
                    top = 10.dp,
                    bottom = 96.dp,
                ),
        ) {
            itemsIndexed(visibleDeliveries, key = { _, item -> item.id }) { index, delivery ->
                val created = delivery.sale?.createdAt ?: delivery.createdAt
                val previousDate =
                    visibleDeliveries.getOrNull(index - 1)?.let {
                        extractDatePart(it.sale?.createdAt ?: it.createdAt)
                    }
                val currentDate = extractDatePart(created)
                val showHeader = index == 0 || previousDate != currentDate

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (showHeader) {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = formatDateHeader(created),
                                fontSize = 14.sp,
                                color = TextCharcoal,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }

                    DeliveryCard(
                        delivery = delivery,
                        expanded = expandedIds.contains(delivery.id),
                        selected = cartItems.any { it.deliveryId == delivery.id },
                        disabled = activeSaleId != null && delivery.sale?.id != activeSaleId,
                        onCardClick = { onToggleCart(delivery) },
                        onToggleExpand = { onToggleExpand(delivery.id) },
                    )
                }
            }
            if (incrementalState.visibleCount < filtered.size) {
                item("load-more-deliveries") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading more deliveries...",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            if (filtered.isEmpty()) {
                item("empty-deliveries") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "There aren't any deliveries yet.",
                            color = Color(0xFF6B7280),
                            fontSize = 14.sp,
                        )
                    }
                }
            }
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 20.dp, bottom = 92.dp)
                    .size(54.dp)
                    .background(PrimaryBlue, RoundedCornerShape(27.dp))
                    .clickable { showCart = true },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.LocalShipping,
                contentDescription = "Delivery Cart",
                tint = BaseWhite,
                modifier = Modifier.size(28.dp),
            )

            if (cartItems.isNotEmpty()) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .size(20.dp)
                            .background(SafetyOrange, RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = cartItems.size.toString(),
                        color = BaseWhite,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }

    if (showCart) {
        DeliveryCartSheet(
            cartItems = cartItems,
            isActionLoading = isActionLoading,
            onDismiss = { showCart = false },
            onUpdateCartQuantity = onUpdateCartQuantity,
            onSetCartQuantity = onSetCartQuantity,
            onRemoveCartItem = onRemoveCartItem,
            onClearCart = onClearCart,
            onProcessCart = onProcessCart,
        )
    }
}

@Composable
private fun DeliveryCard(
    delivery: Delivery,
    expanded: Boolean,
    selected: Boolean,
    disabled: Boolean,
    onCardClick: () -> Unit,
    onToggleExpand: () -> Unit,
) {
    val sale = delivery.sale
    val firstItem = delivery.items.firstOrNull()
    val moreItems = delivery.items.drop(1)
    val visibleItems = if (expanded) delivery.items else listOfNotNull(firstItem)
    val totalQty = delivery.items.sumOf { it.remainingQuantity ?: it.quantity }
    val timestamp = sale?.createdAt ?: delivery.createdAt

    Card(
        modifier = Modifier.fillMaxWidth().clickable(enabled = !disabled) { onCardClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        when {
                            selected -> SafetyOrange
                            else -> BorderSoft
                        },
                        RoundedCornerShape(14.dp),
                    )
                    .padding(14.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = sale?.saleNumber ?: "Delivery #${delivery.id}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier.background(Color(0xFFFFF1F2), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = statusText(delivery.status),
                        color = statusColor(delivery.status),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))
            val recipient =
                listOf(
                    sale?.deliveryName,
                    sale?.deliveryAddress,
                    sale?.deliveryContact,
                ).filterNot { it.isNullOrBlank() }.joinToString(" | ")
            Text(
                text = "To: ${recipient.ifBlank { "Walk-in customer" }}",
                color = Color(0xFF1F2937),
                fontSize = 14.sp,
            )
            if (disabled) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Clear cart first to switch sale.",
                    color = Color(0xFFB91C1C),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
            if (!delivery.notes.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        imageVector = Icons.Outlined.Description,
                        contentDescription = null,
                        tint = Color(0xFF6B7280),
                        modifier = Modifier.size(15.dp).padding(top = 1.dp),
                    )
                    Spacer(modifier = Modifier.size(6.dp))
                    Text(
                        text = delivery.notes,
                        color = Color(0xFF374151),
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            visibleItems.forEachIndexed { idx, item ->
                DeliveryItemRow(item)
                if (idx < visibleItems.lastIndex) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = BorderSoft)
                }
            }

            if (moreItems.isNotEmpty()) {
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

            HorizontalDivider(modifier = Modifier.padding(top = 10.dp, bottom = 8.dp), color = BorderSoft)
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = formatTimeLabel(timestamp),
                    color = TextCharcoal,
                    fontSize = 13.sp,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "Remaining: x${formatQty(totalQty)}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                )
            }
        }
    }
}

@Composable
private fun DeliveryItemRow(item: DeliveryItem) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, item.productVariant.product?.image)

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Box(
            modifier =
                Modifier
                    .size(62.dp)
                    .background(Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl != null) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = item.productVariant.product?.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(
                    imageVector = Icons.Outlined.LocalShipping,
                    contentDescription = null,
                    tint = Color(0xFF94A3B8),
                    modifier = Modifier.size(20.dp),
                )
            }
        }
        Spacer(modifier = Modifier.size(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.productVariant.product?.name ?: "-",
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
            )
            Text(
                text = item.productVariant.description ?: "-",
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
        }
        Text(
            text = "Qty: x${formatQty(item.remainingQuantity ?: item.quantity)}",
            color = TextCharcoal,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
        )
    }
}

private fun statusText(status: String): String {
    return status.replaceFirstChar { it.uppercaseChar() }
}

private fun statusColor(status: String): Color {
    return when (status.lowercase()) {
        "pending" -> Color(0xFFE11D48)
        "partial" -> Color(0xFFF59E0B)
        "delivered" -> Color(0xFF059669)
        else -> TextCharcoal
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeliveryCartSheet(
    cartItems: List<DeliveryCartItem>,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onUpdateCartQuantity: (cartKey: String, delta: Double) -> Unit,
    onSetCartQuantity: (cartKey: String, quantity: Double) -> Unit,
    onRemoveCartItem: (cartKey: String) -> Unit,
    onClearCart: () -> Unit,
    onProcessCart: (pin: String, notes: String, onSuccess: () -> Unit) -> Unit,
) {
    var notes by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var showPinDialog by remember { mutableStateOf(false) }
    val totalQuantity = remember(cartItems) { cartItems.sumOf { it.quantity } }
    val totalAmount = remember(cartItems) { cartItems.sumOf { it.unitPrice * it.quantity } }
    val groupedCart = remember(cartItems) { cartItems.groupBy { it.deliveryId } }

    BackHandler(enabled = !isActionLoading) {
        if (showPinDialog) {
            showPinDialog = false
            pin = ""
            localError = null
        } else {
            onDismiss()
        }
    }

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
                TextButton(enabled = !isActionLoading, onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Back",
                        tint = Color(0xFF6B7280),
                        modifier = Modifier.size(30.dp),
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Delivery Cart",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                if (cartItems.isNotEmpty()) {
                    TextButton(enabled = !isActionLoading, onClick = onClearCart) {
                        Text(text = "Clear", color = SafetyOrange)
                    }
                }
            }

            if (cartItems.isEmpty()) {
                Text(
                    text = "Your cart is empty.",
                    color = Color(0xFF6B7280),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            } else {
                groupedCart.forEach { (_, groupItems) ->
                    val saleNumber = groupItems.firstOrNull()?.saleNumber ?: "Sale"
                    Text(
                        text = saleNumber,
                        color = Color(0xFF6B7280),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    groupItems.forEach { item ->
                        DeliveryCartLine(
                            item = item,
                            isActionLoading = isActionLoading,
                            onUpdateCartQuantity = onUpdateCartQuantity,
                            onSetCartQuantity = onSetCartQuantity,
                            onRemoveCartItem = onRemoveCartItem,
                        )
                    }
                }

                HorizontalDivider(color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Total Items",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = formatQty(totalQuantity),
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                }
                if (totalAmount > 0.0) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Estimated Amount",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = formatPeso(totalAmount),
                            color = TextCharcoal,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    label = { Text("Notes (Optional)") },
                    enabled = !isActionLoading,
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = onClearCart,
                        enabled = !isActionLoading,
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = BaseWhite,
                                contentColor = TextCharcoal,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSoft),
                    ) {
                        Text(text = "Clear", fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = {
                            localError = null
                            showPinDialog = true
                        },
                        enabled = !isActionLoading && cartItems.isNotEmpty(),
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = PrimaryBlue,
                                contentColor = BaseWhite,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.LocalShipping,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isActionLoading) "Processing..." else "Process",
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showPinDialog) {
        Dialog(
            onDismissRequest = {
                if (!isActionLoading) {
                    showPinDialog = false
                    pin = ""
                    localError = null
                }
            },
        ) {
            Card(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, BorderSoft, RoundedCornerShape(14.dp)),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BaseWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Confirm Delivery Processing",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "Enter your PIN to process this delivery.",
                            color = TextCharcoal,
                            fontSize = 13.sp,
                        )
                        PinCodeField(
                            pin = pin,
                            onPinChange = {
                                pin = it
                                localError = null
                            },
                            enabled = !isActionLoading,
                        )
                        localError?.let {
                            Text(
                                text = it,
                                color = Color(0xFFDC2626),
                                fontSize = 12.sp,
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        TextButton(
                            enabled = !isActionLoading,
                            onClick = {
                                showPinDialog = false
                                pin = ""
                                localError = null
                            },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Cancel", color = Color(0xFF6B7280))
                        }
                        Button(
                            onClick = {
                                localError = null
                                if (pin.length != 4) {
                                    localError = "PIN must be 4 digits."
                                    return@Button
                                }
                                onProcessCart(pin, notes.trim()) {
                                    showPinDialog = false
                                    pin = ""
                                    localError = null
                                    notes = ""
                                    onDismiss()
                                }
                            },
                            enabled = !isActionLoading,
                            modifier = Modifier.weight(1f),
                            colors =
                                ButtonDefaults.buttonColors(
                                    containerColor = PrimaryBlue,
                                    contentColor = BaseWhite,
                                    disabledContainerColor = Color(0xFFF3F4F6),
                                    disabledContentColor = Color(0xFF9CA3AF),
                                ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text(text = if (isActionLoading) "Processing..." else "Process Delivery")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DeliveryCartLine(
    item: DeliveryCartItem,
    isActionLoading: Boolean,
    onUpdateCartQuantity: (cartKey: String, delta: Double) -> Unit,
    onSetCartQuantity: (cartKey: String, quantity: Double) -> Unit,
    onRemoveCartItem: (cartKey: String) -> Unit,
) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, item.image)
    var qtyInput by remember(item.cartKey) { mutableStateOf(formatCompactNumber(item.quantity)) }
    LaunchedEffect(item.quantity) {
        qtyInput = formatCompactNumber(item.quantity)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                    .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Box(
                    modifier =
                        Modifier
                            .size(54.dp)
                            .background(Color(0xFFE5E7EB), RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = item.productName,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Outlined.LocalShipping,
                            contentDescription = null,
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }

                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.productName,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = item.description,
                        color = Color(0xFF64748B),
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "Remaining: ${formatQty(item.remainingQuantity)}",
                        color = Color(0xFF64748B),
                        fontSize = 12.sp,
                    )
                }

                TextButton(
                    enabled = !isActionLoading,
                    onClick = { onRemoveCartItem(item.cartKey) },
                ) {
                    Icon(
                        imageVector = Icons.Outlined.RemoveCircleOutline,
                        contentDescription = "Remove",
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                QtyButton(
                    label = "-",
                    enabled = !isActionLoading,
                    onClick = { onUpdateCartQuantity(item.cartKey, -1.0) },
                )
                CompactNumberField(
                    value = qtyInput,
                    onValueChange = { input ->
                        qtyInput = input
                        val parsed = input.toDoubleOrNull()
                        if (parsed != null) {
                            onSetCartQuantity(item.cartKey, parsed)
                        }
                    },
                    modifier = Modifier.width(62.dp),
                    allowDecimal = true,
                    enabled = !isActionLoading,
                )
                QtyButton(
                    label = "+",
                    enabled = !isActionLoading && item.quantity < item.remainingQuantity,
                    onClick = { onUpdateCartQuantity(item.cartKey, 1.0) },
                )
                Spacer(modifier = Modifier.weight(1f))
                if (item.unitPrice > 0.0) {
                    Text(
                        text = formatPeso(item.unitPrice),
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun QtyButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(30.dp),
        shape = RoundedCornerShape(7.dp),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = Color(0xFFE8EEF5),
                contentColor = PrimaryBlue,
                disabledContainerColor = Color(0xFFF3F4F6),
                disabledContentColor = Color(0xFF9CA3AF),
            ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
    ) {
        Text(
            text = label,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PrimaryBlue,
        )
    }
}
