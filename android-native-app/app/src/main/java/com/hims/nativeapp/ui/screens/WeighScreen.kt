package com.hims.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Scale
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
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
import androidx.compose.ui.graphics.Brush
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
import com.hims.nativeapp.data.model.WeighInTransaction
import com.hims.nativeapp.ui.WeighDraftItem
import com.hims.nativeapp.ui.components.CompactNumberField
import com.hims.nativeapp.ui.components.CopyActionButton
import com.hims.nativeapp.ui.components.PinCodeField
import com.hims.nativeapp.ui.components.formatCompactNumber
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatTimeLabel
import com.hims.nativeapp.util.fullImageUrl

private data class WeighCategory(
    val type: String,
    val label: String,
    val description: String,
    val gradient: List<Color>,
    val unitLabel: String,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeighScreen(
    searchQuery: String,
    weighPrices: Map<String, Double>,
    weighProducts: Map<String, WeighLandingProduct?>,
    unpaidTransactions: List<WeighInTransaction>,
    draftItems: List<WeighDraftItem>,
    isActionLoading: Boolean,
    onAddTypeToDraft: (String) -> Unit,
    onUpdateDraftWeight: (localId: String, weightKg: Double) -> Unit,
    onUpdateDraftCount: (localId: String, count: Int) -> Unit,
    onUpdateDraftUnitPrice: (localId: String, unitPrice: Double?) -> Unit,
    onRemoveDraftItem: (localId: String) -> Unit,
    onClearDraft: () -> Unit,
    onProcessDraft: (pin: String, onSuccess: () -> Unit) -> Unit,
    onMarkPaid: (transactionId: Int, pin: String, onSuccess: () -> Unit) -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit,
) {
    var showUnpaid by remember { mutableStateOf(false) }
    var showCart by remember { mutableStateOf(false) }
    var pinDialogTxId by remember { mutableStateOf<Int?>(null) }
    var pinDialogValue by remember { mutableStateOf("") }
    var pinDialogError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(showCart) {
        onFullscreenModeChange(showCart)
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val categories =
        remember(weighPrices) {
            listOf(
                WeighCategory(
                    type = "cooked_copra",
                    label = "Cooked Copra",
                    description = "Record cooked copra weigh-in",
                    gradient = listOf(Color(0xFFE7E5E4), Color(0xFFD6D3D1)),
                    unitLabel = "/kg",
                ),
                WeighCategory(
                    type = "uncooked_copra",
                    label = "Uncooked Copra",
                    description = "Record uncooked copra weigh-in",
                    gradient = listOf(Color(0xFFE5E7EB), Color(0xFFD1D5DB)),
                    unitLabel = "/kg",
                ),
                WeighCategory(
                    type = "coconut",
                    label = "Coconut",
                    description = "Record coconut count",
                    gradient = listOf(Color(0xFFFDE68A), Color(0xFFF59E0B)),
                    unitLabel = "/pc",
                ),
                WeighCategory(
                    type = "bagol",
                    label = "Bagol",
                    description = "Record bagol weigh-in",
                    gradient = listOf(Color(0xFFD1FAE5), Color(0xFF34D399)),
                    unitLabel = "/kg",
                ),
            )
        }

    val filteredUnpaid =
        remember(unpaidTransactions, searchQuery) {
            val q = searchQuery.trim()
            unpaidTransactions.filter { tx ->
                if (q.isBlank()) {
                    true
                } else {
                    tx.refNum.orEmpty().contains(q, ignoreCase = true) ||
                        tx.supplierName.orEmpty().contains(q, ignoreCase = true)
                }
        }
    }
    val unpaidIncrementalState = rememberIncrementalListState(totalItems = filteredUnpaid.size)
    val visibleUnpaid =
        remember(filteredUnpaid, unpaidIncrementalState.visibleCount) {
            filteredUnpaid.take(unpaidIncrementalState.visibleCount)
        }

    Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SegmentButton(
                    modifier = Modifier.weight(1f),
                    label = "New Weigh-Ins",
                    selected = !showUnpaid,
                    onClick = { showUnpaid = false },
                )
                SegmentButton(
                    modifier = Modifier.weight(1f),
                    label = "Unpaid Weigh-Ins",
                    selected = showUnpaid,
                    onClick = { showUnpaid = true },
                )
            }
            if (!showUnpaid) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 96.dp),
                ) {
                    items(categories, key = { it.type }) { category ->
                        val price = weighPrices[category.type]
                        val product = resolveWeighProduct(weighProducts, category.type)
                        CategoryCard(
                            category = category,
                            product = product,
                            price = price,
                            onClick = { onAddTypeToDraft(category.type) },
                        )
                    }
                }
            } else {
                LazyColumn(
                    state = unpaidIncrementalState.listState,
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 96.dp),
                ) {
                    items(visibleUnpaid, key = { it.id }) { tx ->
                        UnpaidCard(
                            tx = tx,
                            onMarkPaid = {
                                pinDialogTxId = tx.id
                                pinDialogValue = ""
                                pinDialogError = null
                            },
                        )
                    }
                    if (unpaidIncrementalState.visibleCount < filteredUnpaid.size) {
                        item("load-more-unpaid-weigh") {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "Loading more unpaid weigh-ins...",
                                    color = Color(0xFF6B7280),
                                    fontSize = 12.sp,
                                )
                            }
                        }
                    }
                }
            }
        }

        if (!showUnpaid) {
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
                    imageVector = Icons.Outlined.ShoppingCart,
                    contentDescription = "Weigh Cart",
                    tint = BaseWhite,
                    modifier = Modifier.size(28.dp),
                )

                if (draftItems.isNotEmpty()) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.TopEnd)
                                .size(20.dp)
                                .background(SafetyOrange, RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = draftItems.size.toString(),
                            color = BaseWhite,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }

    if (showCart) {
        WeighDraftCartSheet(
            items = draftItems,
            isActionLoading = isActionLoading,
            onDismiss = { showCart = false },
            onUpdateWeight = onUpdateDraftWeight,
            onUpdateCount = onUpdateDraftCount,
            onUpdateUnitPrice = onUpdateDraftUnitPrice,
            onRemoveItem = onRemoveDraftItem,
            onClear = onClearDraft,
            onProcess = onProcessDraft,
        )
    }

    pinDialogTxId?.let { txId ->
        Dialog(
            onDismissRequest = {
                if (!isActionLoading) {
                    pinDialogTxId = null
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
                            text = "Mark as Paid",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "Enter PIN to mark this transaction as paid.",
                            color = TextCharcoal,
                            fontSize = 13.sp,
                        )
                        PinCodeField(
                            pin = pinDialogValue,
                            onPinChange = { pinDialogValue = it },
                            enabled = !isActionLoading,
                        )
                        pinDialogError?.let {
                            Text(text = it, color = Color(0xFFDC2626), fontSize = 12.sp)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        TextButton(
                            enabled = !isActionLoading,
                            onClick = { pinDialogTxId = null },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Cancel", color = Color(0xFF6B7280))
                        }
                        Button(
                            onClick = {
                                pinDialogError = null
                                if (pinDialogValue.length != 4) {
                                    pinDialogError = "PIN must be 4 digits."
                                    return@Button
                                }
                                onMarkPaid(txId, pinDialogValue) {
                                    pinDialogTxId = null
                                    pinDialogValue = ""
                                    pinDialogError = null
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
                            Text(text = if (isActionLoading) "Processing..." else "Mark Paid")
                        }
                    }
                }
            }
        }
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

@Composable
private fun SegmentButton(
    modifier: Modifier = Modifier,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .background(if (selected) PrimaryBlue else BaseWhite, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .clickable(onClick = onClick)
                .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) BaseWhite else TextCharcoal,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun CategoryCard(
    category: WeighCategory,
    product: WeighLandingProduct?,
    price: Double?,
    onClick: () -> Unit,
) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, product?.image)

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .border(1.dp, BorderSoft, RoundedCornerShape(12.dp)),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .background(Brush.verticalGradient(category.gradient)),
                contentAlignment = Alignment.Center,
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = product?.name ?: category.label,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.Image,
                        contentDescription = null,
                        tint = PrimaryBlue,
                        modifier = Modifier.size(46.dp),
                    )
                }
            }
            Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                Text(
                    text = product?.name ?: category.label,
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = category.description,
                    color = Color(0xFF374151),
                    fontSize = 14.sp,
                )
                Spacer(modifier = Modifier.height(10.dp))
                if (price != null && price > 0.0) {
                    Text(
                        text = "${formatPeso(price)}${category.unitLabel}",
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                } else {
                    Text(
                        text = "Price not set",
                        color = Color(0xFFB45309),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun UnpaidCard(
    tx: WeighInTransaction,
    onMarkPaid: () -> Unit,
) {
    val status = tx.status.orEmpty().lowercase()

    Card(
        modifier = Modifier.fillMaxWidth(),
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
                val refValue = tx.refNum ?: "WIT-${tx.id}"
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = refValue,
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CopyActionButton(
                        value = refValue,
                        copiedMessage = "Reference copied",
                    )
                }
                Text(
                    text = if (status == "paid") "Paid" else "Unpaid",
                    color = if (status == "paid") Color(0xFF059669) else Color(0xFFB45309),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }

            Text(
                text = formatDateHeader(tx.weighedAt ?: tx.createdAt.orEmpty()),
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${tx.weighIns.size} item(s)",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPeso(tx.totalAmount),
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }

            if (status != "paid") {
                TextButton(onClick = onMarkPaid) {
                    Icon(
                        imageVector = Icons.Outlined.CreditCard,
                        contentDescription = null,
                        tint = PrimaryBlue,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Mark as Paid", color = PrimaryBlue)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WeighDraftCartSheet(
    items: List<WeighDraftItem>,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onUpdateWeight: (localId: String, weightKg: Double) -> Unit,
    onUpdateCount: (localId: String, count: Int) -> Unit,
    onUpdateUnitPrice: (localId: String, unitPrice: Double?) -> Unit,
    onRemoveItem: (localId: String) -> Unit,
    onClear: () -> Unit,
    onProcess: (pin: String, onSuccess: () -> Unit) -> Unit,
) {
    var pin by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var showPinDialog by remember { mutableStateOf(false) }
    val totalAmount = items.sumOf { it.totalAmount }

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
                    text = "Weigh-Ins Cart",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                if (items.isNotEmpty()) {
                    TextButton(
                        enabled = !isActionLoading,
                        onClick = {
                            onClear()
                            pin = ""
                            localError = null
                            showPinDialog = false
                        },
                    ) {
                        Text("Clear", color = SafetyOrange)
                    }
                }
            }

            if (items.isEmpty()) {
                Text("Your cart is empty.", color = Color(0xFF6B7280))
            } else {
                items.forEachIndexed { index, item ->
                    WeighDraftRow(
                        item = item,
                        isActionLoading = isActionLoading,
                        onUpdateWeight = onUpdateWeight,
                        onUpdateCount = onUpdateCount,
                        onUpdateUnitPrice = onUpdateUnitPrice,
                        onRemove = onRemoveItem,
                    )
                    if (index < items.lastIndex) {
                        HorizontalDivider(color = BorderSoft)
                    }
                }
                HorizontalDivider(color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Total Weigh-Ins",
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = items.size.toString(),
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Total Amount",
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = formatPeso(totalAmount),
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    androidx.compose.material3.Button(
                        onClick = onClear,
                        enabled = !isActionLoading,
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors =
                            androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = BaseWhite,
                                contentColor = TextCharcoal,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSoft),
                    ) {
                        Text(
                            text = "Clear",
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    androidx.compose.material3.Button(
                        onClick = {
                            localError = null
                            showPinDialog = true
                        },
                        enabled = !isActionLoading && items.isNotEmpty(),
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors =
                            androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = PrimaryBlue,
                                contentColor = BaseWhite,
                                disabledContainerColor = Color(0xFFF3F4F6),
                                disabledContentColor = Color(0xFF9CA3AF),
                            ),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Scale,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isActionLoading) "Processing..." else "Process All",
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
                            text = "Enter PIN to Process Weigh-Ins",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "Please enter your PIN to confirm and process all weigh-ins in the cart.",
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
                                pin = ""
                                localError = null
                                showPinDialog = false
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
                                onProcess(pin) {
                                    pin = ""
                                    localError = null
                                    showPinDialog = false
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
                            Text(
                                text = if (isActionLoading) "Processing..." else "Confirm",
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeighDraftRow(
    item: WeighDraftItem,
    isActionLoading: Boolean,
    onUpdateWeight: (localId: String, weightKg: Double) -> Unit,
    onUpdateCount: (localId: String, count: Int) -> Unit,
    onUpdateUnitPrice: (localId: String, unitPrice: Double?) -> Unit,
    onRemove: (localId: String) -> Unit,
) {
    var countInput by remember(item.localId) { mutableStateOf((item.count ?: 1).toString()) }
    LaunchedEffect(item.count) {
        countInput = (item.count ?: 1).toString()
    }
    var weightInput by remember(item.localId) { mutableStateOf(formatCompactNumber(item.weightKg ?: 1.0)) }
    LaunchedEffect(item.weightKg) {
        weightInput = formatCompactNumber(item.weightKg ?: 1.0)
    }
    var unitPriceInput by remember(item.localId) { mutableStateOf(item.customUnitPrice?.let(::formatCompactNumber).orEmpty()) }
    LaunchedEffect(item.customUnitPrice) {
        unitPriceInput = item.customUnitPrice?.let(::formatCompactNumber).orEmpty()
    }

    val title = when (item.type) {
        "cooked_copra" -> "Cooked Copra"
        "uncooked_copra" -> "Uncooked Copra"
        "coconut" -> "Coconut"
        "bagol" -> "Bagol"
        else -> item.type.replace('_', ' ').replaceFirstChar { it.uppercaseChar() }
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
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPeso(item.totalAmount),
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.Outlined.DeleteOutline,
                    contentDescription = "Remove",
                    tint = Color(0xFFDC2626),
                    modifier =
                        Modifier
                            .size(18.dp)
                            .clickable(enabled = !isActionLoading) { onRemove(item.localId) },
                )
            }

            if (item.type == "coconut") {
                Text(
                    text = "Count (pcs)",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    StepperButton(label = "-", enabled = !isActionLoading) {
                        onUpdateCount(item.localId, maxOf(1, (item.count ?: 1) - 1))
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    CompactNumberField(
                        value = countInput,
                        onValueChange = {
                            countInput = it
                            val next = it.toIntOrNull() ?: return@CompactNumberField
                            onUpdateCount(item.localId, maxOf(1, next))
                        },
                        modifier = Modifier.width(62.dp),
                        allowDecimal = false,
                        enabled = !isActionLoading,
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    StepperButton(label = "+", enabled = !isActionLoading) {
                        onUpdateCount(item.localId, (item.count ?: 1) + 1)
                    }
                }
                Text(
                    text = "@ ${formatPeso(item.customUnitPrice ?: item.unitPrice)} /pc",
                    color = Color(0xFF64748B),
                    fontSize = 12.sp,
                )
            } else {
                Text(
                    text = "Weight (kg)",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    StepperButton(label = "-", enabled = !isActionLoading) {
                        val next = maxOf(0.01, (item.weightKg ?: 1.0) - 0.5)
                        onUpdateWeight(item.localId, next)
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    CompactNumberField(
                        value = weightInput,
                        onValueChange = {
                            weightInput = it
                            val next = it.toDoubleOrNull() ?: return@CompactNumberField
                            onUpdateWeight(item.localId, maxOf(0.01, next))
                        },
                        modifier = Modifier.width(62.dp),
                        allowDecimal = true,
                        enabled = !isActionLoading,
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    StepperButton(label = "+", enabled = !isActionLoading) {
                        onUpdateWeight(item.localId, (item.weightKg ?: 1.0) + 0.5)
                    }
                }
                Text(
                    text = "@ ${formatPeso(item.customUnitPrice ?: item.unitPrice)} /kg",
                    color = Color(0xFF64748B),
                    fontSize = 12.sp,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Custom Price",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                    modifier = Modifier.width(96.dp),
                )
                CompactNumberField(
                    value = unitPriceInput,
                    onValueChange = {
                        unitPriceInput = it
                        val parsed = it.toDoubleOrNull()
                        onUpdateUnitPrice(item.localId, parsed)
                    },
                    modifier = Modifier.width(110.dp),
                    allowDecimal = true,
                    enabled = !isActionLoading,
                )
                TextButton(
                    enabled = !isActionLoading,
                    onClick = {
                        unitPriceInput = ""
                        onUpdateUnitPrice(item.localId, null)
                    },
                ) {
                    Text("Reset", color = PrimaryBlue, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun StepperButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    androidx.compose.material3.Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(32.dp),
        shape = RoundedCornerShape(8.dp),
        colors =
            androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = Color(0xFFE8EEF5),
                contentColor = PrimaryBlue,
                disabledContainerColor = Color(0xFFF3F4F6),
                disabledContentColor = Color(0xFF9CA3AF),
            ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
    ) {
        Text(
            text = label,
            color = PrimaryBlue,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
        )
    }
}

