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
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.CheckCircleOutline
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Scale
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.WeighLandingProduct
import com.hims.nativeapp.data.model.WeighInItem
import com.hims.nativeapp.data.model.WeighInTransaction
import com.hims.nativeapp.ui.components.CopyActionButton
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

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun WeighMenuScreen(
    transactions: List<WeighInTransaction>,
    canManagePrices: Boolean,
    weighPrices: Map<String, Double>,
    weighProducts: Map<String, WeighLandingProduct?>,
    searchQuery: String,
    isActionLoading: Boolean,
    onMarkPaid: (transactionId: Int, pin: String, onSuccess: () -> Unit) -> Unit,
    onUpdatePrice: (prices: Map<String, Double>, onSuccess: () -> Unit) -> Unit,
    onPrint: (transaction: WeighInTransaction) -> Unit,
    openManagePricesRequestKey: Int = 0,
    onConsumeManagePricesRequest: () -> Unit = {},
    onFullscreenModeChange: (Boolean) -> Unit,
) {
    var expandedTransactionId by remember { mutableStateOf<Int?>(null) }
    var detailTransaction by remember { mutableStateOf<WeighInTransaction?>(null) }
    var payTransaction by remember { mutableStateOf<WeighInTransaction?>(null) }
    var showManagePrices by remember { mutableStateOf(false) }

    BackHandler(enabled = detailTransaction != null) { detailTransaction = null }

    LaunchedEffect(detailTransaction != null) {
        onFullscreenModeChange(detailTransaction != null)
    }
    LaunchedEffect(openManagePricesRequestKey, canManagePrices) {
        if (openManagePricesRequestKey > 0 && canManagePrices) {
            showManagePrices = true
            onConsumeManagePricesRequest()
        }
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val filtered =
        remember(transactions, searchQuery) {
            val q = searchQuery.trim()
            transactions
                .filter { tx ->
                    if (q.isBlank()) {
                        true
                    } else {
                        tx.refNum.orEmpty().contains(q, ignoreCase = true) ||
                            tx.supplierName.orEmpty().contains(q, ignoreCase = true) ||
                            tx.weighedBy?.name.orEmpty().contains(q, ignoreCase = true)
                    }
                }.sortedByDescending { it.weighedAt ?: it.createdAt.orEmpty() }
        }
    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleTransactions =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }

    if (detailTransaction != null) {
        WeighDetailsFullScreen(
            transaction = detailTransaction!!,
            weighProducts = weighProducts,
            onDismiss = { detailTransaction = null },
        )
    } else {
        Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
            LazyColumn(
                state = incrementalState.listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (filtered.isEmpty()) {
                    item("weigh-menu-empty") {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "There aren't any weigh-ins yet.",
                                color = Color(0xFF6B7280),
                                fontSize = 14.sp,
                            )
                        }
                    }
                } else {
                    val grouped = visibleTransactions.groupBy { extractDatePart(it.weighedAt ?: it.createdAt.orEmpty()) }
                    grouped.forEach { (dateKey, records) ->
                        stickyHeader(key = "weigh-menu-date-$dateKey") {
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
                        items(records, key = { it.id }) { tx ->
                            WeighMenuCard(
                                transaction = tx,
                                weighProducts = weighProducts,
                                expanded = expandedTransactionId == tx.id,
                                onToggleExpand = {
                                    expandedTransactionId =
                                        if (expandedTransactionId == tx.id) {
                                            null
                                        } else {
                                            tx.id
                                        }
                                },
                                onView = { detailTransaction = tx },
                                onPrint = { onPrint(tx) },
                                onMarkPaid = { payTransaction = tx },
                            )
                        }
                    }
                    if (incrementalState.visibleCount < filtered.size) {
                        item("load-more-weigh-menu") {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "Loading more weigh-ins...",
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

    if (showManagePrices && canManagePrices) {
        ManagePricesSheet(
            prices = weighPrices,
            isActionLoading = isActionLoading,
            onDismiss = { showManagePrices = false },
            onSavePrice = onUpdatePrice,
        )
    }

    payTransaction?.let { tx ->
        PinActionDialog(
            title = "Mark Weigh-In as Paid",
            subtitle = tx.refNum ?: "WIT-${tx.id}",
            isActionLoading = isActionLoading,
            onDismiss = { if (!isActionLoading) payTransaction = null },
            onConfirm = { pin ->
                onMarkPaid(tx.id, pin) {
                    payTransaction = null
                }
            },
        )
    }
}

@Composable
private fun WeighMenuCard(
    transaction: WeighInTransaction,
    weighProducts: Map<String, WeighLandingProduct?>,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onView: () -> Unit,
    onPrint: () -> Unit,
    onMarkPaid: () -> Unit,
) {
    val status = transaction.status.orEmpty().lowercase()
    val statusLabel = if (status == "paid") "Paid" else "Unpaid"
    val statusColor = if (status == "paid") Color(0xFF059669) else Color(0xFFE11D48)
    val firstItem = transaction.weighIns.firstOrNull()
    val visibleItems = if (expanded) transaction.weighIns else listOfNotNull(firstItem)
    val hasMoreItems = transaction.weighIns.size > 1
    val timestamp = transaction.weighedAt ?: transaction.createdAt.orEmpty()

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleExpand),
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
            val refValue = transaction.refNum ?: "WIT-${transaction.id}"
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = refValue,
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CopyActionButton(
                        value = refValue,
                        copiedMessage = "Reference copied",
                    )
                }
                Text(
                    text = statusLabel,
                    color = statusColor,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
            }
            if (!transaction.supplierName.isNullOrBlank()) {
                Text(
                    text = transaction.supplierName,
                    color = Color(0xFF374151),
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                text = "Weighed by: ${transaction.weighedBy?.name ?: "-"}",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
            )
            Spacer(modifier = Modifier.height(8.dp))

            visibleItems.forEachIndexed { index, item ->
                WeighItemRow(
                    item = item,
                    product = resolveWeighProduct(weighProducts, item.type.orEmpty()),
                )
                if (index < visibleItems.lastIndex) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = BorderSoft)
                }
            }

            if (hasMoreItems) {
                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.clickable(onClick = onToggleExpand),
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
                    text = formatTimeLabel(timestamp),
                    color = TextCharcoal,
                    fontSize = 13.sp,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = formatPeso(transaction.totalAmount),
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                )
            }

            if (expanded) {
                HorizontalDivider(modifier = Modifier.padding(top = 10.dp, bottom = 6.dp), color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    ActionButton(
                        icon = Icons.Outlined.Visibility,
                        label = "View",
                        color = TextCharcoal,
                        onClick = onView,
                    )
                    ActionButtonDivider()
                    ActionButton(
                        icon = Icons.Outlined.Print,
                        label = "Print",
                        color = SafetyOrange,
                        onClick = onPrint,
                    )
                    if (status != "paid") {
                        ActionButtonDivider()
                        ActionButton(
                            icon = Icons.Outlined.CheckCircleOutline,
                            label = "Mark Paid",
                            color = PrimaryBlue,
                            onClick = onMarkPaid,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WeighItemRow(
    item: WeighInItem,
    product: WeighLandingProduct?,
) {
    val typeLabel = prettyWeighType(item.type)
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, product?.image)

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier =
                Modifier
                    .size(50.dp)
                    .background(Color(0xFFE5E7EB), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl != null) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = product?.name ?: typeLabel,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(
                    imageVector = Icons.Outlined.Scale,
                    contentDescription = null,
                    tint = PrimaryBlue,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = product?.name ?: typeLabel,
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            if (!product?.name.isNullOrBlank()) {
                Text(
                    text = typeLabel,
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
            }
            Text(
                text =
                    if (item.type == "coconut") {
                        "Count: ${formatQty(item.count ?: 0.0)}"
                    } else {
                        "Weight: ${formatQty(item.weightKg ?: 0.0)} kg"
                    },
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
        }
        Text(
            text = formatPeso(item.totalAmount),
            color = TextCharcoal,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun WeighDetailsFullScreen(
    transaction: WeighInTransaction,
    weighProducts: Map<String, WeighLandingProduct?>,
    onDismiss: () -> Unit,
) {
    val timestamp = transaction.weighedAt ?: transaction.createdAt.orEmpty()
    BackHandler(onBack = onDismiss)

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
            }

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
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    val refValue = transaction.refNum ?: "WIT-${transaction.id}"
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = refValue,
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            CopyActionButton(
                                value = refValue,
                                copiedMessage = "Reference copied",
                            )
                        }
                    }
                    DetailRow(label = "Supplier", value = transaction.supplierName ?: "-")
                    DetailRow(label = "Status", value = transaction.status?.replaceFirstChar { it.uppercaseChar() } ?: "-")
                    DetailRow(label = "Weighed By", value = transaction.weighedBy?.name ?: "-")
                    DetailRow(label = "Date", value = formatDateHeader(timestamp))
                    DetailRow(label = "Time", value = formatTimeLabel(timestamp))
                    DetailRow(label = "Total Amount", value = formatPeso(transaction.totalAmount))
                }
            }

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
                        text = "Items",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    transaction.weighIns.forEachIndexed { index, item ->
                        WeighItemRow(
                            item = item,
                            product = resolveWeighProduct(weighProducts, item.type.orEmpty()),
                        )
                        if (index < transaction.weighIns.lastIndex) {
                            HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 4.dp))
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PinActionDialog(
    title: String,
    subtitle: String,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var pin by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = {
            if (!isActionLoading) {
                onDismiss()
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
                        text = title,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    Text(
                        text = subtitle,
                        color = TextCharcoal,
                        fontSize = 13.sp,
                    )
                    com.hims.nativeapp.ui.components.PinCodeField(
                        pin = pin,
                        onPinChange = {
                            pin = it
                            localError = null
                        },
                        enabled = !isActionLoading,
                    )
                    localError?.let {
                        Text(text = it, color = Color(0xFFDC2626), fontSize = 12.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
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
                            localError = null
                            if (pin.length != 4) {
                                localError = "PIN must be 4 digits."
                                return@Button
                            }
                            onConfirm(pin)
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
                        Text(text = if (isActionLoading) "Processing..." else "Confirm")
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionButtonDivider() {
    Box(
        modifier =
            Modifier
                .height(34.dp)
                .width(1.dp)
                .background(Color(0xFFE5E7EB)),
    )
}

@Composable
private fun RowScope.ActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier.weight(1f).clickable(onClick = onClick).padding(vertical = 3.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(20.dp),
        )
        Text(
            text = label,
            color = color,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManagePricesSheet(
    prices: Map<String, Double>,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSavePrice: (prices: Map<String, Double>, onSuccess: () -> Unit) -> Unit,
) {
    var cookedInput by remember(prices) { mutableStateOf(formatCompactNumber(prices["cooked_copra"] ?: 0.0)) }
    var uncookedInput by remember(prices) { mutableStateOf(formatCompactNumber(prices["uncooked_copra"] ?: 0.0)) }
    var bagolInput by remember(prices) { mutableStateOf(formatCompactNumber(prices["bagol"] ?: 0.0)) }
    var coconutInput by remember(prices) { mutableStateOf(formatCompactNumber(prices["coconut"] ?: 0.0)) }
    var localError by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        text = "Manage Prices",
                        color = TextCharcoal,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    PriceFieldRow(
                        label = "Cooked Copra (/kg)",
                        value = cookedInput,
                        onValueChange = {
                            cookedInput = it
                            localError = null
                        },
                        enabled = !isActionLoading,
                    )
                    PriceFieldRow(
                        label = "Uncooked Copra (/kg)",
                        value = uncookedInput,
                        onValueChange = {
                            uncookedInput = it
                            localError = null
                        },
                        enabled = !isActionLoading,
                    )
                    PriceFieldRow(
                        label = "Bagol (/kg)",
                        value = bagolInput,
                        onValueChange = {
                            bagolInput = it
                            localError = null
                        },
                        enabled = !isActionLoading,
                    )
                    PriceFieldRow(
                        label = "Coconut (/pc)",
                        value = coconutInput,
                        onValueChange = {
                            coconutInput = it
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

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onDismiss,
                            enabled = !isActionLoading,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors =
                                ButtonDefaults.buttonColors(
                                    containerColor = BaseWhite,
                                    contentColor = TextCharcoal,
                                ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSoft),
                        ) {
                            Text("Cancel")
                        }
                        Button(
                            onClick = {
                                val cooked = cookedInput.toDoubleOrNull()
                                val uncooked = uncookedInput.toDoubleOrNull()
                                val bagol = bagolInput.toDoubleOrNull()
                                val coconut = coconutInput.toDoubleOrNull()
                                if (cooked == null || uncooked == null || bagol == null || coconut == null) {
                                    localError = "All prices must be valid numbers."
                                    return@Button
                                }
                                if (cooked < 0.0 || uncooked < 0.0 || bagol < 0.0 || coconut < 0.0) {
                                    localError = "Prices cannot be negative."
                                    return@Button
                                }

                                onSavePrice(
                                    mapOf(
                                        "cooked_copra" to cooked,
                                        "uncooked_copra" to uncooked,
                                        "bagol" to bagol,
                                        "coconut" to coconut,
                                    ),
                                ) {
                                    onDismiss()
                                }
                            },
                            enabled = !isActionLoading,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors =
                                ButtonDefaults.buttonColors(
                                    containerColor = PrimaryBlue,
                                    contentColor = BaseWhite,
                                ),
                        ) {
                            Text(if (isActionLoading) "Saving..." else "Save")
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun PriceFieldRow(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = label,
            color = TextCharcoal,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = enabled,
            prefix = { Text("\u20B1") },
        )
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
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
            color = TextCharcoal,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

private fun prettyWeighType(type: String?): String {
    return when (type?.lowercase()) {
        "cooked_copra" -> "Cooked Copra"
        "uncooked_copra" -> "Uncooked Copra"
        "coconut" -> "Coconut"
        "bagol" -> "Bagol"
        else -> type.orEmpty().replace('_', ' ').replaceFirstChar { it.uppercaseChar() }
    }
}

private fun resolveWeighProduct(
    weighProducts: Map<String, WeighLandingProduct?>,
    type: String,
): WeighLandingProduct? {
    val normalizedType = canonicalWeighTypeKey(type)
    return weighProducts.entries.firstOrNull { (key, _) ->
        canonicalWeighTypeKey(key) == normalizedType
    }?.value
}

private fun canonicalWeighTypeKey(value: String): String {
    return value
        .trim()
        .lowercase()
        .replace(Regex("[^a-z0-9]"), "")
}
