package com.hims.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Scale
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.data.model.CookedCopraStockSummary
import com.hims.nativeapp.data.model.InventoryVariant
import com.hims.nativeapp.data.model.ProductionRun
import com.hims.nativeapp.data.model.WeighLandingProduct
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.formatDateHeader
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import java.time.LocalDate
import java.util.Locale

private const val KgPerPcWarning = 0.40
private const val KgPerPcCritical = 0.60

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductionMenuScreen(
    runs: List<ProductionRun>,
    inventoryVariants: List<InventoryVariant>,
    weighProducts: Map<String, WeighLandingProduct?>,
    cookedCopraSummary: CookedCopraStockSummary?,
    isActionLoading: Boolean,
    onCreateRun: (
        runType: String,
        inputQty: Double,
        outputWeightKg: Double,
        productionDate: String,
        operator: String,
        supplierSource: String,
        dryingMethod: String,
        notes: String,
        onSuccess: () -> Unit,
    ) -> Unit,
    onSellCookedCopra: (
        quantityKg: Double,
        unitPrice: Double,
        saleDate: String,
        customerName: String,
        notes: String,
        onSuccess: () -> Unit,
    ) -> Unit,
    onBack: () -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit = {},
) {
    BackHandler(onBack = onBack)
    LaunchedEffect(Unit) {
        onFullscreenModeChange(false)
    }

    var runType by remember { mutableStateOf("coconut_to_uncooked") }
    var showCreateFormModal by remember { mutableStateOf(false) }
    var showSellCookedModal by remember { mutableStateOf(false) }
    val createFormSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var inputQtyText by remember { mutableStateOf("") }
    var outputQtyText by remember { mutableStateOf("") }
    var productionDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var operatorText by remember { mutableStateOf("") }
    var supplierSourceText by remember { mutableStateOf("") }
    var dryingMethodText by remember { mutableStateOf("") }
    var notesText by remember { mutableStateOf("") }

    val inputQty = inputQtyText.toDoubleOrNull() ?: 0.0
    val outputQty = outputQtyText.toDoubleOrNull() ?: 0.0
    val isPieceToKgRun = runType == "coconut_to_uncooked" || runType == "coconut_to_cooked"
    val isUncookedToCooked = runType == "uncooked_to_cooked"
    val sourceStock =
        remember(inventoryVariants, weighProducts, runType) {
            resolveProductionSourceStock(
                inventoryVariants = inventoryVariants,
                weighProducts = weighProducts,
                runType = runType,
            )
        }
    val sourceStockQty = sourceStock.quantity.coerceAtLeast(0.0)
    val sourceStockUnit = sourceStock.unit

    LaunchedEffect(runType, sourceStockQty, sourceStockUnit) {
        inputQtyText = clampInputQtyText(inputQtyText, sourceStockQty, sourceStockUnit)
    }

    val kgPerPc = if (isPieceToKgRun && inputQty > 0) outputQty / inputQty else 0.0
    val pcsPerKg = if (isPieceToKgRun && outputQty > 0) inputQty / outputQty else 0.0
    val isOutputWarning = isPieceToKgRun && kgPerPc > KgPerPcWarning
    val isOutputCritical = isPieceToKgRun && kgPerPc > KgPerPcCritical
    val shrinkageQty = if (isUncookedToCooked) (inputQty - outputQty) else 0.0
    val shrinkagePct = if (isUncookedToCooked && inputQty > 0) ((inputQty - outputQty) / inputQty) * 100.0 else 0.0
    val yieldPct = if (isUncookedToCooked && inputQty > 0) (outputQty / inputQty) * 100.0 else 0.0
    val estimatedInputUnitCost =
        remember(runs, runType) {
            val candidateRuns =
                if (runType == "uncooked_to_cooked") {
                    runs.filter { it.runType == "uncooked_to_cooked" }
                } else {
                    runs.filter { it.runType == "coconut_to_uncooked" || it.runType == "coconut_to_cooked" }
                }
            val latestSameInput = candidateRuns.firstOrNull()
            val lineUnitCost = latestSameInput?.lines?.firstOrNull { it.direction.equals("out", ignoreCase = true) }?.unitCost
            when {
                lineUnitCost != null && lineUnitCost > 0 -> lineUnitCost
                latestSameInput != null && latestSameInput.inputQty > 0 && latestSameInput.totalInputCost > 0 ->
                    latestSameInput.totalInputCost / latestSameInput.inputQty
                else -> 0.0
            }
        }
    val estimatedInputCost = inputQty * estimatedInputUnitCost
    val estimatedOutputCostPerKg = if (outputQty > 0) estimatedInputCost / outputQty else 0.0

    val incrementalState = rememberIncrementalListState(totalItems = runs.size)
    val visibleRuns =
        remember(runs, incrementalState.visibleCount) {
            runs.take(incrementalState.visibleCount)
        }
    val today = LocalDate.now().toString()
    val todayCount = runs.count { it.productionDate.startsWith(today) }
    val coconutToUncookedRuns = runs.count { it.runType == "coconut_to_uncooked" }
    val uncookedToCookedRuns = runs.count { it.runType == "uncooked_to_cooked" }
    val coconutToCookedRuns = runs.count { it.runType == "coconut_to_cooked" }

    val canSubmit =
        inputQty > 0 &&
            outputQty > 0 &&
            inputQty <= sourceStockQty &&
            productionDate.isNotBlank() &&
            (!isPieceToKgRun || !isOutputCritical) &&
            (!isUncookedToCooked || outputQty <= inputQty)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
    ) {
        LazyColumn(
            state = incrementalState.listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item("header") {
                ProductionHeaderCard(
                    todayCount = todayCount,
                    coconutToUncookedRuns = coconutToUncookedRuns,
                    uncookedToCookedRuns = uncookedToCookedRuns,
                    coconutToCookedRuns = coconutToCookedRuns,
                    canSellCooked = cookedCopraSummary != null,
                    onSellCooked = { showSellCookedModal = true },
                    onBack = onBack,
                )
            }

            item("list-title") {
                Text(
                    text = "Recent Production Runs",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(start = 2.dp, top = 4.dp),
                )
            }

            if (runs.isEmpty()) {
                item("empty") {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = BaseWhite),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                                    .padding(16.dp),
                        ) {
                            Text(
                                text = "No production runs found.",
                                color = Color(0xFF6B7280),
                                fontSize = 13.sp,
                            )
                        }
                    }
                }
            } else {
                items(visibleRuns, key = { it.id }) { run ->
                    ProductionRunCard(run = run)
                }
                if (incrementalState.visibleCount < runs.size) {
                    item("load-more-production-runs") {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "Loading more production runs...",
                                color = Color(0xFF6B7280),
                                fontSize = 12.sp,
                            )
                        }
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
                    .clickable { showCreateFormModal = true },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.Add,
                contentDescription = "Add production run",
                tint = BaseWhite,
                modifier = Modifier.size(28.dp),
            )
        }

        if (showCreateFormModal) {
            ModalBottomSheet(
                onDismissRequest = { showCreateFormModal = false },
                sheetState = createFormSheetState,
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ProductionFormCard(
                        runType = runType,
                        onRunTypeChange = { runType = it },
                        inputQtyText = inputQtyText,
                        onInputQtyChange = {
                            inputQtyText = clampInputQtyText(it, sourceStockQty, sourceStockUnit)
                        },
                        outputQtyText = outputQtyText,
                        onOutputQtyChange = { outputQtyText = it },
                        productionDate = productionDate,
                        onProductionDateChange = { productionDate = it },
                        operatorText = operatorText,
                        onOperatorTextChange = { operatorText = it },
                        supplierSourceText = supplierSourceText,
                        onSupplierSourceTextChange = { supplierSourceText = it },
                        dryingMethodText = dryingMethodText,
                        onDryingMethodTextChange = { dryingMethodText = it },
                        notesText = notesText,
                        onNotesTextChange = { notesText = it },
                        isPieceToKgRun = isPieceToKgRun,
                        sourceStockQty = sourceStockQty,
                        sourceStockUnit = sourceStockUnit,
                        estimatedInputCost = estimatedInputCost,
                        estimatedOutputCostPerKg = estimatedOutputCostPerKg,
                        kgPerPc = kgPerPc,
                        pcsPerKg = pcsPerKg,
                        yieldPct = yieldPct,
                        shrinkageQty = shrinkageQty,
                        shrinkagePct = shrinkagePct,
                        isOutputWarning = isOutputWarning,
                        isOutputCritical = isOutputCritical,
                        isActionLoading = isActionLoading,
                        canSubmit = canSubmit,
                        onSubmit = {
                            onCreateRun(
                                runType,
                                inputQty.coerceAtMost(sourceStockQty),
                                outputQty,
                                productionDate,
                                operatorText,
                                supplierSourceText,
                                dryingMethodText,
                                notesText,
                            ) {
                                inputQtyText = ""
                                outputQtyText = ""
                                notesText = ""
                                supplierSourceText = ""
                                dryingMethodText = ""
                                showCreateFormModal = false
                            }
                        },
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }

        if (showSellCookedModal && cookedCopraSummary != null) {
            CookedCopraSaleDialog(
                summary = cookedCopraSummary,
                isActionLoading = isActionLoading,
                onDismiss = { if (!isActionLoading) showSellCookedModal = false },
                onSubmit = { quantityKg, unitPrice, saleDate, customerName, notes ->
                    onSellCookedCopra(quantityKg, unitPrice, saleDate, customerName, notes) {
                        showSellCookedModal = false
                    }
                },
            )
        }
    }
}

