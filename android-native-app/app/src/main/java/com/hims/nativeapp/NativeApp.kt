package com.hims.nativeapp

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hims.nativeapp.data.model.WeighInTransaction
import com.hims.nativeapp.ui.AppTab
import com.hims.nativeapp.ui.AppUiState
import com.hims.nativeapp.ui.components.BottomNavBar
import com.hims.nativeapp.ui.components.SearchTopPanel
import com.hims.nativeapp.ui.components.TabFiltersDialog
import com.hims.nativeapp.ui.screens.DashboardScreen
import com.hims.nativeapp.ui.screens.DeliveryMenuScreen
import com.hims.nativeapp.ui.screens.DeliveryScreen
import com.hims.nativeapp.ui.screens.InventoryScreen
import com.hims.nativeapp.ui.screens.LoginScreen
import com.hims.nativeapp.ui.screens.MoreMenuSheetContent
import com.hims.nativeapp.ui.screens.MoreScreen
import com.hims.nativeapp.ui.screens.PosScreen
import com.hims.nativeapp.ui.screens.ProductMenuScreen
import com.hims.nativeapp.ui.screens.ProductionMenuScreen
import com.hims.nativeapp.ui.screens.SalesScreen
import com.hims.nativeapp.ui.screens.SalesReportScreen
import com.hims.nativeapp.ui.screens.WeighMenuScreen
import com.hims.nativeapp.ui.screens.WeighReportScreen
import com.hims.nativeapp.ui.screens.WeighScreen
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.formatTimeLabel
import com.hims.nativeapp.util.sharePlainText

