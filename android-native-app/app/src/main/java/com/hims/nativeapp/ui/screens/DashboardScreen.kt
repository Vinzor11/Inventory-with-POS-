package com.hims.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.data.model.DashboardAlert
import com.hims.nativeapp.data.model.DashboardData
import com.hims.nativeapp.data.model.DashboardTopProduct
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.formatDateTimeLabelWithSeconds
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty

@Composable
fun DashboardScreen(
    dashboard: DashboardData?,
    inventoryDashboard: InventoryDashboardData? = null,
    isRefreshing: Boolean = false,
    accessDenied: Boolean = false,
    statusMessage: String? = null,
    onOpenSalesReport: () -> Unit = {},
    onOpenWeighReport: () -> Unit = {},
) {
    if (dashboard == null) {
        val message =
            when {
                isRefreshing -> "Loading dashboard..."
                accessDenied -> "Dashboard is not available for this account."
                !statusMessage.isNullOrBlank() -> statusMessage
                else -> "Dashboard data unavailable. Pull to refresh."
            }

        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(AppBackground),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = message,
                color = Color(0xFF6B7280),
                fontSize = 14.sp,
            )
        }
        return
    }

    val hasSplitFromDashboard =
        dashboard.inventory.hardwareInventoryValue > 0 ||
            dashboard.inventory.agriculturalInventoryValue > 0 ||
            dashboard.inventory.potentialProfitBasis == "hardware_only"

    val hardwareValue =
        if (hasSplitFromDashboard) {
            dashboard.inventory.hardwareInventoryValue
        } else {
            inventoryDashboard?.hardwareValue ?: dashboard.inventory.inventoryValue
        }
    val agriculturalValue =
        if (hasSplitFromDashboard) {
            dashboard.inventory.agriculturalInventoryValue
        } else {
            inventoryDashboard?.agriculturalValue ?: 0.0
        }
    val totalInventoryValue =
        if (hasSplitFromDashboard) {
            hardwareValue + agriculturalValue
        } else {
            inventoryDashboard?.totalValue ?: dashboard.inventory.inventoryValue
        }
    val hardwarePotentialProfit = dashboard.inventory.potentialProfit
    val todayTotalWeighKg = dashboard.weighIns.today.byType.values.sumOf { it.totalWeightKg }.coerceAtLeast(0.0)
    val todayCoconutCount = dashboard.weighIns.today.byType["coconut"]?.totalCount ?: 0.0

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item("hero") {
            HeroCard(
                lastUpdated = dashboard.lastUpdated?.let { formatDateTimeLabelWithSeconds(it) } ?: "-",
                todayGross = dashboard.sales.today.grossSales,
                todayGrossProfit = dashboard.sales.today.grossProfit,
                todayWeigh = dashboard.weighIns.today.totalAmount,
            )
        }

        item("owner-kpi") {
            PanelCard(
                title = "Owner KPI",
                containerColor = Color(0xFFE8EEF9),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    StatPill(
                        label = "Hardware Value",
                        value = formatPeso(hardwareValue),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Agricultural Value",
                        value = formatPeso(agriculturalValue),
                        modifier = Modifier.weight(1f),
                    )
                }
                HorizontalDivider(color = BorderSoft)
                MetricRow("Total Inventory Value", formatPeso(totalInventoryValue))
                MetricRow("Potential Profit (Hardware)", formatPeso(hardwarePotentialProfit))
            }
        }

        item("snapshot") {
            PanelCard(
                title = "Hardware Sales",
                containerColor = BaseWhite,
                actionLabel = "View more",
                onAction = onOpenSalesReport,
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(
                        label = "Today's Payments",
                        value = formatPeso(dashboard.payments.today.totalPayments),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Outstanding Balance",
                        value = formatPeso(dashboard.payments.today.outstandingBalances),
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(
                        label = "Week Gross Rev",
                        value = formatPeso(dashboard.sales.thisWeek.grossSales),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Month Gross Rev",
                        value = formatPeso(dashboard.sales.thisMonth.grossSales),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        item("weigh-ins") {
            PanelCard(
                title = "Weigh Ins",
                containerColor = BaseWhite,
                actionLabel = "View more",
                onAction = onOpenWeighReport,
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(
                        label = "Today Amount",
                        value = formatPeso(dashboard.weighIns.today.totalAmount),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Today Total Kg",
                        value = formatQty(todayTotalWeighKg),
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(
                        label = "Week Amount",
                        value = formatPeso(dashboard.weighIns.thisWeek.totalAmount),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Month Amount",
                        value = formatPeso(dashboard.weighIns.thisMonth.totalAmount),
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatPill(
                        label = "Today Coconut Count",
                        value = formatQty(todayCoconutCount),
                        modifier = Modifier.weight(1f),
                    )
                    StatPill(
                        label = "Today Weigh-ins",
                        value = dashboard.weighIns.today.count.toString(),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        item("operations") {
            PanelCard(
                title = "Operations",
                containerColor = BaseWhite,
            ) {
                MetricRow("Deliveries Pending", dashboard.deliveries.today.pending.toString())
                MetricRow("Deliveries Partial", dashboard.deliveries.today.partial.toString())
                MetricRow("Deliveries Completed", dashboard.deliveries.today.delivered.toString())
                HorizontalDivider(color = BorderSoft)
                MetricRow("Weigh-In Transactions", dashboard.weighIns.today.count.toString())
                MetricRow("Weigh-In Today", formatPeso(dashboard.weighIns.today.totalAmount))
                MetricRow("Weigh-In Week", formatPeso(dashboard.weighIns.thisWeek.totalAmount))
            }
        }

        item("financial") {
            PanelCard(
                title = "Financial",
                containerColor = BaseWhite,
            ) {
                MetricRow("Week Gross Revenue", formatPeso(dashboard.sales.thisWeek.grossSales))
                MetricRow("Week Gross Profit", formatPeso(dashboard.sales.thisWeek.grossProfit))
                MetricRow("Month Gross Revenue", formatPeso(dashboard.sales.thisMonth.grossSales))
                MetricRow("Month Gross Profit", formatPeso(dashboard.sales.thisMonth.grossProfit))
            }
        }

        item("alerts") {
            PanelCard(
                title = "Alerts",
                containerColor = Color(0xFFFEF2F2),
            ) {
                AlertsSection(alerts = dashboard.alerts)
            }
        }

        item("top-products") {
            PanelCard(
                title = "Top Products (Month)",
                containerColor = BaseWhite,
            ) {
                TopProductsSection(products = dashboard.topProducts.byQuantity.take(5))
            }
        }
    }
}

@Composable
private fun HeroCard(
    lastUpdated: String,
    todayGross: Double,
    todayGrossProfit: Double,
    todayWeigh: Double,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PrimaryBlue),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "Owner Dashboard",
                color = BaseWhite,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Last updated: $lastUpdated",
                color = Color.White.copy(alpha = 0.84f),
                fontSize = 12.sp,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatPill(
                    label = "Today Gross Rev",
                    value = formatPeso(todayGross),
                    labelColor = Color(0xFFDDE7F6),
                    valueColor = BaseWhite,
                    containerColor = Color.White.copy(alpha = 0.16f),
                    modifier = Modifier.weight(1f),
                )
                StatPill(
                    label = "Today Gross Profit",
                    value = formatPeso(todayGrossProfit),
                    labelColor = Color(0xFFDDE7F6),
                    valueColor = BaseWhite,
                    containerColor = Color.White.copy(alpha = 0.16f),
                    modifier = Modifier.weight(1f),
                )
                StatPill(
                    label = "Weigh Today",
                    value = formatPeso(todayWeigh),
                    labelColor = Color(0xFFDDE7F6),
                    valueColor = BaseWhite,
                    containerColor = Color.White.copy(alpha = 0.16f),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun PanelCard(
    title: String,
    containerColor: Color,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = title,
                    color = TextCharcoal,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                if (!actionLabel.isNullOrBlank() && onAction != null) {
                    Text(
                        text = actionLabel,
                        color = PrimaryBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable(onClick = onAction),
                    )
                }
            }
            content()
        }
    }
}

@Composable
private fun StatPill(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    labelColor: Color = Color(0xFF6B7280),
    valueColor: Color = TextCharcoal,
    containerColor: Color = BaseWhite,
) {
    Box(
        modifier =
            modifier
                .background(containerColor, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(horizontal = 9.dp, vertical = 7.dp),
    ) {
        Column {
            Text(
                text = label,
                color = labelColor,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = value,
                color = valueColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun MetricRow(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            color = Color(0xFF4B5563),
            fontSize = 12.sp,
            modifier = Modifier.weight(1f),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = value,
            color = TextCharcoal,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun AlertsSection(alerts: List<DashboardAlert>) {
    if (alerts.isEmpty()) {
        Text(
            text = "No active alerts.",
            color = Color(0xFF4B5563),
            fontSize = 13.sp,
        )
        return
    }

    alerts.forEachIndexed { index, alert ->
        Text(
            text = "${alert.title}: ${alert.message}",
            color = Color(0xFF991B1B),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
        if (index < alerts.lastIndex) {
            HorizontalDivider(color = BorderSoft)
        }
    }
}

@Composable
private fun TopProductsSection(products: List<DashboardTopProduct>) {
    if (products.isEmpty()) {
        Text(
            text = "No product movement yet.",
            color = Color(0xFF4B5563),
            fontSize = 13.sp,
        )
        return
    }

    products.forEachIndexed { index, product ->
        TopProductRow(product = product)
        if (index < products.lastIndex) {
            HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 4.dp))
        }
    }
}

@Composable
private fun TopProductRow(product: DashboardTopProduct) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = product.name,
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = product.description ?: "-",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = product.totalQuantity.toString(),
                color = TextCharcoal,
                fontSize = 12.sp,
            )
            Text(
                text = formatPeso(product.totalRevenue),
                color = Color(0xFF166534),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}
