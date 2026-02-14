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
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.Delivery
import com.hims.nativeapp.data.model.DeliveryItem
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.util.extractDatePart
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.formatTimeLabel
import com.hims.nativeapp.util.fullImageUrl

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DeliveryMenuScreen(
    deliveries: List<Delivery>,
    allDeliveries: List<Delivery>,
    searchQuery: String,
    expandedIds: Set<Int>,
    onToggleExpand: (Int) -> Unit,
    onFetchDeliveryDetails: (deliveryId: Int, onSuccess: (Delivery) -> Unit) -> Unit,
    onPrintDelivery: (deliveryId: Int) -> Unit,
    onBack: () -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit,
) {
    var detailsDelivery by remember { mutableStateOf<Delivery?>(null) }
    var detailsTrips by remember { mutableStateOf<List<Delivery>>(emptyList()) }

    BackHandler(enabled = detailsDelivery == null, onBack = onBack)
    BackHandler(enabled = detailsDelivery != null) {
        detailsDelivery = null
    }

    LaunchedEffect(detailsDelivery != null) {
        onFullscreenModeChange(detailsDelivery != null)
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    val filtered =
        remember(deliveries, searchQuery) {
            val q = searchQuery.trim()
            deliveries.filter { delivery ->
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
    val menuCards =
        remember(filtered, allDeliveries) {
            buildDeliveryMenuCards(
                deliveries = filtered,
                allDeliveries = allDeliveries,
            )
        }
    val incrementalState = rememberIncrementalListState(totalItems = menuCards.size)
    val visibleMenuCards =
        remember(menuCards, incrementalState.visibleCount) {
            menuCards.take(incrementalState.visibleCount)
        }

    if (detailsDelivery != null) {
        DeliveryDetailsFullScreen(
            delivery = detailsDelivery!!,
            trips = detailsTrips,
            onPrintTrip = onPrintDelivery,
            onDismiss = { detailsDelivery = null },
        )
        return
    }

    Box(modifier = Modifier.fillMaxSize().background(AppBackground)) {
        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
        ) {
            val grouped = visibleMenuCards.groupBy { extractDatePart(it.sale?.createdAt ?: it.createdAt) }
            grouped.forEach { (dateKey, dateDeliveries) ->
                stickyHeader(key = "delivery-menu-date-$dateKey") {
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
                items(dateDeliveries, key = { it.id }) { delivery ->
                    val saleTrips = resolveSaleTrips(delivery = delivery, allDeliveries = allDeliveries)
                    val singleTripPrintId = saleTrips.firstOrNull()?.id ?: delivery.id
                    val showSingleTripPrint =
                        saleTrips.size == 1 &&
                            isCompletedDeliveryStatus(saleTrips.first().status)
                    DeliveryMenuCard(
                        delivery = delivery,
                        expanded = expandedIds.contains(delivery.id),
                        onToggleExpand = { onToggleExpand(delivery.id) },
                        showPrint = showSingleTripPrint,
                        onPrint = { onPrintDelivery(singleTripPrintId) },
                        onView = {
                            onFetchDeliveryDetails(delivery.id) { details ->
                                detailsDelivery = details
                                val saleId = details.sale?.id ?: delivery.sale?.id
                                detailsTrips =
                                    allDeliveries
                                        .filter { it.sale?.id == saleId }
                                        .ifEmpty { listOf(details) }
                                        .sortedBy { it.createdAt }
                            }
                        },
                    )
                }
            }
            if (incrementalState.visibleCount < menuCards.size) {
                item("load-more-delivery-menu") {
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
        }
    }
}

@Composable
private fun DeliveryMenuCard(
    delivery: Delivery,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    showPrint: Boolean,
    onPrint: () -> Unit,
    onView: () -> Unit,
) {
    val firstItem = delivery.items.firstOrNull()
    val visibleItems = if (expanded) delivery.items else listOfNotNull(firstItem)
    val hasMoreItems = delivery.items.size > 1
    val timestamp = delivery.sale?.createdAt ?: delivery.createdAt
    val remaining = delivery.items.sumOf { it.remainingQuantity ?: it.quantity }
    val statusLower = delivery.status.lowercase()
    val isActiveDelivery = statusLower == "pending" || statusLower == "partial"
    val footerLabel = if (isActiveDelivery) "Remaining" else "Total"

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
                    text = delivery.sale?.saleNumber ?: "Delivery #${delivery.id}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier.background(Color(0xFFFFF1F2), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = deliveryStatusLabel(delivery.status),
                        color = deliveryStatusColor(delivery.status),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            val recipient =
                listOf(
                    delivery.sale?.deliveryName,
                    delivery.sale?.deliveryAddress,
                    delivery.sale?.deliveryContact,
                ).filterNot { it.isNullOrBlank() }.joinToString(" | ")
            if (recipient.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "To: $recipient",
                    color = Color(0xFF374151),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
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

            Spacer(modifier = Modifier.height(8.dp))
            visibleItems.forEachIndexed { index, item ->
                DeliveryMenuItemRow(item = item, preferRemainingQty = isActiveDelivery)
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
                    text = formatTimeLabel(timestamp),
                    color = TextCharcoal,
                    fontSize = 13.sp,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "$footerLabel: x${formatQty(remaining)}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                )
            }

            if (expanded) {
                HorizontalDivider(modifier = Modifier.padding(top = 10.dp, bottom = 6.dp), color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    DeliveryActionButton(
                        icon = Icons.Outlined.Visibility,
                        label = "View",
                        color = TextCharcoal,
                        onClick = onView,
                    )
                    if (showPrint) {
                        DeliveryActionDivider()
                        DeliveryActionButton(
                            icon = Icons.Outlined.Print,
                            label = "Print",
                            color = SafetyOrange,
                            onClick = onPrint,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DeliveryActionDivider() {
    Box(
        modifier =
            Modifier
                .height(34.dp)
                .width(1.dp)
                .background(Color(0xFFE5E7EB)),
    )
}

@Composable
private fun RowScope.DeliveryActionButton(
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

@Composable
private fun DeliveryMenuItemRow(item: DeliveryItem) {
    DeliveryMenuItemRow(item = item, preferRemainingQty = true)
}

@Composable
private fun DeliveryMenuItemRow(
    item: DeliveryItem,
    preferRemainingQty: Boolean,
) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, item.productVariant.product?.image)
    val qtyToShow = if (preferRemainingQty) (item.remainingQuantity ?: item.quantity) else item.quantity
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
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Qty: x${formatQty(qtyToShow)}",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                )
            }
        }
    }
}

@Composable
private fun DeliveryDetailsFullScreen(
    delivery: Delivery,
    trips: List<Delivery>,
    onPrintTrip: (deliveryId: Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val recipient =
        listOf(
            delivery.sale?.deliveryName,
            delivery.sale?.deliveryAddress,
            delivery.sale?.deliveryContact,
        ).filterNot { it.isNullOrBlank() }.joinToString(" | ")

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

            DeliveryDetailsSection(title = "Delivery Information") {
                DeliveryDetailRow(label = "Sale", value = delivery.sale?.saleNumber ?: "Delivery #${delivery.id}")
                DeliveryDetailRow(label = "Status", value = deliveryStatusLabel(delivery.status), valueColor = deliveryStatusColor(delivery.status))
                delivery.sale?.deliveryName?.takeIf { it.isNotBlank() }?.let { deliveryName ->
                    DeliveryDetailRow(label = "Delivery Name", value = deliveryName)
                }
                if (recipient.isNotBlank()) {
                    DeliveryDetailRow(label = "To", value = recipient)
                }
                DeliveryDetailRow(
                    label = "Created",
                    value = "${formatDateHeader(delivery.sale?.createdAt ?: delivery.createdAt)} ${formatTimeLabel(delivery.sale?.createdAt ?: delivery.createdAt)}",
                )
                if (!delivery.notes.isNullOrBlank()) {
                    DeliveryDetailRow(label = "Notes", value = delivery.notes)
                }
            }

            DeliveryDetailsSection(title = "Delivery Records") {
                Text(
                    text = "${trips.size} trip${if (trips.size == 1) "" else "s"}",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
                trips.forEachIndexed { tripIndex, trip ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Trip ${tripIndex + 1}",
                                color = TextCharcoal,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                modifier = Modifier.weight(1f),
                            )
                            if (trips.size > 1 && isPrintableTripStatus(trip.status)) {
                                TextButton(onClick = { onPrintTrip(trip.id) }) {
                                    Icon(
                                        imageVector = Icons.Outlined.Print,
                                        contentDescription = null,
                                        tint = SafetyOrange,
                                        modifier = Modifier.size(16.dp),
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Print",
                                        color = SafetyOrange,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                            Text(
                                text = deliveryStatusLabel(trip.status),
                                color = deliveryStatusColor(trip.status),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        Text(
                            text = "${formatDateHeader(trip.deliveredAt ?: trip.createdAt)} ${formatTimeLabel(trip.deliveredAt ?: trip.createdAt)}",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                        Text(
                            text = "Delivered by: ${trip.deliveredBy?.name ?: "-"}",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                        if (!trip.notes.isNullOrBlank()) {
                            Text(
                                text = trip.notes,
                                color = Color(0xFF374151),
                                fontSize = 12.sp,
                            )
                        }
                        trip.items.forEachIndexed { itemIndex, item ->
                            DeliveryMenuItemRow(item = item, preferRemainingQty = false)
                            if (itemIndex < trip.items.lastIndex) {
                                HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 6.dp))
                            }
                        }
                        if (tripIndex < trips.lastIndex) {
                            HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DeliveryDetailsSection(
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
private fun DeliveryDetailRow(
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

private fun deliveryStatusLabel(status: String): String {
    return when (status.lowercase()) {
        "delivered" -> "Completed"
        else -> status.lowercase().replaceFirstChar { it.uppercaseChar() }
    }
}

private fun deliveryStatusColor(status: String): Color {
    return when (status.lowercase()) {
        "pending" -> Color(0xFFE11D48)
        "partial" -> Color(0xFFB45309)
        "delivered" -> Color(0xFF059669)
        "canceled", "returned" -> Color(0xFF6B7280)
        else -> PrimaryBlue
    }
}

private fun buildDeliveryMenuCards(
    deliveries: List<Delivery>,
    allDeliveries: List<Delivery>,
): List<Delivery> {
    if (deliveries.isEmpty()) {
        return emptyList()
    }

    val bySale = deliveries.groupBy { it.sale?.id ?: -it.id }
    return bySale.values
        .mapNotNull { groupedDeliveries ->
            val representative =
                groupedDeliveries.maxByOrNull { delivery ->
                    delivery.deliveredAt ?: delivery.createdAt
                } ?: groupedDeliveries.firstOrNull()
                    ?: return@mapNotNull null

            val saleId = representative.sale?.id
            if (saleId == null) {
                representative
            } else {
                val sourceDeliveries =
                    allDeliveries
                        .filter { it.sale?.id == saleId }
                        .ifEmpty { groupedDeliveries }
                val mergedItems = mergeDeliveryItems(sourceDeliveries.flatMap { it.items })
                representative.copy(
                    items = if (mergedItems.isNotEmpty()) mergedItems else representative.items,
                )
            }
        }.sortedByDescending { it.sale?.createdAt ?: it.createdAt }
}

private fun resolveSaleTrips(
    delivery: Delivery,
    allDeliveries: List<Delivery>,
): List<Delivery> {
    val saleId = delivery.sale?.id
    if (saleId == null) {
        return listOf(delivery)
    }
    return allDeliveries
        .filter { it.sale?.id == saleId }
        .ifEmpty { listOf(delivery) }
        .sortedBy { it.createdAt }
}

private fun isCompletedDeliveryStatus(status: String): Boolean {
    return status.lowercase() == "delivered"
}

private fun isPrintableTripStatus(status: String): Boolean {
    return when (status.lowercase()) {
        "partial",
        "delivered",
        -> true
        else -> false
    }
}

private fun mergeDeliveryItems(items: List<DeliveryItem>): List<DeliveryItem> {
    val merged = linkedMapOf<String, DeliveryItem>()
    items.forEach { item ->
        val key = "${item.saleItemId ?: item.id}-${item.productVariant.id}"
        val existing = merged[key]
        if (existing == null) {
            merged[key] = item.copy(remainingQuantity = null)
        } else {
            merged[key] =
                existing.copy(
                    quantity = existing.quantity + item.quantity,
                    remainingQuantity = null,
                )
        }
    }
    return merged.values.toList()
}