@OptIn(ExperimentalMaterialApi::class, ExperimentalMaterial3Api::class)
@Composable
fun HimsNativeApp(viewModel: MainViewModel = viewModel()) {
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    var showFiltersDialog by remember { mutableStateOf(false) }
    var isFullscreenMode by remember { mutableStateOf(false) }
    var isInventoryHistoryMode by remember { mutableStateOf(false) }
    var showMoreSheet by remember { mutableStateOf(false) }
    var showSalesReportScreen by remember { mutableStateOf(false) }
    var showWeighReportScreen by remember { mutableStateOf(false) }
    var openWeighManagePricesKey by remember { mutableStateOf(0) }
    var showLogoutConfirm by remember { mutableStateOf(false) }
    val moreSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val normalizedRole = state.userRole?.trim()?.lowercase()
    val isAdmin = normalizedRole in setOf("admin", "administrator", "owner", "manager")
    val isStaff = normalizedRole in setOf("staff", "cashier", "employee")

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            if (it.contains("deactivat", ignoreCase = true)) {
                viewModel.showDeactivationPrompt(it)
                return@let
            }
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }
    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccess()
        }
    }

    LaunchedEffect(isFullscreenMode) {
        if (isFullscreenMode) {
            showFiltersDialog = false
        }
    }
    LaunchedEffect(isInventoryHistoryMode) {
        if (isInventoryHistoryMode) {
            showFiltersDialog = false
        }
    }
    LaunchedEffect(state.selectedTab) {
        if (state.selectedTab != AppTab.INVENTORY && isInventoryHistoryMode) {
            isInventoryHistoryMode = false
        }
        if (state.selectedTab != AppTab.MORE) {
            showMoreSheet = false
        }
        if (state.selectedTab != AppTab.DASHBOARD) {
            showSalesReportScreen = false
            showWeighReportScreen = false
        }
    }

    if (!state.isAuthenticated) {
        LoginScreen(
            isLoading = state.isLoading,
            onLogin = viewModel::login,
        )
        return
    }

    if (state.isLoading && state.products.isEmpty() && state.sales.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().background(AppBackground),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator()
        }
        return
    }

    val searchPlaceholder =
        when (state.selectedTab) {
            AppTab.POS -> "Search products..."
            AppTab.DELIVERY -> "Search deliveries..."
            AppTab.SALES -> "Search by sale number..."
            AppTab.WEIGH -> "Search weigh-ins..."
            AppTab.MORE -> "Search..."
            AppTab.INVENTORY -> "Search inventory..."
            AppTab.DELIVERY_MENU -> "Search deliveries..."
            AppTab.PRODUCT_MENU -> "Search products..."
            AppTab.WEIGH_MENU -> "Search weigh-ins..."
            AppTab.PRODUCTION_MENU -> ""
            AppTab.DASHBOARD -> "Search..."
        }
    val refreshThreshold = LocalConfiguration.current.screenHeightDp.dp * 0.20f
    val pullRefreshState =
        rememberPullRefreshState(
            refreshing = state.isRefreshing,
            onRefresh = {
                if (showSalesReportScreen && state.selectedTab == AppTab.DASHBOARD) {
                    viewModel.refreshSalesReport()
                } else if (showWeighReportScreen && state.selectedTab == AppTab.DASHBOARD) {
                    viewModel.refreshWeighReport()
                } else {
                    viewModel.refreshCurrentTab()
                }
            },
            refreshThreshold = refreshThreshold,
            refreshingOffset = 64.dp,
        )

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            AnimatedVisibility(
                visible =
                    !isFullscreenMode &&
                        !isInventoryHistoryMode &&
                        state.selectedTab != AppTab.DASHBOARD &&
                        state.selectedTab != AppTab.PRODUCTION_MENU,
                enter = fadeIn(animationSpec = tween(220)) + slideInVertically(animationSpec = tween(220)) { -it / 2 },
                exit = fadeOut(animationSpec = tween(180)) + slideOutVertically(animationSpec = tween(180)) { -it / 2 },
            ) {
                SearchTopPanel(
                    placeholder = searchPlaceholder,
                    value = state.searchQuery,
                    onValueChange = viewModel::updateSearch,
                    onFilterClick = { showFiltersDialog = true },
                    showFilterButton =
                            state.selectedTab != AppTab.MORE &&
                            state.selectedTab != AppTab.DELIVERY_MENU &&
                            state.selectedTab != AppTab.WEIGH_MENU &&
                            state.selectedTab != AppTab.PRODUCTION_MENU &&
                            state.selectedTab != AppTab.DASHBOARD,
                    isFilterActive = hasActiveFilters(state),
                    actionIcon = if (state.selectedTab == AppTab.WEIGH_MENU && isAdmin) Icons.Outlined.Settings else null,
                    actionContentDescription = "Manage prices",
                    onActionClick =
                        if (state.selectedTab == AppTab.WEIGH_MENU && isAdmin) {
                            { openWeighManagePricesKey += 1 }
                        } else {
                            null
                        },
                    isActionActive = state.selectedTab == AppTab.WEIGH_MENU && isAdmin,
                )
            }
        },
        bottomBar = {
            AnimatedVisibility(
                visible =
                    !isFullscreenMode &&
                        (state.selectedTab != AppTab.INVENTORY || !isInventoryHistoryMode),
                enter = fadeIn(animationSpec = tween(220)) + slideInVertically(animationSpec = tween(220)) { it / 2 },
                exit = fadeOut(animationSpec = tween(180)) + slideOutVertically(animationSpec = tween(180)) { it / 2 },
            ) {
                BottomNavBar(
                    selectedTab = state.selectedTab,
                    onSelect = { tab ->
                        if (tab == AppTab.MORE) {
                            showMoreSheet = true
                        } else {
                            showMoreSheet = false
                            viewModel.selectTab(tab)
                        }
                    },
                    deliveryPendingCount = state.deliveryQueue.count { it.status.equals("PENDING", ignoreCase = true) },
                    weighUnpaidCount = state.unpaidWeighTransactions.size,
                )
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        },
    ) { paddingValues ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .pullRefresh(state = pullRefreshState, enabled = !isFullscreenMode)
                    .background(AppBackground),
        ) {
            when (state.selectedTab) {
                AppTab.POS -> {
                    PosScreen(
                        products = state.products,
                        searchQuery = state.searchQuery,
                        posCategoryFilter = state.posCategoryFilter,
                        cartItems = state.posCartItems,
                        isActionLoading = state.isActionLoading,
                        onAddToCart = viewModel::addPosProductToCart,
                        onUpdateCartQuantity = viewModel::updatePosCartQuantity,
                        onSetCartQuantity = viewModel::setPosCartQuantity,
                        onSetCartUnitPrice = viewModel::setPosCartUnitPrice,
                        onRemoveCartItem = viewModel::removePosCartItem,
                        onClearCart = viewModel::clearPosCart,
                        onFullscreenModeChange = { isFullscreenMode = it },
                        onCheckout = { pin, paymentAmount, paymentMethod, notes, isForDelivery, deliveryName, deliveryAddress, deliveryContact, onSuccess ->
                            viewModel.checkoutPosCart(
                                pin = pin,
                                paymentAmount = paymentAmount,
                                paymentMethod = paymentMethod,
                                notes = notes,
                                isForDelivery = isForDelivery,
                                deliveryName = deliveryName,
                                deliveryAddress = deliveryAddress,
                                deliveryContact = deliveryContact,
                                onSuccess = { saleId ->
                                    onSuccess()
                                    if (saleId > 0) {
                                        viewModel.fetchSaleReceiptText(saleId) { receiptText ->
                                            sharePlainText(
                                                context = context,
                                                title = "Share Sale Receipt",
                                                text = receiptText,
                                            )
                                        }
                                    }
                                },
                            )
                        },
                    )
                }
                AppTab.DELIVERY -> {
                    DeliveryScreen(
                        deliveries = state.deliveryQueue,
                        searchQuery = state.searchQuery,
                        expandedIds = state.expandedDeliveryIds,
                        isActionLoading = state.isActionLoading,
                        onToggleExpand = viewModel::toggleDeliveryExpanded,
                        cartItems = state.deliveryCartItems,
                        onToggleCart = viewModel::toggleDeliveryCart,
                        onUpdateCartQuantity = viewModel::updateDeliveryCartQuantity,
                        onSetCartQuantity = viewModel::setDeliveryCartQuantity,
                        onRemoveCartItem = viewModel::removeDeliveryCartItem,
                        onClearCart = viewModel::clearDeliveryCart,
                        onProcessCart = { pin, notes, onSuccess ->
                            viewModel.processDeliveryCart(
                                pin = pin,
                                notes = notes,
                                onSuccess = { deliveryId ->
                                    onSuccess()
                                    viewModel.fetchDeliveryReceiptText(deliveryId) { receiptText ->
                                        sharePlainText(
                                            context = context,
                                            title = "Share Delivery Receipt",
                                            text = receiptText,
                                        )
                                    }
                                },
                            )
                        },
                        openCartSignal = state.deliveryCartOpenSignal,
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.SALES -> {
                    SalesScreen(
                        sales = state.sales,
                        canManageAdminActions = isAdmin,
                        searchQuery = state.searchQuery,
                        expandedIds = state.expandedSaleIds,
                        isActionLoading = state.isActionLoading,
                        onToggleExpand = viewModel::toggleSaleExpanded,
                        onPrintReceipt = { saleId ->
                            viewModel.fetchSaleReceiptText(saleId) { receiptText ->
                                sharePlainText(
                                    context = context,
                                    title = "Share Sale Receipt",
                                    text = receiptText,
                                )
                            }
                        },
                        onFetchSaleDetails = viewModel::fetchSaleDetails,
                        onSubmitDelivery = viewModel::submitSaleDelivery,
                        onOpenDeliveryCart = viewModel::openDeliveryCartFromSale,
                        onFetchRefundDetails = viewModel::fetchRefundDetails,
                        onSubmitRefund = viewModel::createSaleRefund,
                        onAddPayment = viewModel::addPaymentToSale,
                        onCancelSaleItem = viewModel::cancelSaleItem,
                        onVoidSale = viewModel::voidSale,
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.WEIGH -> {
                    WeighScreen(
                        searchQuery = state.searchQuery,
                        weighPrices = state.weighPrices,
                        weighProducts = state.weighProducts,
                        unpaidTransactions = state.unpaidWeighTransactions,
                        draftItems = state.weighDraftItems,
                        isActionLoading = state.isActionLoading,
                        onAddTypeToDraft = viewModel::addWeighTypeToDraft,
                        onUpdateDraftWeight = viewModel::updateWeighDraftWeight,
                        onUpdateDraftCount = viewModel::updateWeighDraftCount,
                        onUpdateDraftUnitPrice = viewModel::updateWeighDraftUnitPrice,
                        onRemoveDraftItem = viewModel::removeWeighDraftItem,
                        onClearDraft = viewModel::clearWeighDraft,
                        onProcessDraft = { pin, onSuccess ->
                            viewModel.processWeighDraft(
                                pin = pin,
                                onSuccess = { transaction ->
                                    onSuccess()
                                    sharePlainText(
                                        context = context,
                                        title = "Share Weigh-In Receipt",
                                        text = buildWeighReceiptText(transaction),
                                    )
                                },
                            )
                        },
                        onMarkPaid = viewModel::markUnpaidWeighTransactionPaid,
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.MORE -> {
                    MoreScreen(
                        userName = state.userName,
                        userRole = state.userRole,
                        isAdmin = isAdmin,
                        isStaff = isStaff,
                        onOpenInventory = { viewModel.selectTab(AppTab.INVENTORY) },
                        onOpenProducts = { viewModel.selectTab(AppTab.PRODUCT_MENU) },
                        onOpenDeliveries = { viewModel.selectTab(AppTab.DELIVERY_MENU) },
                        onOpenWeighIns = { viewModel.selectTab(AppTab.WEIGH_MENU) },
                        onOpenProduction = { viewModel.selectTab(AppTab.PRODUCTION_MENU) },
                        onOpenDashboard = { viewModel.selectTab(AppTab.DASHBOARD) },
                        onLogout = { showLogoutConfirm = true },
                    )
                }
                AppTab.INVENTORY -> {
                    InventoryScreen(
                        variants = state.inventoryVariants,
                        dashboard = state.inventoryDashboard,
                        movements = state.inventoryMovements,
                        categories = state.inventoryCategories,
                        searchQuery = state.searchQuery,
                        isActionLoading = state.isActionLoading,
                        selectedCategoryId = state.inventoryCategoryFilter,
                        lowStockOnly = state.inventoryLowStockOnly,
                        onStockIn = { variantId, quantity, unitCost, unitPrice, applyPriceMode, notes, onSuccess ->
                            viewModel.stockInInventoryVariant(
                                variantId = variantId,
                                quantity = quantity,
                                unitCost = unitCost,
                                unitPrice = unitPrice,
                                applyPriceMode = applyPriceMode,
                                notes = notes,
                                onSuccess = onSuccess,
                            )
                        },
                        onAdjust = { variantId, quantity, type, reason, notes, onSuccess ->
                            viewModel.adjustInventoryVariant(
                                variantId = variantId,
                                quantity = quantity,
                                type = type,
                                reason = reason,
                                notes = notes,
                                onSuccess = onSuccess,
                            )
                        },
                        onHistoryModeChange = { isInventoryHistoryMode = it },
                        onBack = { showMoreSheet = true },
                    )
                }
                AppTab.DELIVERY_MENU -> {
                    DeliveryMenuScreen(
                        deliveries = state.deliveries,
                        allDeliveries = state.deliveries,
                        searchQuery = state.searchQuery,
                        expandedIds = state.expandedDeliveryIds,
                        onToggleExpand = viewModel::toggleDeliveryExpanded,
                        onFetchDeliveryDetails = viewModel::fetchDeliveryDetails,
                        onPrintDelivery = { deliveryId ->
                            viewModel.fetchDeliveryReceiptText(deliveryId) { receiptText ->
                                sharePlainText(
                                    context = context,
                                    title = "Share Delivery Receipt",
                                    text = receiptText,
                                )
                            }
                        },
                        onBack = { showMoreSheet = true },
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.PRODUCT_MENU -> {
                    ProductMenuScreen(
                        products = state.productMenuItems,
                        categories = state.inventoryCategories,
                        searchQuery = state.searchQuery,
                        selectedCategoryId = state.productCategoryFilter,
                        activeFilter = state.productActiveFilter,
                        isActionLoading = state.isActionLoading,
                        onCreateProduct = viewModel::createProduct,
                        onUpdateProduct = viewModel::updateProduct,
                        onToggleStock = viewModel::toggleProductStock,
                        onToggleActive = viewModel::toggleProductActive,
                        onAddVariant = viewModel::addProductVariant,
                        onUpdateVariant = viewModel::updateProductVariant,
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.WEIGH_MENU -> {
                    WeighMenuScreen(
                        transactions = state.weighIns,
                        canManagePrices = isAdmin,
                        weighPrices = state.weighPrices,
                        weighProducts = state.weighProducts,
                        searchQuery = state.searchQuery,
                        isActionLoading = state.isActionLoading,
                        onMarkPaid = viewModel::markUnpaidWeighTransactionPaid,
                        onUpdatePrice = viewModel::updateWeighPrices,
                        onPrint = { transaction ->
                            sharePlainText(
                                context = context,
                                title = "Share Weigh-In Receipt",
                                text = buildWeighReceiptText(transaction),
                            )
                        },
                        openManagePricesRequestKey = openWeighManagePricesKey,
                        onConsumeManagePricesRequest = { openWeighManagePricesKey = 0 },
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.PRODUCTION_MENU -> {
                    ProductionMenuScreen(
                        runs = state.productionRuns,
                        inventoryVariants = state.inventoryVariants,
                        weighProducts = state.weighProducts,
                        cookedCopraSummary = state.cookedCopraStockSummary,
                        isActionLoading = state.isActionLoading,
                        onCreateRun = { runType, inputQty, outputWeightKg, productionDate, operator, supplierSource, dryingMethod, notes, onSuccess ->
                            viewModel.createProductionRun(
                                runType = runType,
                                inputQty = inputQty,
                                outputWeightKg = outputWeightKg,
                                productionDate = productionDate,
                                operator = operator,
                                supplierSource = supplierSource,
                                dryingMethod = dryingMethod,
                                notes = notes,
                                onSuccess = onSuccess,
                            )
                        },
                        onSellCookedCopra = { quantityKg, unitPrice, saleDate, customerName, notes, onSuccess ->
                            viewModel.createCookedCopraSale(
                                quantityKg = quantityKg,
                                unitPrice = unitPrice,
                                saleDate = saleDate,
                                customerName = customerName,
                                notes = notes,
                                onSuccess = { _ -> onSuccess() },
                            )
                        },
                        onBack = { showMoreSheet = true },
                        onFullscreenModeChange = { isFullscreenMode = it },
                    )
                }
                AppTab.DASHBOARD -> {
                    if (showSalesReportScreen) {
                        SalesReportScreen(
                            reportData = state.salesReportData,
                            statusFilter = state.salesReportStatusFilter,
                            dateFrom = state.salesReportDateFrom,
                            dateTo = state.salesReportDateTo,
                            isLoading = state.isRefreshing,
                            onApplyFilters = { status, dateFrom, dateTo ->
                                viewModel.applySalesReportFilters(
                                    status = status,
                                    dateFrom = dateFrom,
                                    dateTo = dateTo,
                                )
                            },
                            onBack = { showSalesReportScreen = false },
                        )
                    } else if (showWeighReportScreen) {
                        WeighReportScreen(
                            transactions = state.weighReportTransactions,
                            typeFilter = state.weighReportTypeFilter,
                            statusFilter = state.weighReportStatusFilter,
                            dateFrom = state.weighReportDateFrom,
                            dateTo = state.weighReportDateTo,
                            isLoading = state.isRefreshing,
                            onApplyFilters = { type, status, dateFrom, dateTo ->
                                viewModel.applyWeighReportFilters(
                                    type = type,
                                    status = status,
                                    dateFrom = dateFrom,
                                    dateTo = dateTo,
                                )
                            },
                            onBack = { showWeighReportScreen = false },
                        )
                    } else {
                        DashboardScreen(
                            dashboard = state.dashboardData,
                            inventoryDashboard = state.inventoryDashboard,
                            isRefreshing = state.isRefreshing,
                            accessDenied = state.dashboardAccessDenied,
                            statusMessage = state.dashboardStatusMessage,
                            onOpenSalesReport = {
                                viewModel.refreshSalesReport()
                                showWeighReportScreen = false
                                showSalesReportScreen = true
                            },
                            onOpenWeighReport = {
                                viewModel.refreshWeighReport()
                                showSalesReportScreen = false
                                showWeighReportScreen = true
                            },
                        )
                    }
                }
            }

            if (state.isOfflineMode) {
                Text(
                    text = "OFFLINE",
                    color = Color.White,
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 10.dp, end = 10.dp)
                            .background(Color(0xFFB00020), RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }

            PullRefreshIndicator(
                refreshing = state.isRefreshing,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }
    }

    if (showFiltersDialog && !isFullscreenMode && !isInventoryHistoryMode) {
        TabFiltersDialog(
            selectedTab = state.selectedTab,
            state = state,
            onDismiss = { showFiltersDialog = false },
            onApplyPos = viewModel::applyPosFilter,
            onClearPos = viewModel::clearPosFilter,
            onApplySales = viewModel::applySalesFilters,
            onClearSales = viewModel::clearSalesFilters,
            onApplyDelivery = viewModel::applyDeliveryFilters,
            onClearDelivery = viewModel::clearDeliveryFilters,
            onApplyWeigh = viewModel::applyWeighFilters,
            onClearWeigh = viewModel::clearWeighFilters,
            onApplyInventory = viewModel::applyInventoryFilters,
            onClearInventory = viewModel::clearInventoryFilters,
            onApplyProduct = viewModel::applyProductFilters,
            onClearProduct = viewModel::clearProductFilters,
        )
    }

    if (showMoreSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMoreSheet = false },
            sheetState = moreSheetState,
        ) {
            MoreMenuSheetContent(
                userName = state.userName,
                userRole = state.userRole,
                isAdmin = isAdmin,
                isStaff = isStaff,
                onOpenInventory = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.INVENTORY)
                },
                onOpenProducts = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.PRODUCT_MENU)
                },
                onOpenDeliveries = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.DELIVERY_MENU)
                },
                onOpenWeighIns = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.WEIGH_MENU)
                },
                onOpenProduction = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.PRODUCTION_MENU)
                },
                onOpenDashboard = {
                    showMoreSheet = false
                    viewModel.selectTab(AppTab.DASHBOARD)
                },
                onLogout = {
                    showMoreSheet = false
                    showLogoutConfirm = true
                },
            )
        }
    }

    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Confirm Logout") },
            text = { Text("Are you sure you want to logout?") },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) {
                    Text("Cancel")
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLogoutConfirm = false
                        viewModel.logout()
                    },
                ) {
                    Text("Logout")
                }
            },
        )
    }

    state.deactivationMessage?.let { message ->
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Account Deactivated") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = viewModel::acknowledgeDeactivationAndLogout) {
                    Text("OK")
                }
            },
        )
    }
}