@Composable
private fun ProductionHeaderCard(
    todayCount: Int,
    coconutToUncookedRuns: Int,
    uncookedToCookedRuns: Int,
    coconutToCookedRuns: Int,
    canSellCooked: Boolean,
    onSellCooked: () -> Unit,
    onBack: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = BaseWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderSoft, RoundedCornerShape(16.dp))
                    .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                    contentDescription = "Back",
                    tint = TextCharcoal,
                    modifier = Modifier.size(22.dp).clickable(onClick = onBack),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Production Center",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    modifier = Modifier.weight(1f),
                )
                if (canSellCooked) {
                    Text(
                        text = "Sell Cooked",
                        color = PrimaryBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable(onClick = onSellCooked),
                    )
                }
            }
            Text(
                text = "Track conversion and review recent runs.",
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HeaderStat(
                    label = "Today",
                    value = todayCount.toString(),
                    containerColor = Color(0xFFE8EEF9),
                    modifier = Modifier.weight(1f),
                )
                HeaderStat(
                    label = "Coco -> Uncooked",
                    value = coconutToUncookedRuns.toString(),
                    containerColor = Color(0xFFDCFCE7),
                    modifier = Modifier.weight(1f),
                )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HeaderStat(
                    label = "Uncooked -> Cooked",
                    value = uncookedToCookedRuns.toString(),
                    containerColor = Color(0xFFFFEDD5),
                    modifier = Modifier.weight(1f),
                )
                HeaderStat(
                    label = "Coco -> Cooked",
                    value = coconutToCookedRuns.toString(),
                    containerColor = Color(0xFFDBEAFE),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun HeaderStat(
    label: String,
    value: String,
    containerColor: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .height(72.dp)
                .background(containerColor, RoundedCornerShape(10.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                .padding(horizontal = 8.dp, vertical = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = label,
            color = Color(0xFF4B5563),
            fontSize = 10.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            color = TextCharcoal,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun ProductionFormCard(
    runType: String,
    onRunTypeChange: (String) -> Unit,
    inputQtyText: String,
    onInputQtyChange: (String) -> Unit,
    outputQtyText: String,
    onOutputQtyChange: (String) -> Unit,
    productionDate: String,
    onProductionDateChange: (String) -> Unit,
    operatorText: String,
    onOperatorTextChange: (String) -> Unit,
    supplierSourceText: String,
    onSupplierSourceTextChange: (String) -> Unit,
    dryingMethodText: String,
    onDryingMethodTextChange: (String) -> Unit,
    notesText: String,
    onNotesTextChange: (String) -> Unit,
    isPieceToKgRun: Boolean,
    sourceStockQty: Double,
    sourceStockUnit: String,
    estimatedInputCost: Double,
    estimatedOutputCostPerKg: Double,
    kgPerPc: Double,
    pcsPerKg: Double,
    yieldPct: Double,
    shrinkageQty: Double,
    shrinkagePct: Double,
    isOutputWarning: Boolean,
    isOutputCritical: Boolean,
    isActionLoading: Boolean,
    canSubmit: Boolean,
    onSubmit: () -> Unit,
) {
    FormCard {
        Text(
            text = "New Production Run",
            color = TextCharcoal,
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            RunTypeBlock(
                label = "Coconut -> Uncooked",
                helper = "pcs to kg",
                selected = runType == "coconut_to_uncooked",
                onClick = { onRunTypeChange("coconut_to_uncooked") },
                modifier = Modifier.weight(1f),
            )
            RunTypeBlock(
                label = "Uncooked -> Cooked",
                helper = "kg to kg",
                selected = runType == "uncooked_to_cooked",
                onClick = { onRunTypeChange("uncooked_to_cooked") },
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            RunTypeBlock(
                label = "Coconut -> Cooked",
                helper = "pcs to kg",
                selected = runType == "coconut_to_cooked",
                onClick = { onRunTypeChange("coconut_to_cooked") },
                modifier = Modifier.weight(1f),
            )
            Spacer(modifier = Modifier.weight(1f))
        }
        Text(
            text =
                if (isPieceToKgRun) {
                    "Current Coconut Stock: ${formatQty(sourceStockQty)} $sourceStockUnit"
                } else {
                    "Current Uncooked Stock: ${formatQty(sourceStockQty)} $sourceStockUnit"
                },
            color = Color(0xFF374151),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )

        OutlinedTextField(
            value = inputQtyText,
            onValueChange = onInputQtyChange,
            label = {
                Text(
                    if (isPieceToKgRun) "Input Quantity (pcs)" else "Input Quantity (kg)",
                )
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = outputQtyText,
            onValueChange = onOutputQtyChange,
            label = { Text("Output Weight (kg)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = productionDate,
            onValueChange = onProductionDateChange,
            label = { Text("Production Date (YYYY-MM-DD)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = operatorText,
            onValueChange = onOperatorTextChange,
            label = { Text("Operator (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = supplierSourceText,
            onValueChange = onSupplierSourceTextChange,
            label = { Text("Supplier Source (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = dryingMethodText,
            onValueChange = onDryingMethodTextChange,
            label = { Text("Drying Method (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = notesText,
            onValueChange = onNotesTextChange,
            label = { Text("Notes (optional)") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 4,
        )

        LiveMetricsCard(
            isPieceToKgRun = isPieceToKgRun,
            estimatedInputCost = estimatedInputCost,
            estimatedOutputCostPerKg = estimatedOutputCostPerKg,
            kgPerPc = kgPerPc,
            pcsPerKg = pcsPerKg,
            yieldPct = yieldPct,
            shrinkageQty = shrinkageQty,
            shrinkagePct = shrinkagePct,
            isOutputWarning = isOutputWarning,
            isOutputCritical = isOutputCritical,
        )

        Button(
            onClick = onSubmit,
            enabled = canSubmit && !isActionLoading,
            modifier = Modifier.fillMaxWidth(),
            colors =
                ButtonDefaults.buttonColors(
                    containerColor = PrimaryBlue,
                    contentColor = BaseWhite,
                    disabledContainerColor = Color(0xFFCBD5E1),
                    disabledContentColor = Color(0xFF64748B),
                ),
            shape = RoundedCornerShape(10.dp),
        ) {
            Text(
                text = if (isActionLoading) "Saving..." else "Save Production Run",
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun FormCard(
    content: @Composable ColumnScope.() -> Unit,
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
            content = content,
        )
    }
}

@Composable
private fun RunTypeBlock(
    label: String,
    helper: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(72.dp)
                .background(
                    if (selected) Color(0xFFE8EEF9) else BaseWhite,
                    RoundedCornerShape(10.dp),
                ).border(
                    1.dp,
                    if (selected) PrimaryBlue else BorderSoft,
                    RoundedCornerShape(10.dp),
                ).clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                color = if (selected) PrimaryBlue else TextCharcoal,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = helper,
                color = Color(0xFF64748B),
                fontSize = 11.sp,
            )
        }
    }
}

@Composable
private fun LiveMetricsCard(
    isPieceToKgRun: Boolean,
    estimatedInputCost: Double,
    estimatedOutputCostPerKg: Double,
    kgPerPc: Double,
    pcsPerKg: Double,
    yieldPct: Double,
    shrinkageQty: Double,
    shrinkagePct: Double,
    isOutputWarning: Boolean,
    isOutputCritical: Boolean,
) {
    val containerColor =
        when {
            isOutputCritical -> Color(0xFFFEE2E2)
            isOutputWarning -> Color(0xFFFEF3C7)
            isPieceToKgRun -> Color(0xFFE8EEF9)
            else -> Color(0xFFDCFCE7)
        }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(containerColor, RoundedCornerShape(12.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 9.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Live Conversion Metrics",
                color = TextCharcoal,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            MetricRow(label = "Estimated Input Cost", value = formatPeso(estimatedInputCost))
            MetricRow(label = "Estimated Output Cost/kg", value = formatPeso(estimatedOutputCostPerKg))
            if (isPieceToKgRun) {
                MetricRow(label = "Output per Coconut", value = "${String.format("%.2f", kgPerPc)} kg/pc")
                MetricRow(label = "Coconuts per 1kg", value = "${String.format("%.2f", pcsPerKg)} pcs/kg")
                if (isOutputWarning && !isOutputCritical) {
                    Text(
                        text = "Warning: output per coconut seems unusually high. Please verify weigh-in.",
                        color = Color(0xFF92400E),
                        fontSize = 12.sp,
                    )
                }
                if (isOutputCritical) {
                    Text(
                        text = "Output weight exceeds realistic biological limits. Saving is disabled.",
                        color = Color(0xFFB91C1C),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                    )
                }
            } else {
                MetricRow(label = "Yield", value = "${String.format("%.2f", yieldPct)}%")
                MetricRow(label = "Shrinkage", value = "${formatQty(shrinkageQty)} kg")
                MetricRow(label = "Shrinkage %", value = "${String.format("%.2f", shrinkagePct)}%")
            }
        }
    }
}

@Composable
private fun MetricRow(
    label: String,
    value: String,
    labelColor: Color = Color(0xFF4B5563),
    valueColor: Color = TextCharcoal,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            color = labelColor,
            fontSize = 12.sp,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            color = valueColor,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun ProductionRunCard(
    run: ProductionRun,
) {
    val isSaleOutRun = run.runType == "cooked_sale_out"
    val isPieceToKgRun = run.runType == "coconut_to_uncooked" || run.runType == "coconut_to_cooked"
    val outputPerCoconut = if (isPieceToKgRun && run.inputQty > 0) run.outputQty / run.inputQty else 0.0
    val coconutsPerKg = if (isPieceToKgRun && run.outputQty > 0) run.inputQty / run.outputQty else 0.0
    val runTypeBackground =
        when (run.runType) {
            "coconut_to_uncooked" -> Color(0xFFDCFCE7)
            "coconut_to_cooked" -> Color(0xFFDBEAFE)
            "cooked_sale_out" -> Color(0xFFE0E7FF)
            else -> Color(0xFFFFEDD5)
        }
    val runTypeTextColor =
        when (run.runType) {
            "coconut_to_uncooked" -> Color(0xFF166534)
            "coconut_to_cooked" -> Color(0xFF1D4ED8)
            "cooked_sale_out" -> Color(0xFF3730A3)
            else -> Color(0xFF9A3412)
        }
    val runTypeLabel =
        when (run.runType) {
            "coconut_to_uncooked" -> "Coconut -> Uncooked Copra"
            "coconut_to_cooked" -> "Coconut -> Cooked Copra"
            "cooked_sale_out" -> "Cooked Copra Sale Out"
            else -> "Uncooked -> Cooked Copra"
        }
    val revenue = parseMetricFromNotes(run.notes, "Revenue")
    val grossProfit = parseMetricFromNotes(run.notes, "Gross Profit")
    val unitPrice = parseMetricFromNotes(run.notes, "Unit Price")
    val customer = parseTextFromNotes(run.notes, "Customer")

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
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Outlined.Scale,
                    contentDescription = null,
                    tint = PrimaryBlue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = run.batchCode,
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatDateHeader(run.productionDate),
                    color = Color(0xFF6B7280),
                    fontSize = 11.sp,
                )
            }

            Box(
                modifier =
                    Modifier
                        .background(runTypeBackground, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    text = runTypeLabel,
                    color = runTypeTextColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            MetricRow(
                label = "Input / Output",
                value = if (isSaleOutRun) {
                    "${formatQty(run.inputQty)} kg sold"
                } else if (isPieceToKgRun) {
                    "${formatQty(run.inputQty)} pcs -> ${formatQty(run.outputQty)} kg"
                } else {
                    "${formatQty(run.inputQty)} kg -> ${formatQty(run.outputQty)} kg"
                },
            )

            if (isSaleOutRun) {
                if (unitPrice != null && unitPrice > 0) {
                    MetricRow(label = "Unit Price", value = "${formatPeso(unitPrice)}/kg")
                }
                if (revenue != null && revenue > 0) {
                    MetricRow(label = "Revenue", value = formatPeso(revenue))
                }
                if (grossProfit != null) {
                    MetricRow(label = "Gross Profit", value = formatPeso(grossProfit))
                }
                if (!customer.isNullOrBlank()) {
                    MetricRow(label = "Customer", value = customer)
                }
            } else if (isPieceToKgRun) {
                MetricRow(label = "Output per Coconut", value = "${String.format("%.2f", outputPerCoconut)} kg/pc")
                MetricRow(label = "Coconuts per 1kg", value = "${String.format("%.2f", coconutsPerKg)} pcs/kg")
            } else {
                MetricRow(label = "Yield", value = "${String.format("%.2f", run.yieldPercent ?: 0.0)}%")
                MetricRow(label = "Shrinkage", value = "${formatQty(run.shrinkageQty ?: 0.0)} kg")
                MetricRow(label = "Shrinkage %", value = "${String.format("%.2f", run.shrinkagePercent ?: 0.0)}%")
            }

            HorizontalDivider(color = BorderSoft)
            MetricRow(label = "Total Cost", value = formatPeso(run.totalInputCost))
            MetricRow(label = "Cost per kg", value = formatPeso(run.outputUnitCost))
            if (!run.operator.isNullOrBlank()) {
                MetricRow(label = "Operator", value = run.operator)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CookedCopraSaleDialog(
    summary: CookedCopraStockSummary,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (
        quantityKg: Double,
        unitPrice: Double,
        saleDate: String,
        customerName: String,
        notes: String,
    ) -> Unit,
) {
    var quantityText by remember(summary.variantId) { mutableStateOf("") }
    var unitPriceText by remember(summary.variantId) { mutableStateOf(formatDecimalInput(summary.unitPrice)) }
    var saleDateText by remember(summary.variantId) { mutableStateOf(LocalDate.now().toString()) }
    var customerNameText by remember(summary.variantId) { mutableStateOf("") }
    var notesText by remember(summary.variantId) { mutableStateOf("") }
    var error by remember(summary.variantId) { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(summary.stock) {
        quantityText = clampCookedSaleQtyText(quantityText, summary.stock)
    }

    val quantityKg = quantityText.trim().toDoubleOrNull() ?: 0.0
    val unitPrice = unitPriceText.trim().toDoubleOrNull() ?: 0.0
    val estimatedRevenue = quantityKg * unitPrice
    val estimatedCogs = quantityKg * summary.averageCost
    val estimatedProfit = estimatedRevenue - estimatedCogs

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
                        text = "Sell Cooked Copra",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    Text(
                        text = "Current Stock: ${formatQty(summary.stock)} ${summary.unit}",
                        color = Color(0xFF374151),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        text = "Average Cost: ${formatPeso(summary.averageCost)}/${summary.unit}",
                        color = Color(0xFF374151),
                        fontSize = 12.sp,
                    )
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = {
                            quantityText = clampCookedSaleQtyText(it, summary.stock)
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Quantity (kg)") },
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
                        label = { Text("Unit Price (per kg)") },
                        enabled = !isActionLoading,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    OutlinedTextField(
                        value = saleDateText,
                        onValueChange = {
                            saleDateText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Sale Date (YYYY-MM-DD)") },
                        enabled = !isActionLoading,
                    )
                    OutlinedTextField(
                        value = customerNameText,
                        onValueChange = {
                            customerNameText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Customer (Optional)") },
                        enabled = !isActionLoading,
                    )
                    OutlinedTextField(
                        value = notesText,
                        onValueChange = {
                            notesText = it
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Notes (Optional)") },
                        enabled = !isActionLoading,
                    )

                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                                .border(1.dp, BorderSoft, RoundedCornerShape(10.dp))
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            SaleMetricRow(label = "Estimated Revenue", value = formatPeso(estimatedRevenue))
                            SaleMetricRow(label = "Estimated COGS", value = formatPeso(estimatedCogs))
                            SaleMetricRow(label = "Estimated Gross Profit", value = formatPeso(estimatedProfit))
                        }
                    }

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
                        if (quantityKg <= 0.0) {
                            error = "Quantity must be greater than zero."
                            return@Button
                        }
                        if (quantityKg > summary.stock + 0.000001) {
                            error = "Quantity cannot exceed available stock."
                            return@Button
                        }
                        if (unitPrice <= 0.0) {
                            error = "Unit price must be greater than zero."
                            return@Button
                        }
                        if (saleDateText.trim().isBlank()) {
                            error = "Sale date is required."
                            return@Button
                        }
                        onSubmit(
                            quantityKg,
                            unitPrice,
                            saleDateText.trim(),
                            customerNameText.trim(),
                            notesText.trim(),
                        )
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
                        text = if (isActionLoading) "Saving..." else "Save Sale",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SaleMetricRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            color = Color(0xFF6B7280),
            fontSize = 12.sp,
        )
        Text(
            text = value,
            color = TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

private fun formatDecimalInput(value: Double): String {
    if (value <= 0.0) {
        return ""
    }
    return String.format("%.4f", value).trimEnd('0').trimEnd('.')
}

private fun parseMetricFromNotes(
    notes: String?,
    key: String,
): Double? {
    if (notes.isNullOrBlank()) {
        return null
    }

    val line =
        notes.lines().firstOrNull { entry ->
            entry.trim().startsWith("$key:", ignoreCase = true)
        } ?: return null

    val rawValue = line.substringAfter(':', "").trim().replace(",", "")
    return rawValue.toDoubleOrNull()
}

private fun parseTextFromNotes(
    notes: String?,
    key: String,
): String? {
    if (notes.isNullOrBlank()) {
        return null
    }

    val line =
        notes.lines().firstOrNull { entry ->
            entry.trim().startsWith("$key:", ignoreCase = true)
        } ?: return null

    return line.substringAfter(':', "").trim().ifBlank { null }
}

private fun clampCookedSaleQtyText(
    rawValue: String,
    maxQty: Double,
): String {
    val parsed = rawValue.toDoubleOrNull() ?: return rawValue
    val safeMax = maxQty.coerceAtLeast(0.0)
    if (parsed <= safeMax) {
        return rawValue
    }

    val rounded = String.format(Locale.US, "%.4f", safeMax)
    return rounded.trimEnd('0').trimEnd('.').ifBlank { "0" }
}

private data class ProductionSourceStock(
    val quantity: Double,
    val unit: String,
)

private fun resolveProductionSourceStock(
    inventoryVariants: List<InventoryVariant>,
    weighProducts: Map<String, WeighLandingProduct?>,
    runType: String,
): ProductionSourceStock {
    val sourceTypeKey = if (runType == "uncooked_to_cooked") "uncooked_copra" else "coconut"
    val productId =
        weighProducts.entries.firstOrNull { (key, _) ->
            canonicalWeighTypeKey(key) == canonicalWeighTypeKey(sourceTypeKey)
        }?.value?.id

    val matchedByProductId =
        if (productId != null) {
            inventoryVariants.filter { it.product.id == productId }
        } else {
            emptyList()
        }
    val matched =
        if (matchedByProductId.isNotEmpty()) {
            matchedByProductId
        } else {
            inventoryVariants.filter { variant ->
                val searchable = "${variant.product.name} ${variant.description.orEmpty()}".lowercase(Locale.ROOT)
                if (sourceTypeKey == "coconut") {
                    searchable.contains("coconut") && !searchable.contains("copra")
                } else {
                    searchable.contains("uncooked")
                }
            }
        }

    val quantity = matched.sumOf { (it.inventory?.quantityOnHand ?: 0.0).coerceAtLeast(0.0) }
    val unit =
        matched.firstNotNullOfOrNull { variant ->
            variant.product.baseUnit?.trim()?.takeIf { it.isNotBlank() }
        } ?: if (sourceTypeKey == "coconut") "pcs" else "kg"

    return ProductionSourceStock(quantity = quantity, unit = unit)
}

private fun clampInputQtyText(
    rawValue: String,
    maxQty: Double,
    unit: String,
): String {
    val parsed = rawValue.toDoubleOrNull() ?: return rawValue
    val safeMax = maxQty.coerceAtLeast(0.0)
    if (parsed <= safeMax) {
        return rawValue
    }
    return formatInputQtyForField(safeMax, unit)
}

private fun formatInputQtyForField(
    value: Double,
    unit: String,
): String {
    val safeValue = value.coerceAtLeast(0.0)
    val normalizedUnit = unit.trim().lowercase(Locale.ROOT)
    if (normalizedUnit == "pc" || normalizedUnit == "pcs" || normalizedUnit == "piece" || normalizedUnit == "pieces") {
        return safeValue.toLong().toString()
    }
    val rounded = String.format(Locale.US, "%.4f", safeValue)
    return rounded.trimEnd('0').trimEnd('.').ifBlank { "0" }
}

private fun canonicalWeighTypeKey(value: String): String {
    return value
        .trim()
        .lowercase(Locale.ROOT)
        .replace('-', '_')
        .replace(' ', '_')
}
