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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.model.ProductVariant
import com.hims.nativeapp.ui.PosCartItem
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
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.fullImageUrl
import java.util.Locale

private data class PosCatalogItem(
    val product: Product,
    val variant: ProductVariant,
)

@Composable
fun PosScreen(
    products: List<Product>,
    searchQuery: String,
    posCategoryFilter: Int?,
    cartItems: List<PosCartItem>,
    isActionLoading: Boolean,
    onAddToCart: (Product, ProductVariant) -> Unit,
    onUpdateCartQuantity: (variantId: Int, delta: Double) -> Unit,
    onSetCartQuantity: (variantId: Int, quantity: Double) -> Unit,
    onSetCartUnitPrice: (variantId: Int, unitPrice: Double?) -> Unit,
    onRemoveCartItem: (variantId: Int) -> Unit,
    onClearCart: () -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit,
    onCheckout: (
        pin: String,
        paymentAmount: Double,
        paymentMethod: String,
        notes: String,
        isForDelivery: Boolean,
        deliveryName: String,
        deliveryAddress: String,
        deliveryContact: String,
        onSuccess: () -> Unit,
    ) -> Unit,
) {
    var showCart by remember { mutableStateOf(false) }

    LaunchedEffect(showCart) {
        onFullscreenModeChange(showCart)
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val filtered =
        remember(products, searchQuery, posCategoryFilter) {
            val q = searchQuery.trim()
            products
                .asSequence()
                .filter { product ->
                    posCategoryFilter == null || product.category?.id == posCategoryFilter
                }
                .flatMap { product ->
                    product.variants.asSequence().map { variant -> PosCatalogItem(product, variant) }
                }
                .filter { item ->
                    if (q.isBlank()) {
                        true
                    } else {
                        item.product.name.contains(q, ignoreCase = true) ||
                            item.product.brand.orEmpty().contains(q, ignoreCase = true) ||
                            item.product.sku.orEmpty().contains(q, ignoreCase = true) ||
                            item.variant.description.orEmpty().contains(q, ignoreCase = true)
                    }
                }
                .sortedWith(
                    compareByDescending<PosCatalogItem> { availableStockForSort(it.variant) }
                        .thenBy { it.product.name.lowercase(Locale.ROOT) }
                        .thenBy { it.variant.description.orEmpty().lowercase(Locale.ROOT) },
                )
                .toList()
        }
    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleItems =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }

    Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding =
                androidx.compose.foundation.layout.PaddingValues(
                    start = 12.dp,
                    end = 12.dp,
                    top = 12.dp,
                    bottom = 96.dp,
                ),
        ) {
            items(visibleItems, key = { "${it.product.id}-${it.variant.id}" }) { item ->
                ProductCard(
                    product = item.product,
                    variant = item.variant,
                    onClick = { onAddToCart(item.product, item.variant) },
                )
            }
            if (incrementalState.visibleCount < filtered.size) {
                item("load-more-products") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading more products...",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                }
            }
            if (filtered.isEmpty()) {
                item("empty") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "No products found.",
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
                imageVector = Icons.Outlined.ShoppingCart,
                contentDescription = "Cart",
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
        PosCartSheet(
            products = products,
            cartItems = cartItems,
            isActionLoading = isActionLoading,
            onDismiss = { showCart = false },
            onUpdateCartQuantity = onUpdateCartQuantity,
            onSetCartQuantity = onSetCartQuantity,
            onSetCartUnitPrice = onSetCartUnitPrice,
            onRemoveCartItem = onRemoveCartItem,
            onClearCart = onClearCart,
            onCheckout = onCheckout,
        )
    }
}

private fun availableStockForSort(variant: ProductVariant): Double {
    val stock = variant.inventory?.quantityOnHand ?: 0.0
    val reserved = (variant.reservedForDelivery ?: 0.0).coerceAtLeast(0.0)
    return (variant.availableQuantity ?: (stock - reserved)).coerceAtLeast(0.0)
}