private fun hasActiveFilters(state: AppUiState): Boolean {
    return when (state.selectedTab) {
        AppTab.POS -> state.posCategoryFilter != null
        AppTab.SALES ->
            state.salesStatusFilter != "all" ||
                state.salesPaymentStatusFilter != "all" ||
                state.salesDeliveryStatusFilter != "all" ||
                state.salesDateFrom.isNotBlank() ||
                state.salesDateTo.isNotBlank()
        AppTab.DELIVERY ->
            state.deliveryStatusFilter != "all" ||
                state.deliveryDateFrom.isNotBlank() ||
                state.deliveryDateTo.isNotBlank()
        AppTab.WEIGH ->
            state.weighTypeFilter != "all" ||
                state.weighStatusFilter != "all" ||
                state.weighDateFrom.isNotBlank() ||
                state.weighDateTo.isNotBlank()
        AppTab.INVENTORY ->
            state.inventoryCategoryFilter != null ||
                state.inventoryLowStockOnly
        AppTab.PRODUCT_MENU ->
            state.productCategoryFilter != null ||
                state.productActiveFilter != "all"
        AppTab.DELIVERY_MENU,
        AppTab.WEIGH_MENU,
        AppTab.PRODUCTION_MENU,
        AppTab.DASHBOARD,
        AppTab.MORE,
        -> false
    }
}

