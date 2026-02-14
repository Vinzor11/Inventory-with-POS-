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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.hims.nativeapp.data.model.WeighInTransaction
import com.hims.nativeapp.ui.components.CopyActionButton
import com.hims.nativeapp.ui.components.DateRangePickerDialog
import com.hims.nativeapp.ui.components.FilterActionRow
import com.hims.nativeapp.ui.components.FilterDateRangeSummary
import com.hims.nativeapp.ui.components.FilterOption
import com.hims.nativeapp.ui.components.FilterOptionGrid
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatTimeLabel

@Composable
fun WeighReportScreen(
    transactions: List<WeighInTransaction>,
    typeFilter: String,
    statusFilter: String,
    dateFrom: String,
    dateTo: String,
    isLoading: Boolean,
    onApplyFilters: (type: String, status: String, dateFrom: String, dateTo: String) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)

    var showFiltersDialog by remember { mutableStateOf(false) }
    var draftType by remember(typeFilter) { mutableStateOf(typeFilter) }
    var draftStatus by remember(statusFilter) { mutableStateOf(statusFilter) }
    var draftDateFrom by remember(dateFrom) { mutableStateOf(dateFrom) }
    var draftDateTo by remember(dateTo) { mutableStateOf(dateTo) }

    val sortedTransactions =
        remember(transactions) {
            transactions.sortedByDescending { it.weighedAt ?: it.createdAt.orEmpty() }
        }
    val totalAmount = remember(sortedTransactions) { sortedTransactions.sumOf { it.totalAmount } }
    val paidCount = remember(sortedTransactions) { sortedTransactions.count { it.status.equals("paid", ignoreCase = true) } }
    val unpaidCount = remember(sortedTransactions) { sortedTransactions.count { !it.status.equals("paid", ignoreCase = true) } }
    val incrementalState = rememberIncrementalListState(totalItems = sortedTransactions.size)
    val visibleTransactions =
        remember(sortedTransactions, incrementalState.visibleCount) {
            sortedTransactions.take(incrementalState.visibleCount)
        }

    LazyColumn(
        state = incrementalState.listState,
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item("header") {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = BaseWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                            .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Back",
                        tint = TextCharcoal,
                        modifier = Modifier.size(22.dp).clickable(onClick = onBack),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Weigh Ins Report",
                            color = TextCharcoal,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                        )
                        Text(
                            text = "Summary and transaction records",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                    Spacer(modifier = Modifier.weight(1f))
                    OutlinedButton(
                        onClick = {
                            draftType = typeFilter
                            draftStatus = statusFilter
                            draftDateFrom = dateFrom
                            draftDateTo = dateTo
                            showFiltersDialog = true
                        },
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSoft),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.FilterList,
                            contentDescription = null,
                            tint = PrimaryBlue,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Filters",
                            color = PrimaryBlue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        item("summary") {
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
                        text = "Summary",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        WeighMetricPill(
                            label = "Transactions",
                            value = sortedTransactions.size.toString(),
                            modifier = Modifier.weight(1f),
                        )
                        WeighMetricPill(
                            label = "Total Amount",
                            value = formatPeso(totalAmount),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        WeighMetricPill(
                            label = "Paid",
                            value = paidCount.toString(),
                            modifier = Modifier.weight(1f),
                        )
                        WeighMetricPill(
                            label = "Unpaid",
                            value = unpaidCount.toString(),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        item("list-title") {
            Column(modifier = Modifier.padding(start = 2.dp, top = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Weigh Records",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
                Text(
                    text = "Showing ${visibleTransactions.size} of ${sortedTransactions.size}",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
            }
        }

        if (isLoading && sortedTransactions.isEmpty()) {
            item("loading") {
                WeighEmptyCard("Loading weigh-ins report...")
            }
        } else if (visibleTransactions.isEmpty()) {
            item("empty") {
                WeighEmptyCard("No weigh-in records found for selected filters.")
            }
        } else {
            items(visibleTransactions, key = { it.id }) { transaction ->
                WeighReportRow(transaction = transaction)
            }
            if (incrementalState.visibleCount < sortedTransactions.size) {
                item("load-more-weigh-report") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading more records...",
                            color = Color(0xFF6B7280),
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
    }

    if (showFiltersDialog) {
        WeighReportFiltersDialog(
            draftType = draftType,
            draftStatus = draftStatus,
            draftDateFrom = draftDateFrom,
            draftDateTo = draftDateTo,
            onTypeChange = { draftType = it },
            onStatusChange = { draftStatus = it },
            onDateFromChange = { draftDateFrom = it },
            onDateToChange = { draftDateTo = it },
            onDismiss = { showFiltersDialog = false },
            onApply = {
                onApplyFilters(draftType, draftStatus, draftDateFrom, draftDateTo)
                showFiltersDialog = false
            },
        )
    }
}

@Composable
private fun WeighReportFiltersDialog(
    draftType: String,
    draftStatus: String,
    draftDateFrom: String,
    draftDateTo: String,
    onTypeChange: (String) -> Unit,
    onStatusChange: (String) -> Unit,
    onDateFromChange: (String) -> Unit,
    onDateToChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onApply: () -> Unit,
) {
    var showDatePicker by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = BaseWhite,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 2.dp,
            shadowElevation = 8.dp,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Weigh Filters",
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                )
                FilterOptionGrid(
                    label = "Type",
                    options =
                        listOf(
                            FilterOption("all", "All"),
                            FilterOption("cooked_copra", "Cooked"),
                            FilterOption("uncooked_copra", "Uncooked"),
                            FilterOption("coconut", "Coconut"),
                        ),
                    selectedValue = draftType,
                    onSelect = onTypeChange,
                )
                FilterOptionGrid(
                    label = "Status",
                    options =
                        listOf(
                            FilterOption("all", "All"),
                            FilterOption("paid", "Paid"),
                            FilterOption("unpaid", "Unpaid"),
                        ),
                    selectedValue = draftStatus,
                    onSelect = onStatusChange,
                )
                FilterDateRangeSummary(
                    dateFrom = draftDateFrom,
                    dateTo = draftDateTo,
                    onClick = { showDatePicker = true },
                )
                FilterActionRow(
                    onClear = {
                        onTypeChange("all")
                        onStatusChange("all")
                        onDateFromChange("")
                        onDateToChange("")
                    },
                    onApply = onApply,
                )
            }
        }
    }

    if (showDatePicker) {
        DateRangePickerDialog(
            title = "Select date",
            initialDateFrom = draftDateFrom,
            initialDateTo = draftDateTo,
            onDismiss = { showDatePicker = false },
            onApply = { from, to ->
                onDateFromChange(from)
                onDateToChange(to)
                showDatePicker = false
            },
            onClear = {
                onDateFromChange("")
                onDateToChange("")
                showDatePicker = false
            },
        )
    }
}

@Composable
private fun WeighMetricPill(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(horizontal = 9.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
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
            color = TextCharcoal,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun WeighReportRow(transaction: WeighInTransaction) {
    val refValue = transaction.refNum ?: "WIT-${transaction.id}"
    val status = if (transaction.status.equals("paid", ignoreCase = true)) "Paid" else "Unpaid"
    val statusColor = if (status == "Paid") Color(0xFF166534) else Color(0xFFB45309)
    val statusBg = if (status == "Paid") Color(0xFFDCFCE7) else Color(0xFFFEF3C7)
    val timestamp = transaction.weighedAt ?: transaction.createdAt.orEmpty()

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
                    .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = refValue,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CopyActionButton(
                        value = refValue,
                        copiedMessage = "Reference copied",
                    )
                }
                Box(
                    modifier =
                        Modifier
                            .background(statusBg, RoundedCornerShape(999.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = status,
                        color = statusColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                    )
                }
            }
            Text(
                text = "Supplier: ${transaction.supplierName?.takeIf { it.isNotBlank() } ?: "N/A"}",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
            )
            Text(
                text = "Weighed by: ${transaction.weighedBy?.name ?: "N/A"}",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = "${formatDateHeader(timestamp)} ${formatTimeLabel(timestamp)}",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
                Text(
                    text = formatPeso(transaction.totalAmount),
                    color = TextCharcoal,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun WeighEmptyCard(message: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                    .padding(16.dp),
        ) {
            Text(
                text = message,
                color = Color(0xFF6B7280),
                fontSize = 13.sp,
            )
        }
    }
}