@Composable
private fun ProductCard(
    product: Product,
    variant: ProductVariant,
    onClick: () -> Unit,
) {
    val price = variant.unitPrice
    val stock = variant.inventory?.quantityOnHand ?: 0.0
    val reservedForDelivery = (variant.reservedForDelivery ?: 0.0).coerceAtLeast(0.0)
    val availableStock = (variant.availableQuantity ?: (stock - reservedForDelivery)).coerceAtLeast(0.0)
    val isOutOfStock = availableStock <= 0.0
    val unit = product.baseUnit?.trim().orEmpty().ifBlank { "unit" }
    val stockText = if (availableStock > 0.0) "${formatQty(availableStock)} $unit available" else "No available stock"
    val stockColor =
        when {
            availableStock <= 0.0 -> Color(0xFFDC2626)
            availableStock <= 5.0 -> Color(0xFFB45309)
            else -> PrimaryBlue
        }

    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !isOutOfStock, onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = if (isOutOfStock) Color(0xFFF3F4F6) else BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .border(1.dp, if (isOutOfStock) Color(0xFFD1D5DB) else BorderSoft, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp)),
        ) {
            val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, product.image)
            if (imageUrl == null) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .background(if (isOutOfStock) Color(0xFFE5E7EB) else Color(0xFFE5E7EB))
                            .alpha(if (isOutOfStock) 0.65f else 1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Image,
                        contentDescription = null,
                        tint = Color(0xFF9CA3AF),
                        modifier = Modifier.size(36.dp),
                    )
                }
            } else {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = product.name,
                    modifier = Modifier.fillMaxWidth().height(220.dp).alpha(if (isOutOfStock) 0.58f else 1f),
                    contentScale = ContentScale.Crop,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = product.name,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = variant.description ?: "-",
                        color = Color(0xFF374151),
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = formatPeso(price),
                            color = TextCharcoal,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                        )
                        Text(
                            text = "/$unit",
                            color = Color(0xFF374151),
                            fontSize = 12.sp,
                        )
                    }
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = stockText,
                        color = stockColor,
                        fontSize = 10.sp,
                    )
                    if (reservedForDelivery > 0.0) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.LocalShipping,
                                contentDescription = null,
                                tint = Color(0xFFB45309),
                                modifier = Modifier.size(10.dp),
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "Delivery: ${formatQty(reservedForDelivery)} $unit",
                                color = Color(0xFFB45309),
                                fontSize = 10.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentMethodChip(
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

private data class CartLinePricing(
    val unitDisplayPrice: Double,
    val lineTotal: Double,
    val baseQty: Double,
    val batchQty: Double,
    val baseUnitPrice: Double,
    val batchUnitPrice: Double?,
)

private fun calculateCartLinePricing(
    item: PosCartItem,
    variant: ProductVariant?,
): CartLinePricing {
    val customUnitPrice = item.customUnitPrice
    if (customUnitPrice != null && customUnitPrice > 0.0) {
        val quantity = item.quantity.coerceAtLeast(0.0)
        val lineTotal = customUnitPrice * quantity
        return CartLinePricing(
            unitDisplayPrice = customUnitPrice,
            lineTotal = lineTotal,
            baseQty = quantity,
            batchQty = 0.0,
            baseUnitPrice = customUnitPrice,
            batchUnitPrice = null,
        )
    }

    val baseUnitPrice = variant?.unitPrice ?: item.unitPrice
    val pendingUnitPrice = variant?.pendingUnitPrice
    val pendingBatchQty = variant?.pendingPriceQuantity
    val quantity = item.quantity.coerceAtLeast(0.0)

    if (
        pendingUnitPrice == null ||
        pendingBatchQty == null ||
        pendingBatchQty <= 0.0
    ) {
        val lineTotal = baseUnitPrice * quantity
        return CartLinePricing(
            unitDisplayPrice = baseUnitPrice,
            lineTotal = lineTotal,
            baseQty = quantity,
            batchQty = 0.0,
            baseUnitPrice = baseUnitPrice,
            batchUnitPrice = null,
        )
    }

    val stock = variant.inventory?.quantityOnHand ?: 0.0
    val reserved = (variant.reservedForDelivery ?: 0.0).coerceAtLeast(0.0)
    val available = (variant.availableQuantity ?: (stock - reserved)).coerceAtLeast(0.0)
    val oldStockRemaining = (available - pendingBatchQty).coerceAtLeast(0.0)
    val baseQty = minOf(quantity, oldStockRemaining)
    val batchQty = (quantity - baseQty).coerceAtLeast(0.0)
    val lineTotal = (baseQty * baseUnitPrice) + (batchQty * pendingUnitPrice)
    val unitDisplayPrice = if (quantity > 0.0) lineTotal / quantity else baseUnitPrice

    return CartLinePricing(
        unitDisplayPrice = unitDisplayPrice,
        lineTotal = lineTotal,
        baseQty = baseQty,
        batchQty = batchQty,
        baseUnitPrice = baseUnitPrice,
        batchUnitPrice = pendingUnitPrice,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PosCartSheet(
    products: List<Product>,
    cartItems: List<PosCartItem>,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onUpdateCartQuantity: (variantId: Int, delta: Double) -> Unit,
    onSetCartQuantity: (variantId: Int, quantity: Double) -> Unit,
    onSetCartUnitPrice: (variantId: Int, unitPrice: Double?) -> Unit,
    onRemoveCartItem: (variantId: Int) -> Unit,
    onClearCart: () -> Unit,
    onCheckout: (
        pin: String,
        paymentAmount: Double,
        paymentMethod: String,
        notes: String,
        isForDelivery: Boolean,
        deliveryName: String,
        deliveryAddress: String,
        deliveryContact: String,
        onSuccess: () -> Unit,
    ) -> Unit,
) {
    var paymentAmountText by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("cash") }
    var notes by remember { mutableStateOf("") }
    var isForDelivery by remember { mutableStateOf(false) }
    var deliveryName by remember { mutableStateOf("") }
    var deliveryAddress by remember { mutableStateOf("") }
    var deliveryContact by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var showPinDialog by remember { mutableStateOf(false) }
    var pinInput by remember { mutableStateOf("") }
    var pinError by remember { mutableStateOf<String?>(null) }

    BackHandler(enabled = !showPinDialog && !isActionLoading) {
        onDismiss()
    }

    val variantById =
        remember(products) {
            products
                .asSequence()
                .flatMap { product -> product.variants.asSequence() }
                .associateBy { variant -> variant.id }
        }
    val cartLinePricings =
        remember(cartItems, variantById) {
            cartItems.associate { item ->
                item.variantId to calculateCartLinePricing(item = item, variant = variantById[item.variantId])
            }
        }
    val subtotal = cartItems.sumOf { item -> cartLinePricings[item.variantId]?.lineTotal ?: (item.unitPrice * item.quantity) }
    val received = paymentAmountText.toDoubleOrNull() ?: 0.0
    val hasReceivedInput = paymentAmountText.isNotBlank()
    val balance = (subtotal - received).coerceAtLeast(0.0)
    val change = (received - subtotal).coerceAtLeast(0.0)
    val hasChange = received > subtotal
    val isPartial = received > 0.0 && received < subtotal
    val isExact = hasReceivedInput && received == subtotal

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
                TextButton(
                    onClick = onDismiss,
                    enabled = !isActionLoading,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Back",
                        tint = Color(0xFF6B7280),
                        modifier = Modifier.size(30.dp),
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "POS Checkout",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                if (cartItems.isNotEmpty()) {
                    TextButton(
                        onClick = {
                            onClearCart()
                            paymentAmountText = ""
                            paymentMethod = "cash"
                            notes = ""
                            isForDelivery = false
                            deliveryName = ""
                            deliveryAddress = ""
                            deliveryContact = ""
                            localError = null
                            pinError = null
                            pinInput = ""
                            showPinDialog = false
                        },
                        enabled = !isActionLoading,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, SafetyOrange),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    ) {
                        Text(text = "Clear", color = SafetyOrange, fontSize = 13.sp)
                    }
                }
            }

            if (cartItems.isEmpty()) {
                Text(
                    text = "No items yet.",
                    color = Color(0xFF6B7280),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            } else {
                cartItems.forEachIndexed { index, item ->
                    var qtyInput by remember(item.variantId) { mutableStateOf(formatCompactNumber(item.quantity)) }
                    var unitPriceInput by remember(item.variantId) { mutableStateOf(item.customUnitPrice?.let(::formatCompactNumber).orEmpty()) }
                    LaunchedEffect(item.quantity) {
                        qtyInput = formatCompactNumber(item.quantity)
                    }
                    LaunchedEffect(item.customUnitPrice) {
                        unitPriceInput = item.customUnitPrice?.let(::formatCompactNumber).orEmpty()
                    }
                    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, item.image)
                    val linePricing =
                        cartLinePricings[item.variantId] ?: CartLinePricing(
                            unitDisplayPrice = item.unitPrice,
                            lineTotal = item.unitPrice * item.quantity,
                            baseQty = item.quantity,
                            batchQty = 0.0,
                            baseUnitPrice = item.unitPrice,
                            batchUnitPrice = null,
                        )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .size(58.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Color(0xFFE5E7EB)),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (imageUrl == null) {
                                    Icon(
                                        imageVector = Icons.Outlined.Image,
                                        contentDescription = null,
                                        tint = Color(0xFF9CA3AF),
                                        modifier = Modifier.size(22.dp),
                                    )
                                } else {
                                    AsyncImage(
                                        model = imageUrl,
                                        contentDescription = item.productName,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop,
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = item.productName,
                                    color = TextCharcoal,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                )
                                Text(
                                    text = item.variantName,
                                    color = Color(0xFF374151),
                                    fontSize = 13.sp,
                                )
                            }
                            Text(
                                text =
                                    if (linePricing.batchQty > 0.0 && linePricing.batchUnitPrice != null) {
                                        "Mixed"
                                    } else {
                                        formatPeso(linePricing.unitDisplayPrice)
                                    },
                                color = TextCharcoal,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            QuantityControlButton(
                                text = "-",
                                enabled = !isActionLoading,
                                onClick = { onUpdateCartQuantity(item.variantId, -0.5) },
                            )
                            CompactNumberField(
                                value = qtyInput,
                                onValueChange = { input ->
                                    qtyInput = input
                                    val parsed = input.toDoubleOrNull()
                                    if (parsed != null) {
                                        onSetCartQuantity(item.variantId, parsed)
                                    }
                                },
                                modifier = Modifier.width(62.dp),
                                allowDecimal = true,
                                enabled = !isActionLoading,
                            )
                            QuantityControlButton(
                                text = "+",
                                enabled = !isActionLoading,
                                onClick = { onUpdateCartQuantity(item.variantId, 0.5) },
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Button(
                                onClick = { onRemoveCartItem(item.variantId) },
                                enabled = !isActionLoading,
                                shape = RoundedCornerShape(8.dp),
                                colors =
                                    ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFFFFE4E6),
                                        contentColor = Color(0xFFDC2626),
                                        disabledContainerColor = Color(0xFFF3F4F6),
                                        disabledContentColor = Color(0xFF9CA3AF),
                                    ),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                            ) {
                                Text(text = "Remove", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
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
                                modifier = Modifier.width(88.dp),
                            )
                            CompactNumberField(
                                value = unitPriceInput,
                                onValueChange = { input ->
                                    unitPriceInput = input
                                    val parsed = input.toDoubleOrNull()
                                    onSetCartUnitPrice(item.variantId, parsed)
                                },
                                modifier = Modifier.width(110.dp),
                                allowDecimal = true,
                                enabled = !isActionLoading,
                            )
                            TextButton(
                                enabled = !isActionLoading,
                                onClick = {
                                    unitPriceInput = ""
                                    onSetCartUnitPrice(item.variantId, null)
                                },
                            ) {
                                Text("Reset", color = PrimaryBlue, fontSize = 12.sp)
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            val unitPriceLabel =
                                if (linePricing.batchQty > 0.0 && linePricing.batchUnitPrice != null) {
                                    "Unit: ${formatPeso(linePricing.baseUnitPrice)} -> ${formatPeso(linePricing.batchUnitPrice)}"
                                } else {
                                    "Unit: ${formatPeso(linePricing.baseUnitPrice)}"
                                }
                            Text(
                                text = unitPriceLabel,
                                color = Color(0xFF6B7280),
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = formatPeso(linePricing.lineTotal),
                                color = TextCharcoal,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                            )
                        }
                        if (linePricing.batchQty > 0.0 && linePricing.batchUnitPrice != null) {
                            val batchMessage =
                                if (linePricing.baseQty > 0.0) {
                                    "Batch pricing applied: ${formatQty(linePricing.baseQty)} at ${formatPeso(linePricing.baseUnitPrice)}, " +
                                        "${formatQty(linePricing.batchQty)} at ${formatPeso(linePricing.batchUnitPrice)}."
                                } else {
                                    "Old stock sold out. ${formatQty(linePricing.batchQty)} priced at ${formatPeso(linePricing.batchUnitPrice)}."
                                }
                            Text(
                                text = batchMessage,
                                color = Color(0xFFB45309),
                                fontSize = 11.sp,
                            )
                        }
                    }

                    if (index < cartItems.lastIndex) {
                        HorizontalDivider(color = BorderSoft)
                    }
                }

                HorizontalDivider(color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Subtotal",
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = formatPeso(subtotal),
                        color = TextCharcoal,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                }

                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Amount Received",
                        color = TextCharcoal,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedButton(
                        onClick = { paymentAmountText = String.format(Locale.US, "%.2f", subtotal) },
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSoft),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text(text = "Exact", color = PrimaryBlue, fontSize = 12.sp)
                    }
                }

                OutlinedTextField(
                    value = paymentAmountText,
                    onValueChange = { paymentAmountText = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Amount Received") },
                    placeholder = { Text("0.00") },
                    keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
                )

                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Balance: ${formatPeso(balance)}",
                        color = if (balance > 0) Color(0xFFB45309) else Color(0xFF374151),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = "Change: ${formatPeso(change)}",
                        color = if (change > 0) Color(0xFF059669) else Color(0xFF374151),
                        fontSize = 13.sp,
                    )
                }

                if (hasReceivedInput) {
                    if (hasChange) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFF0FDF4), RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0xFFBBF7D0), RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Change Due",
                                    color = Color(0xFF166534),
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = formatPeso(change),
                                    color = Color(0xFF14532D),
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                    if (isPartial) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFFEFCE8), RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Partial Payment",
                                        color = Color(0xFF854D0E),
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        text = "Paid: ${formatPeso(received)}",
                                        color = Color(0xFF713F12),
                                        fontSize = 12.sp,
                                    )
                                }
                                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Balance Remaining",
                                        color = Color(0xFFA16207),
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        text = formatPeso(balance),
                                        color = Color(0xFF854D0E),
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                        }
                    }
                    if (isExact) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFEFF6FF), RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Exact Payment",
                                    color = Color(0xFF1D4ED8),
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = "No change needed",
                                    color = Color(0xFF1E3A8A),
                                    fontSize = 12.sp,
                                )
                            }
                        }
                    }
                }

                Text(text = "Payment Method", color = TextCharcoal, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PaymentMethodChip(label = "Cash", selected = paymentMethod == "cash", onClick = { paymentMethod = "cash" })
                    PaymentMethodChip(label = "GCash", selected = paymentMethod == "gcash", onClick = { paymentMethod = "gcash" })
                    PaymentMethodChip(label = "Cheque", selected = paymentMethod == "cheque", onClick = { paymentMethod = "cheque" })
                    PaymentMethodChip(label = "Credit", selected = paymentMethod == "credit", onClick = { paymentMethod = "credit" })
                }

                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "For Delivery",
                        color = TextCharcoal,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = isForDelivery,
                        onCheckedChange = { isForDelivery = it },
                        enabled = !isActionLoading,
                    )
                }

                if (isForDelivery) {
                    OutlinedTextField(
                        value = deliveryName,
                        onValueChange = { deliveryName = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Deliver To") },
                    )
                    OutlinedTextField(
                        value = deliveryAddress,
                        onValueChange = { deliveryAddress = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Delivery Address") },
                    )
                    OutlinedTextField(
                        value = deliveryContact,
                        onValueChange = { deliveryContact = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Contact Number") },
                    )
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    label = { Text("Notes (Optional)") },
                )

                localError?.let {
                    Text(
                        text = it,
                        color = Color(0xFFDC2626),
                        fontSize = 12.sp,
                    )
                }

                Button(
                    onClick = {
                        localError = null
                        pinError = null
                        if (received < 0) {
                            localError = "Payment amount cannot be negative."
                            return@Button
                        }
                        if (isForDelivery) {
                            if (deliveryName.isBlank() || deliveryAddress.isBlank() || deliveryContact.isBlank()) {
                                localError = "Delivery name, address, and contact are required."
                                return@Button
                            }
                        }
                        showPinDialog = true
                    },
                    enabled = !isActionLoading && cartItems.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = SafetyOrange,
                            contentColor = BaseWhite,
                            disabledContainerColor = Color(0xFFF3F4F6),
                            disabledContentColor = Color(0xFF9CA3AF),
                        ),
                ) {
                    Text(
                        text = if (isActionLoading) "Processing..." else "Checkout",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                    )
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
                            text = "Enter PIN",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                        )
                        Text(
                            text = "Please enter your PIN to complete the transaction.",
                            color = TextCharcoal,
                            fontSize = 13.sp,
                        )
                        PinCodeField(
                            pin = pinInput,
                            onPinChange = {
                                pinInput = it
                                pinError = null
                            },
                            enabled = !isActionLoading,
                        )
                        pinError?.let {
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
                                pinInput = ""
                                pinError = null
                            },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Cancel", color = Color(0xFF6B7280))
                        }
                        Button(
                            onClick = {
                                pinError = null
                                if (pinInput.length != 4) {
                                    pinError = "PIN must be 4 digits."
                                    return@Button
                                }
                                onCheckout(
                                    pinInput,
                                    received,
                                    paymentMethod,
                                    notes,
                                    isForDelivery,
                                    deliveryName,
                                    deliveryAddress,
                                    deliveryContact,
                                ) {
                                    showPinDialog = false
                                    pinInput = ""
                                    pinError = null
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
                            Text(text = if (isActionLoading) "Processing..." else "Confirm")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuantityControlButton(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(34.dp),
        shape = RoundedCornerShape(8.dp),
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
            text = text,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PrimaryBlue,
        )
    }
}

