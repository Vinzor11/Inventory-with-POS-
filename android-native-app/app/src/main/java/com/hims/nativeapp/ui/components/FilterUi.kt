package com.hims.nativeapp.ui.components

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

data class FilterOption(
    val value: String,
    val label: String,
)

@Composable
fun FilterOptionGrid(
    label: String,
    options: List<FilterOption>,
    selectedValue: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = label,
            color = TextCharcoal,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        options.chunked(2).forEach { rowOptions ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                rowOptions.forEach { option ->
                    FilterOptionTile(
                        label = option.label,
                        selected = selectedValue == option.value,
                        onClick = { onSelect(option.value) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (rowOptions.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun FilterOptionTile(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .background(
                    color = if (selected) SafetyOrange else BaseWhite,
                    shape = RoundedCornerShape(10.dp),
                ).border(
                    width = 1.dp,
                    color = if (selected) SafetyOrange else BorderSoft,
                    shape = RoundedCornerShape(10.dp),
                ).clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) BaseWhite else TextCharcoal,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Composable
fun FilterDateRangeSummary(
    dateFrom: String,
    dateTo: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = "Date",
            color = TextCharcoal,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterDateCell(
                value = formatIsoToDisplay(dateFrom),
                placeholder = "Start",
                modifier = Modifier.weight(1f),
                onClick = onClick,
            )
            Text(
                text = "-",
                color = Color(0xFF6B7280),
                fontWeight = FontWeight.SemiBold,
            )
            FilterDateCell(
                value = formatIsoToDisplay(dateTo),
                placeholder = "End",
                modifier = Modifier.weight(1f),
                onClick = onClick,
            )
        }
    }
}

@Composable
private fun FilterDateCell(
    value: String?,
    placeholder: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .background(Color(0xFFF3F4F6), RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = value ?: placeholder,
            color = if (value == null) Color(0xFF9CA3AF) else TextCharcoal,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun DateRangePickerDialog(
    title: String,
    initialDateFrom: String,
    initialDateTo: String,
    onDismiss: () -> Unit,
    onApply: (String, String) -> Unit,
    onClear: () -> Unit,
) {
    var localDateFrom by remember(initialDateFrom) { mutableStateOf(initialDateFrom) }
    var localDateTo by remember(initialDateTo) { mutableStateOf(initialDateTo) }
    var activeQuickRange by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "* Select a time range within a 12 month period.",
                    color = Color(0xFF6B7280),
                    fontSize = 11.sp,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    QuickRangeButton(
                        label = "7 days",
                        selected = activeQuickRange == "7d",
                        modifier = Modifier.weight(1f),
                    ) {
                        val now = LocalDate.now()
                        localDateTo = now.toString()
                        localDateFrom = now.minusDays(6).toString()
                        activeQuickRange = "7d"
                    }
                    QuickRangeButton(
                        label = "1 Month",
                        selected = activeQuickRange == "1m",
                        modifier = Modifier.weight(1f),
                    ) {
                        val now = LocalDate.now()
                        localDateTo = now.toString()
                        localDateFrom = now.minusMonths(1).plusDays(1).toString()
                        activeQuickRange = "1m"
                    }
                    QuickRangeButton(
                        label = "3 Months",
                        selected = activeQuickRange == "3m",
                        modifier = Modifier.weight(1f),
                    ) {
                        val now = LocalDate.now()
                        localDateTo = now.toString()
                        localDateFrom = now.minusMonths(3).plusDays(1).toString()
                        activeQuickRange = "3m"
                    }
                    QuickRangeButton(
                        label = "6 Months",
                        selected = activeQuickRange == "6m",
                        modifier = Modifier.weight(1f),
                    ) {
                        val now = LocalDate.now()
                        localDateTo = now.toString()
                        localDateFrom = now.minusMonths(6).plusDays(1).toString()
                        activeQuickRange = "6m"
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FilterDateCell(
                        value = formatIsoToDisplay(localDateFrom),
                        placeholder = "Start",
                        modifier = Modifier.weight(1f),
                        onClick = {
                            val pickerDate = parseIsoToLocalDate(localDateFrom) ?: LocalDate.now()
                            DatePickerDialog(
                                context,
                                { _, year, month, dayOfMonth ->
                                    localDateFrom =
                                        String.format(
                                            Locale.US,
                                            "%04d-%02d-%02d",
                                            year,
                                            month + 1,
                                            dayOfMonth,
                                        )
                                    activeQuickRange = null
                                },
                                pickerDate.year,
                                pickerDate.monthValue - 1,
                                pickerDate.dayOfMonth,
                            ).show()
                        },
                    )
                    Text(
                        text = "-",
                        color = Color(0xFF6B7280),
                        fontWeight = FontWeight.SemiBold,
                    )
                    FilterDateCell(
                        value = formatIsoToDisplay(localDateTo),
                        placeholder = "End",
                        modifier = Modifier.weight(1f),
                        onClick = {
                            val pickerDate = parseIsoToLocalDate(localDateTo) ?: LocalDate.now()
                            DatePickerDialog(
                                context,
                                { _, year, month, dayOfMonth ->
                                    localDateTo =
                                        String.format(
                                            Locale.US,
                                            "%04d-%02d-%02d",
                                            year,
                                            month + 1,
                                            dayOfMonth,
                                        )
                                    activeQuickRange = null
                                },
                                pickerDate.year,
                                pickerDate.monthValue - 1,
                                pickerDate.dayOfMonth,
                            ).show()
                        },
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onApply(localDateFrom, localDateTo) },
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = SafetyOrange,
                        contentColor = BaseWhite,
                    ),
            ) {
                Text("Apply")
            }
        },
        dismissButton = {
            Button(
                onClick = onClear,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFE5E7EB),
                        contentColor = TextCharcoal,
                    ),
            ) {
                Text("Clear")
            }
        },
    )
}

@Composable
private fun QuickRangeButton(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .background(
                    color = if (selected) SafetyOrange else BaseWhite,
                    shape = RoundedCornerShape(8.dp),
                ).border(
                    width = 1.dp,
                    color = if (selected) SafetyOrange else BorderSoft,
                    shape = RoundedCornerShape(8.dp),
                ).clickable(onClick = onClick)
                .padding(horizontal = 8.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) BaseWhite else TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
fun FilterActionRow(
    onClear: () -> Unit,
    onApply: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Button(
            onClick = onClear,
            modifier = Modifier.weight(1f),
            colors =
                ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFE5E7EB),
                    contentColor = TextCharcoal,
                ),
            shape = RoundedCornerShape(10.dp),
        ) {
            Text("Clear", fontWeight = FontWeight.SemiBold)
        }
        Button(
            onClick = onApply,
            modifier = Modifier.weight(1f),
            colors =
                ButtonDefaults.buttonColors(
                    containerColor = SafetyOrange,
                    contentColor = BaseWhite,
                ),
            shape = RoundedCornerShape(10.dp),
        ) {
            Text("Apply", fontWeight = FontWeight.SemiBold)
        }
    }
}

fun formatIsoToDisplay(isoDate: String): String? {
    val localDate = parseIsoToLocalDate(isoDate) ?: return null
    return localDate.format(DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US))
}

private fun parseIsoToLocalDate(value: String): LocalDate? {
    val normalized = value.trim()
    if (normalized.isBlank()) {
        return null
    }
    return try {
        LocalDate.parse(normalized)
    } catch (_: Exception) {
        null
    }
}