private fun buildWeighReceiptText(transaction: WeighInTransaction): String {
    val refValue = transaction.refNum ?: "WIT-${transaction.id}"
    val weighedAt = transaction.weighedAt ?: transaction.createdAt.orEmpty()
    val lines = mutableListOf<String>()
    lines += "HIMS Weigh-In Receipt"
    lines += "Ref: $refValue"
    if (!transaction.supplierName.isNullOrBlank()) {
        lines += "Supplier: ${transaction.supplierName}"
    }
    lines += "Status: ${transaction.status?.replaceFirstChar { it.uppercaseChar() } ?: "-"}"
    lines += "Weighed by: ${transaction.weighedBy?.name ?: "-"}"
    if (weighedAt.isNotBlank()) {
        lines += "Date/Time: ${formatTimeLabel(weighedAt)}"
    }
    lines += ""
    lines += "Items:"
    transaction.weighIns.forEachIndexed { index, item ->
        val typeLabel =
            when (item.type?.trim()?.lowercase()) {
                "cooked_copra" -> "Cooked Copra"
                "uncooked_copra" -> "Uncooked Copra"
                "coconut" -> "Coconut"
                "bagol" -> "Bagol"
                else -> item.type.orEmpty().replace('_', ' ').replaceFirstChar { it.uppercaseChar() }
            }
        val qtyLabel =
            if (item.type == "coconut") {
                "${formatQty(item.count ?: 0.0)} pcs"
            } else {
                "${formatQty(item.weightKg ?: 0.0)} kg"
            }
        lines += "${index + 1}. $typeLabel - $qtyLabel - ${formatPeso(item.totalAmount)}"
    }
    lines += ""
    lines += "Total: ${formatPeso(transaction.totalAmount)}"
    return lines.joinToString(separator = "\n")
}
