package com.hims.nativeapp

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.hims.nativeapp.core.DataInvalidationManager
import com.hims.nativeapp.core.GlobalEvent
import com.hims.nativeapp.core.GlobalEventBus
import com.hims.nativeapp.core.RefreshKeys
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.model.AddDeliveryRequest
import com.hims.nativeapp.data.model.AddPaymentRequest
import com.hims.nativeapp.data.model.CancelSaleItemRequest
import com.hims.nativeapp.data.model.CookedCopraSaleRequest
import com.hims.nativeapp.data.model.Delivery
import com.hims.nativeapp.data.model.DeliveryForSaleData
import com.hims.nativeapp.data.model.DeliveryItem
import com.hims.nativeapp.data.model.DeliverySale
import com.hims.nativeapp.data.model.InventoryAdjustRequest
import com.hims.nativeapp.data.model.LoginRequest
import com.hims.nativeapp.data.model.OutboxSaleCreateRequest
import com.hims.nativeapp.data.model.OutboxSaleItemRequest
import com.hims.nativeapp.data.model.OutboxStockMovementCreateRequest
import com.hims.nativeapp.data.model.PinRequest
import com.hims.nativeapp.data.model.PosCheckoutItemRequest
import com.hims.nativeapp.data.model.PosCheckoutRequest
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.data.model.ProductUpsertRequest
import com.hims.nativeapp.data.model.ProductVariant
import com.hims.nativeapp.data.model.ProductVariantUpsertRequest
import com.hims.nativeapp.data.model.ProductionRunRequest
import com.hims.nativeapp.data.model.RefundForSaleData
import com.hims.nativeapp.data.model.RefundItemRequest
import com.hims.nativeapp.data.model.Sale
import com.hims.nativeapp.data.model.SaleItemQuantityRequest
import com.hims.nativeapp.data.model.StockInItemRequest
import com.hims.nativeapp.data.model.StockInRequest
import com.hims.nativeapp.data.model.VoidSaleRequest
import com.hims.nativeapp.data.model.WeighBatchItemRequest
import com.hims.nativeapp.data.model.WeighBatchStoreRequest
import com.hims.nativeapp.data.model.WeighPriceUpdateRequest
import com.hims.nativeapp.data.model.WeighInTransaction
import com.hims.nativeapp.data.network.ApiClient
import com.hims.nativeapp.data.network.SessionStore
import com.hims.nativeapp.data.repository.BootstrapSnapshot
import com.hims.nativeapp.data.repository.BootstrapRepository
import com.hims.nativeapp.data.repository.DashboardRepository
import com.hims.nativeapp.data.repository.InventoryRepository
import com.hims.nativeapp.data.repository.InventorySummaryQuery
import com.hims.nativeapp.data.repository.OutboxEventTypes
import com.hims.nativeapp.data.repository.OutboxRepository
import com.hims.nativeapp.data.repository.PosRepository
import com.hims.nativeapp.data.repository.SalesListQuery
import com.hims.nativeapp.data.repository.SalesRepository
import com.hims.nativeapp.domain.DomainAction
import com.hims.nativeapp.domain.EmitImpact
import com.hims.nativeapp.startup.StartupCoordinator
import com.hims.nativeapp.startup.StartupState
import com.hims.nativeapp.ui.AppTab
import com.hims.nativeapp.ui.AppUiState
import com.hims.nativeapp.ui.DeliveryCartItem
import com.hims.nativeapp.ui.PosCartItem
import com.hims.nativeapp.ui.WeighDraftItem
import com.hims.nativeapp.ui.WeighCartItem
import com.hims.nativeapp.util.formatQty
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import java.io.IOException
import java.util.UUID
import org.json.JSONObject
import retrofit2.HttpException

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val deactivatedAccountMessage = "Your account has been deactivated. Contact an administrator."
    private val autoRefreshDebounceMs = 400L
    private val receiptCharWidth = 48
    private val receiptSeparatorChar = '-'
    private val receiptSeparatorChars = setOf('-', '=', '.', '_')

    private val sessionStore = SessionStore(application)
    private val api = ApiClient.create(sessionStore)
    private val gson = Gson()
    private val cacheDb = AppDatabase.getInstance(application)
    private val invalidationManager = DataInvalidationManager
    private val globalEventBus = GlobalEventBus
    private val bootstrapRepository = BootstrapRepository(api, cacheDb, gson)
    private val outboxRepository = OutboxRepository(api, cacheDb, gson)
    private val posRepository = PosRepository(api, bootstrapRepository, invalidationManager)
    private val salesRepository = SalesRepository(api, invalidationManager, globalEventBus)
    private val inventoryRepository = InventoryRepository(api, invalidationManager)
    private val dashboardRepository = DashboardRepository(api, invalidationManager)
    private val startupCoordinator = StartupCoordinator(sessionStore, bootstrapRepository)
    private var startupCollectorAttached = false
    private var dashboardRefreshInFlight = false

    var uiState by mutableStateOf(
        AppUiState(
            isAuthenticated = !sessionStore.getToken().isNullOrBlank(),
            userName = sessionStore.getUserName(),
            userRole = canonicalizeRole(sessionStore.getUserRole()),
        ),
    )
        private set

    init {
        observeGlobalEvents()
        if (uiState.isAuthenticated) {
            attachStartupCoordinator()
        }
    }

    private fun triggerPostActionRefresh(
        action: DomainAction,
        entityId: Int? = null,
        affectedVariantIds: Set<Int> = emptySet(),
        reason: String = "local",
    ) {
        val keys = keysForAction(action = action, entityId = entityId, affectedVariantIds = affectedVariantIds)
        viewModelScope.launch {
            runCatching {
                EmitImpact.emit(
                    action = action,
                    reason = reason,
                    entityId = entityId,
                )
            }

            if (keys.isEmpty()) {
                return@launch
            }

            invalidationManager.invalidate(*keys.toTypedArray())
            globalEventBus.emit(
                GlobalEvent.DataInvalidated(
                    affectedKeys = keys,
                    reason = reason,
                    entityId = entityId,
                ),
            )

            when (action) {
                DomainAction.SALE_CREATED_DELIVERY,
                DomainAction.DELIVERY_MARKED_DELIVERED,
                -> refreshDeliveriesSilently()

                DomainAction.PRODUCT_UPDATED -> refreshProductsMenuSilently()
                DomainAction.WEIGH_IN_RECORDED -> refreshWeighInsSilently()
                else -> Unit
            }
        }
    }

    @OptIn(FlowPreview::class)
    private fun observeGlobalEvents() {
        viewModelScope.launch {
            globalEventBus.events
                .debounce(autoRefreshDebounceMs)
                .collect { event ->
                    when (event) {
                        is GlobalEvent.DataInvalidated -> refreshVisibleTabIfAffected(event.affectedKeys)
                        is GlobalEvent.RefundCompleted -> refreshVisibleTabIfAffected(event.affectedKeys)
                    }
                }
        }
    }

    private fun refreshVisibleTabIfAffected(affectedKeys: Set<String>) {
        if (affectedKeys.isEmpty()) {
            return
        }
        val currentTab = uiState.selectedTab
        if (!keysAffectTab(currentTab, affectedKeys)) {
            return
        }
        onScreenFocused(currentTab)
    }

    private fun keysAffectTab(
        tab: AppTab,
        keys: Set<String>,
    ): Boolean {
        return when (tab) {
            AppTab.POS -> keys.contains(RefreshKeys.POS_SUMMARY)
            AppTab.SALES -> keys.contains(RefreshKeys.SALES_LIST) || keys.any { key -> key.startsWith("SALE_DETAIL_") }
            AppTab.INVENTORY ->
                keys.contains(RefreshKeys.INVENTORY_SUMMARY) ||
                    keys.any { key -> key.startsWith(RefreshKeys.INVENTORY_PRODUCT_PREFIX) }
            AppTab.DASHBOARD -> keys.contains(RefreshKeys.DASHBOARD_METRICS)
            else -> false
        }
    }

    private fun keysForAction(
        action: DomainAction,
        entityId: Int?,
        affectedVariantIds: Set<Int>,
    ): Set<String> {
        val keys = mutableSetOf<String>()

        when (action) {
            DomainAction.SALE_COMPLETED_WALK_IN -> {
                keys += RefreshKeys.SALES_LIST
                keys += RefreshKeys.DASHBOARD_METRICS
                keys += RefreshKeys.POS_SUMMARY
                keys += RefreshKeys.INVENTORY_SUMMARY
            }

            DomainAction.SALE_CREATED_DELIVERY -> {
                keys += RefreshKeys.SALES_LIST
                keys += RefreshKeys.DASHBOARD_METRICS
                keys += RefreshKeys.POS_SUMMARY
            }

            DomainAction.SALE_PAYMENT_ADDED -> {
                keys += RefreshKeys.SALES_LIST
                keys += RefreshKeys.DASHBOARD_METRICS
            }

            DomainAction.SALE_REFUNDED,
            DomainAction.SALE_VOIDED,
            DomainAction.DELIVERY_MARKED_DELIVERED,
            -> {
                keys += RefreshKeys.SALES_LIST
                keys += RefreshKeys.DASHBOARD_METRICS
                keys += RefreshKeys.POS_SUMMARY
                keys += RefreshKeys.INVENTORY_SUMMARY
            }

            DomainAction.STOCK_ADJUSTMENT -> {
                keys += RefreshKeys.INVENTORY_SUMMARY
                keys += RefreshKeys.POS_SUMMARY
                keys += RefreshKeys.DASHBOARD_METRICS
            }

            DomainAction.PRODUCT_UPDATED -> {
                keys += RefreshKeys.INVENTORY_SUMMARY
                keys += RefreshKeys.POS_SUMMARY
            }

            DomainAction.WEIGH_IN_RECORDED -> {
                keys += RefreshKeys.DASHBOARD_METRICS
            }

            DomainAction.CUSTOMER_CREATED -> {
                keys += RefreshKeys.SALES_LIST
            }
        }

        if (entityId != null && action in setOf(
                DomainAction.SALE_COMPLETED_WALK_IN,
                DomainAction.SALE_CREATED_DELIVERY,
                DomainAction.SALE_PAYMENT_ADDED,
                DomainAction.SALE_REFUNDED,
                DomainAction.SALE_VOIDED,
            )
        ) {
            keys += RefreshKeys.saleDetail(entityId)
        }

        keys += affectedVariantIds.map { variantId -> RefreshKeys.inventoryProduct(variantId) }

        return keys
    }

    private fun attachStartupCoordinator() {
        if (startupCollectorAttached) {
            return
        }

        startupCollectorAttached = true

        viewModelScope.launch {
            startupCoordinator.state.collect { state ->
                when (state) {
                    StartupState.Loading -> {
                        uiState =
                            uiState.copy(
                                isLoading = uiState.products.isEmpty(),
                            )
                    }

                    StartupState.NeedsLogin -> {
                        logout()
                    }

                    is StartupState.Ready -> {
                        applyBootstrapSnapshot(
                            snapshot = state.snapshot,
                            offline = false,
                        )
                    }

                    is StartupState.OfflineReady -> {
                        applyBootstrapSnapshot(
                            snapshot = state.snapshot,
                            offline = true,
                        )
                    }

                    is StartupState.Failed -> {
                        uiState =
                            uiState.copy(
                                isLoading = false,
                                isOfflineMode = false,
                                errorMessage = state.message,
                            )
                    }
                }
            }
        }

        viewModelScope.launch {
            startupCoordinator.refreshing.collect { refreshing ->
                uiState = uiState.copy(isRefreshing = refreshing)
            }
        }

        viewModelScope.launch {
            startupCoordinator.ensureStarted()
        }
    }

    private fun applyBootstrapSnapshot(
        snapshot: BootstrapSnapshot,
        offline: Boolean,
    ) {
        val role = canonicalizeRole(snapshot.state.userRole)
        val token = sessionStore.getToken()
        if (!token.isNullOrBlank()) {
            sessionStore.saveSession(token, snapshot.state.userName, role)
        }

        val cachedCategories =
            snapshot.categories.map {
                ProductCategory(
                    id = it.id,
                    name = it.name,
                )
            }

        val offlineMessage =
            if (offline) {
                "Offline mode: showing last cached data."
            } else {
                null
            }

        posRepository.primeCache(snapshot.posSeed)

        uiState =
            uiState.copy(
                isLoading = false,
                isOfflineMode = offline,
                userName = snapshot.state.userName,
                userRole = role,
                products = snapshot.posSeed,
                inventoryCategories = cachedCategories,
                dashboardAccessDenied = false,
                dashboardStatusMessage = null,
                errorMessage = offlineMessage,
            )
    }

    fun updateSearch(value: String) {
        uiState = uiState.copy(searchQuery = value)
    }

    fun applyPosFilter(categoryId: Int?) {
        uiState = uiState.copy(posCategoryFilter = categoryId)
    }

    fun clearPosFilter() {
        uiState = uiState.copy(posCategoryFilter = null)
    }

    fun selectTab(tab: AppTab) {
        if (
            isCurrentUserStaff() &&
            (
                tab == AppTab.DASHBOARD ||
                    tab == AppTab.INVENTORY ||
                    tab == AppTab.PRODUCTION_MENU ||
                    tab == AppTab.PRODUCT_MENU
            )
        ) {
            uiState = uiState.copy(errorMessage = "This section is hidden for staff accounts.")
            return
        }
        if ((tab == AppTab.DASHBOARD || tab == AppTab.PRODUCTION_MENU) && !isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can access this section.")
            return
        }

        uiState = uiState.copy(selectedTab = tab, searchQuery = "")
        onScreenFocused(tab)
    }

    fun onScreenFocused(tab: AppTab = uiState.selectedTab) {
        if (!uiState.isAuthenticated) {
            return
        }
        when (tab) {
            AppTab.POS -> {
                if (uiState.products.isEmpty() || invalidationManager.isInvalid(RefreshKeys.POS_SUMMARY)) {
                    refreshPos(forceRefresh = false)
                }
            }

            AppTab.SALES -> {
                if (uiState.sales.isEmpty() || invalidationManager.isInvalid(RefreshKeys.SALES_LIST)) {
                    refreshSales(forceRefresh = false)
                }
            }

            AppTab.INVENTORY -> {
                if (uiState.inventoryVariants.isEmpty() || isInventoryStale()) {
                    refreshInventory(forceRefresh = false)
                }
            }

            AppTab.DASHBOARD -> {
                val showLoading =
                    uiState.dashboardData == null || invalidationManager.isInvalid(RefreshKeys.DASHBOARD_METRICS)
                refreshDashboard(forceRefresh = true, showLoading = showLoading)
            }

            AppTab.DELIVERY -> {
                if (uiState.deliveryQueue.isEmpty()) {
                    refreshDeliveries()
                }
            }

            AppTab.WEIGH -> {
                if (uiState.weighIns.isEmpty()) {
                    refreshWeighIns()
                }
            }

            AppTab.DELIVERY_MENU -> {
                if (uiState.deliveries.isEmpty() || uiState.deliveryQueue.isEmpty()) {
                    refreshDeliveries()
                }
            }

            AppTab.PRODUCT_MENU -> {
                if (uiState.productMenuItems.isEmpty()) {
                    refreshProductsMenu()
                }
            }

            AppTab.WEIGH_MENU -> {
                if (uiState.weighIns.isEmpty()) {
                    refreshWeighIns()
                }
            }

            AppTab.PRODUCTION_MENU -> {
                if (uiState.productionRuns.isEmpty()) {
                    refreshProductionRuns()
                }
            }

            AppTab.MORE -> Unit
        }
    }

    fun clearError() {
        uiState = uiState.copy(errorMessage = null)
    }

    fun showDeactivationPrompt(message: String?) {
        val resolvedMessage = message?.trim().orEmpty().ifBlank { deactivatedAccountMessage }
        uiState =
            uiState.copy(
                errorMessage = null,
                deactivationMessage = resolvedMessage,
            )
    }

    fun acknowledgeDeactivationAndLogout() {
        logout()
    }

    fun clearSuccess() {
        uiState = uiState.copy(successMessage = null)
    }

    fun showSuccess(message: String) {
        if (message.isBlank()) {
            return
        }
        uiState = uiState.copy(successMessage = message)
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            uiState = uiState.copy(errorMessage = "Email and password are required.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            try {
                val response = api.login(LoginRequest(email = email, password = password))
                val canonicalRole = canonicalizeRole(response.data.user.role)
                sessionStore.saveSession(response.data.token, response.data.user.name, canonicalRole)
                uiState =
                    uiState.copy(
                        isAuthenticated = true,
                        isLoading = false,
                        userName = response.data.user.name,
                        userRole = canonicalRole,
                    )
                attachStartupCoordinator()
                startupCoordinator.refresh(force = true)
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, errorMessage = networkErrorMessage(e))
            }
        }
    }

    fun logout() {
        sessionStore.clearSession()
        uiState = AppUiState()
    }

    fun refreshCurrentTab() {
        when (uiState.selectedTab) {
            AppTab.POS -> refreshPos(forceRefresh = true)
            AppTab.DELIVERY -> refreshDeliveries()
            AppTab.SALES -> refreshSales(forceRefresh = true)
            AppTab.WEIGH -> refreshWeighIns()
            AppTab.WEIGH_MENU -> refreshWeighIns()
            AppTab.INVENTORY -> refreshInventory(forceRefresh = true)
            AppTab.DELIVERY_MENU -> refreshDeliveries()
            AppTab.PRODUCT_MENU -> refreshProductsMenu()
            AppTab.PRODUCTION_MENU -> refreshProductionRuns()
            AppTab.DASHBOARD -> refreshDashboard(forceRefresh = true)
            AppTab.MORE -> {
                refreshAll()
            }
        }
    }

    private fun isInventoryStale(): Boolean {
        return invalidationManager.isInvalid(RefreshKeys.INVENTORY_SUMMARY) ||
            invalidationManager.hasInvalidWithPrefix(RefreshKeys.INVENTORY_PRODUCT_PREFIX)
    }

    private fun buildSalesQuery(): SalesListQuery =
        SalesListQuery(
            status = asQueryValue(uiState.salesStatusFilter),
            paymentStatus = asQueryValue(uiState.salesPaymentStatusFilter),
            deliveryStatus = asQueryValue(uiState.salesDeliveryStatusFilter),
            dateFrom = asDateQuery(uiState.salesDateFrom),
            dateTo = asDateQuery(uiState.salesDateTo),
        )

    fun refreshStartup(force: Boolean = true) {
        viewModelScope.launch {
            startupCoordinator.refresh(force = force)
        }
    }

    fun applySalesFilters(
        status: String,
        paymentStatus: String,
        deliveryStatus: String,
        dateFrom: String,
        dateTo: String,
    ) {
        uiState =
            uiState.copy(
                salesStatusFilter = status,
                salesPaymentStatusFilter = paymentStatus,
                salesDeliveryStatusFilter = deliveryStatus,
                salesDateFrom = dateFrom.trim(),
                salesDateTo = dateTo.trim(),
            )
        refreshSales(forceRefresh = true)
    }

    fun applySalesReportFilters(
        status: String,
        dateFrom: String,
        dateTo: String,
    ) {
        uiState =
            uiState.copy(
                salesReportStatusFilter = status,
                salesReportDateFrom = dateFrom.trim(),
                salesReportDateTo = dateTo.trim(),
            )
        refreshSalesReport()
    }

    fun applyWeighReportFilters(
        type: String,
        status: String,
        dateFrom: String,
        dateTo: String,
    ) {
        uiState =
            uiState.copy(
                weighReportTypeFilter = type,
                weighReportStatusFilter = status,
                weighReportDateFrom = dateFrom.trim(),
                weighReportDateTo = dateTo.trim(),
            )
        refreshWeighReport()
    }

    fun clearSalesFilters() {
        applySalesFilters(
            status = "all",
            paymentStatus = "all",
            deliveryStatus = "all",
            dateFrom = "",
            dateTo = "",
        )
    }

    fun applyDeliveryFilters(
        status: String,
        dateFrom: String,
        dateTo: String,
    ) {
        uiState =
            uiState.copy(
                deliveryStatusFilter = status,
                deliveryDateFrom = dateFrom.trim(),
                deliveryDateTo = dateTo.trim(),
            )
        refreshDeliveries()
    }

    fun clearDeliveryFilters() {
        applyDeliveryFilters(
            status = "all",
            dateFrom = "",
            dateTo = "",
        )
    }

    fun applyInventoryFilters(
        categoryId: Int?,
        lowStockOnly: Boolean,
    ) {
        uiState =
            uiState.copy(
                inventoryCategoryFilter = categoryId,
                inventoryLowStockOnly = lowStockOnly,
            )
        refreshInventory()
    }

    fun clearInventoryFilters() {
        applyInventoryFilters(
            categoryId = null,
            lowStockOnly = false,
        )
    }

    fun applyProductFilters(
        categoryId: Int?,
        activeFilter: String,
    ) {
        uiState =
            uiState.copy(
                productCategoryFilter = categoryId,
                productActiveFilter = activeFilter.trim().lowercase().ifBlank { "all" },
            )
    }

    fun clearProductFilters() {
        applyProductFilters(categoryId = null, activeFilter = "all")
    }

    fun stockInInventoryVariant(
        variantId: Int,
        quantity: Int,
        unitCost: Double,
        unitPrice: Double?,
        applyPriceMode: String,
        notes: String,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedApplyMode = applyPriceMode.trim().lowercase().ifBlank { "all" }
        if (quantity <= 0) {
            uiState = uiState.copy(errorMessage = "Quantity must be greater than zero.")
            return
        }
        if (unitCost <= 0.0) {
            uiState = uiState.copy(errorMessage = "Unit cost is required and must be greater than zero.")
            return
        }
        if (unitPrice != null && unitPrice < 0.0) {
            uiState = uiState.copy(errorMessage = "Unit price cannot be negative.")
            return
        }
        if (normalizedApplyMode !in setOf("all", "batch")) {
            uiState = uiState.copy(errorMessage = "Invalid unit price apply mode.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.stockInInventory(
                        StockInRequest(
                            items =
                                listOf(
                                    StockInItemRequest(
                                        productVariantId = variantId,
                                        quantity = quantity,
                                        unitCost = unitCost,
                                        unitPrice = unitPrice,
                                        priceApplyMode = if (unitPrice != null) normalizedApplyMode else null,
                                    ),
                                ),
                            notes = notes.ifBlank { null },
                        ),
                    )
                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          successMessage = response.message ?: "Stock added successfully.",
                      )
                  triggerPostActionRefresh(
                      action = DomainAction.STOCK_ADJUSTMENT,
                      entityId = variantId,
                      affectedVariantIds = setOf(variantId),
                  )
                  onSuccess()
            } catch (e: Exception) {
                if (isOfflineQueueableError(e)) {
                    val payload =
                        OutboxStockMovementCreateRequest(
                            clientRequestId = UUID.randomUUID().toString(),
                            productVariantId = variantId,
                            movementType = "IN",
                            qty = quantity.toDouble(),
                            reason = "stock_in",
                            notes = notes.ifBlank { null },
                            unitCost = unitCost,
                        )
                    outboxRepository.enqueueEvent(
                        type = OutboxEventTypes.STOCK_MOVEMENT_CREATE,
                        payloadJson = gson.toJson(payload),
                    )
                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            isOfflineMode = true,
                            successMessage = "No connection. Stock-in queued and will sync automatically.",
                        )
                } else {
                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            errorMessage = networkErrorMessage(e),
                        )
                }
            }
        }
    }

    fun adjustInventoryVariant(
        variantId: Int,
        quantity: Int,
        type: String,
        reason: String,
        notes: String,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedType = type.trim().uppercase()
        val normalizedReason = reason.trim().lowercase()
        val allowedReasons = setOf("adjustment", "damage", "loss", "found", "correction")

        if (quantity <= 0) {
            uiState = uiState.copy(errorMessage = "Quantity must be greater than zero.")
            return
        }
        if (normalizedType != "IN" && normalizedType != "OUT") {
            uiState = uiState.copy(errorMessage = "Invalid adjustment type.")
            return
        }
        if (!allowedReasons.contains(normalizedReason)) {
            uiState = uiState.copy(errorMessage = "Invalid adjustment reason.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.adjustInventory(
                        variantId = variantId,
                        request =
                            InventoryAdjustRequest(
                                quantity = quantity,
                                type = normalizedType,
                                reason = normalizedReason,
                                notes = notes.ifBlank { null },
                            ),
                    )
                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          successMessage = response.message ?: "Inventory adjusted successfully.",
                      )
                  triggerPostActionRefresh(
                      action = DomainAction.STOCK_ADJUSTMENT,
                      entityId = variantId,
                      affectedVariantIds = setOf(variantId),
                  )
                  onSuccess()
            } catch (e: Exception) {
                if (isOfflineQueueableError(e)) {
                    val payload =
                        OutboxStockMovementCreateRequest(
                            clientRequestId = UUID.randomUUID().toString(),
                            productVariantId = variantId,
                            movementType = normalizedType,
                            qty = quantity.toDouble(),
                            reason = normalizedReason,
                            notes = notes.ifBlank { null },
                            unitCost = null,
                        )
                    outboxRepository.enqueueEvent(
                        type = OutboxEventTypes.STOCK_MOVEMENT_CREATE,
                        payloadJson = gson.toJson(payload),
                    )
                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            isOfflineMode = true,
                            successMessage = "No connection. Inventory adjustment queued for sync.",
                        )
                } else {
                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            errorMessage = networkErrorMessage(e),
                        )
                }
            }
        }
    }

    fun createCookedCopraSale(
        quantityKg: Double,
        unitPrice: Double,
        saleDate: String,
        customerName: String,
        notes: String,
        onSuccess: (String) -> Unit = {},
    ) {
        if (quantityKg <= 0.0) {
            uiState = uiState.copy(errorMessage = "Quantity must be greater than zero.")
            return
        }
        if (unitPrice <= 0.0) {
            uiState = uiState.copy(errorMessage = "Unit price must be greater than zero.")
            return
        }

        val availableStock = uiState.cookedCopraStockSummary?.stock
        if (availableStock != null && quantityKg > availableStock + 0.000001) {
            uiState =
                uiState.copy(
                    errorMessage =
                        "Insufficient cooked copra stock. Available: ${formatQty(availableStock)} kg.",
                )
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.createCookedCopraSale(
                        CookedCopraSaleRequest(
                            quantity = quantityKg,
                            unitPrice = unitPrice,
                            saleDate = saleDate.trim().ifBlank { null },
                            customerName = customerName.trim().ifBlank { null },
                            notes = notes.trim().ifBlank { null },
                        ),
                    )

                var updatedSummary = uiState.cookedCopraStockSummary
                try {
                    updatedSummary = api.getCookedCopraStockSummary().data
                } catch (_: Exception) {
                    // Keep previous stock summary when the refresh fails.
                }

                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        cookedCopraStockSummary = updatedSummary,
                        successMessage = response.message ?: "Cooked copra stock-out recorded.",
                    )

                triggerPostActionRefresh(
                    action = DomainAction.STOCK_ADJUSTMENT,
                    affectedVariantIds =
                        updatedSummary
                            ?.variantId
                            ?.let { variantId -> setOf(variantId) }
                            .orEmpty(),
                )
                refreshProductionRuns()
                onSuccess(response.data.batchCode)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun createProduct(
        name: String,
        description: String,
        categoryId: Int?,
        baseUnit: String,
        imageUrl: String,
        isActive: Boolean,
        trackStock: Boolean,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedName = name.trim()
        val normalizedBaseUnit = baseUnit.trim()
        if (normalizedName.isBlank()) {
            uiState = uiState.copy(errorMessage = "Product name is required.")
            return
        }
        if (categoryId == null) {
            uiState = uiState.copy(errorMessage = "Category is required.")
            return
        }
        if (normalizedBaseUnit.isBlank()) {
            uiState = uiState.copy(errorMessage = "Base unit is required.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.createProduct(
                        ProductUpsertRequest(
                            name = normalizedName,
                            description = description.trim().ifBlank { null },
                            categoryId = categoryId,
                            baseUnit = normalizedBaseUnit,
                            imageUrl = imageUrl.trim().ifBlank { null },
                            isActive = isActive,
                            trackStock = trackStock,
                        ),
                    )
                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          successMessage = response.message ?: "Product created successfully.",
                      )
                  triggerPostActionRefresh(
                      action = DomainAction.PRODUCT_UPDATED,
                  )
                  refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun updateProduct(
        productId: Int,
        name: String,
        description: String,
        categoryId: Int?,
        baseUnit: String,
        imageUrl: String,
        isActive: Boolean,
        trackStock: Boolean,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedName = name.trim()
        val normalizedBaseUnit = baseUnit.trim()
        if (normalizedName.isBlank()) {
            uiState = uiState.copy(errorMessage = "Product name is required.")
            return
        }
        if (categoryId == null) {
            uiState = uiState.copy(errorMessage = "Category is required.")
            return
        }
        if (normalizedBaseUnit.isBlank()) {
            uiState = uiState.copy(errorMessage = "Base unit is required.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.updateProduct(
                        productId = productId,
                        request =
                            ProductUpsertRequest(
                                name = normalizedName,
                                description = description.trim().ifBlank { null },
                                categoryId = categoryId,
                                baseUnit = normalizedBaseUnit,
                                imageUrl = imageUrl.trim().ifBlank { null },
                                isActive = isActive,
                                trackStock = trackStock,
                            ),
                    )
                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          successMessage = response.message ?: "Product updated successfully.",
                      )
                  triggerPostActionRefresh(
                      action = DomainAction.PRODUCT_UPDATED,
                      entityId = productId,
                  )
                  refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun toggleProductStock(
        productId: Int,
        onSuccess: () -> Unit = {},
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response = api.toggleProductStock(productId)
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Stock tracking updated.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.PRODUCT_UPDATED,
                    entityId = productId,
                )
                refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun toggleProductActive(
        productId: Int,
        onSuccess: () -> Unit = {},
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response = api.toggleProductActive(productId)
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Product status updated.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.PRODUCT_UPDATED,
                    entityId = productId,
                )
                refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun addProductVariant(
        productId: Int,
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedDescription = description.trim()
        if (normalizedDescription.isBlank()) {
            uiState = uiState.copy(errorMessage = "Variant description is required.")
            return
        }
        if (unitPrice < 0.0) {
            uiState = uiState.copy(errorMessage = "Unit price must be zero or higher.")
            return
        }
        if (costPrice != null && costPrice < 0.0) {
            uiState = uiState.copy(errorMessage = "Cost price must be zero or higher.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.createProductVariant(
                        productId = productId,
                        request =
                            ProductVariantUpsertRequest(
                                sku = sku.trim().ifBlank { null },
                                description = normalizedDescription,
                                unitPrice = unitPrice,
                                costPrice = costPrice,
                            ),
                    )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Variant created successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.PRODUCT_UPDATED,
                    entityId = productId,
                    affectedVariantIds = setOf(response.data.id),
                )
                refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun updateProductVariant(
        productId: Int,
        variantId: Int,
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedDescription = description.trim()
        if (normalizedDescription.isBlank()) {
            uiState = uiState.copy(errorMessage = "Variant description is required.")
            return
        }
        if (unitPrice < 0.0) {
            uiState = uiState.copy(errorMessage = "Unit price must be zero or higher.")
            return
        }
        if (costPrice != null && costPrice < 0.0) {
            uiState = uiState.copy(errorMessage = "Cost price must be zero or higher.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.updateProductVariant(
                        productId = productId,
                        variantId = variantId,
                        request =
                            ProductVariantUpsertRequest(
                                sku = sku.trim().ifBlank { null },
                                description = normalizedDescription,
                                unitPrice = unitPrice,
                                costPrice = costPrice,
                            ),
                    )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Variant updated successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.PRODUCT_UPDATED,
                    entityId = productId,
                    affectedVariantIds = setOf(variantId),
                )
                refreshProductsMenu()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun applyWeighFilters(
        type: String,
        status: String,
        dateFrom: String,
        dateTo: String,
    ) {
        uiState =
            uiState.copy(
                weighTypeFilter = type,
                weighStatusFilter = status,
                weighDateFrom = dateFrom.trim(),
                weighDateTo = dateTo.trim(),
            )
        refreshWeighIns()
    }

    fun clearWeighFilters() {
        applyWeighFilters(
            type = "all",
            status = "all",
            dateFrom = "",
            dateTo = "",
        )
    }

    fun toggleSaleExpanded(saleId: Int) {
        val expanded = uiState.expandedSaleIds.toMutableSet()
        if (expanded.contains(saleId)) {
            expanded.remove(saleId)
        } else {
            expanded.clear()
            expanded.add(saleId)
        }
        uiState = uiState.copy(expandedSaleIds = expanded)
    }

    fun toggleDeliveryExpanded(deliveryId: Int) {
        val expanded = uiState.expandedDeliveryIds.toMutableSet()
        if (expanded.contains(deliveryId)) {
            expanded.remove(deliveryId)
        } else {
            expanded.clear()
            expanded.add(deliveryId)
        }
        uiState = uiState.copy(expandedDeliveryIds = expanded)
    }

    fun addPosProductToCart(
        product: Product,
        variant: ProductVariant,
    ) {
        val stock = variantAvailableForPos(variant)
        if (stock <= 0.0) {
            uiState = uiState.copy(errorMessage = "This item is out of stock.")
            return
        }

        val current = uiState.posCartItems.toMutableList()
        val index = current.indexOfFirst { it.variantId == variant.id }

        if (index >= 0) {
            val existing = current[index]
            val nextQty = (existing.quantity + 1.0).coerceAtMost(stock)
            current[index] = existing.copy(quantity = nextQty)
        } else {
            current.add(
                PosCartItem(
                    productId = product.id,
                    variantId = variant.id,
                    productName = product.name,
                    variantName = variant.description ?: "-",
                    image = product.image,
                    unitPrice = variant.unitPrice,
                    quantity = 1.0,
                ),
            )
        }

        uiState = uiState.copy(posCartItems = current)
    }

    fun updatePosCartQuantity(
        variantId: Int,
        delta: Double,
    ) {
        val current = uiState.posCartItems.toMutableList()
        val index = current.indexOfFirst { it.variantId == variantId }
        if (index < 0) {
            return
        }

        val existing = current[index]
        val nextQty = existing.quantity + delta
        val product =
            uiState.products.firstOrNull { p ->
                p.id == existing.productId
            }
        val stock =
            product?.variants?.firstOrNull { v ->
                v.id == variantId
            }?.let(::variantAvailableForPos) ?: existing.quantity

        if (stock <= 0.0) {
            current.removeAt(index)
            uiState = uiState.copy(posCartItems = current)
            return
        }

        val boundedQty = nextQty.coerceIn(0.01, stock)
        current[index] = existing.copy(quantity = boundedQty)

        uiState = uiState.copy(posCartItems = current)
    }

    fun setPosCartQuantity(
        variantId: Int,
        quantity: Double,
    ) {
        val current = uiState.posCartItems.toMutableList()
        val index = current.indexOfFirst { it.variantId == variantId }
        if (index < 0) {
            return
        }

        val existing = current[index]
        val product = uiState.products.firstOrNull { p -> p.id == existing.productId }
        val stock = product?.variants?.firstOrNull { v -> v.id == variantId }?.let(::variantAvailableForPos) ?: existing.quantity

        if (stock <= 0.0) {
            current.removeAt(index)
            uiState = uiState.copy(posCartItems = current)
            return
        }

        val normalizedQty = quantity.coerceIn(0.01, stock)
        current[index] = existing.copy(quantity = normalizedQty)
        uiState = uiState.copy(posCartItems = current)
    }

    fun setPosCartUnitPrice(
        variantId: Int,
        unitPrice: Double?,
    ) {
        val current = uiState.posCartItems.toMutableList()
        val index = current.indexOfFirst { it.variantId == variantId }
        if (index < 0) {
            return
        }

        val existing = current[index]
        val normalized =
            unitPrice?.let {
                if (it <= 0.0) {
                    null
                } else {
                    it
                }
            }

        current[index] = existing.copy(customUnitPrice = normalized)
        uiState = uiState.copy(posCartItems = current)
    }

    fun removePosCartItem(variantId: Int) {
        uiState =
            uiState.copy(
                posCartItems = uiState.posCartItems.filterNot { it.variantId == variantId },
            )
    }

    fun clearPosCart() {
        uiState = uiState.copy(posCartItems = emptyList())
    }

    fun toggleDeliveryCart(delivery: Delivery) {
        val sale = delivery.sale
        val saleId = sale?.id
        if (saleId == null) {
            uiState = uiState.copy(errorMessage = "Unable to add delivery items.")
            return
        }

        val current = uiState.deliveryCartItems.toMutableList()
        val hasDifferentSale = current.isNotEmpty() && current.any { it.saleId != saleId }
        if (hasDifferentSale) {
            uiState =
                uiState.copy(
                    errorMessage = "Please process items from one sale at a time. Clear cart first.",
                )
            return
        }

        var hasChanges = false
        delivery.items.forEach { item ->
            val remainingQtyRaw = item.remainingQuantity ?: item.quantity
            val remainingQty = remainingQtyRaw.coerceAtLeast(0.0)
            if (remainingQty <= 0.0) {
                return@forEach
            }

            val saleItemId = item.saleItemId ?: item.id
            val cartKey = "${delivery.id}-$saleItemId"
            val index = current.indexOfFirst { it.cartKey == cartKey }

            if (index >= 0) {
                val existing = current[index]
                val nextQty = minOf(existing.remainingQuantity, existing.quantity + 1.0)
                if (nextQty != existing.quantity) {
                    current[index] = existing.copy(quantity = nextQty)
                    hasChanges = true
                }
            } else {
                current.add(
                    DeliveryCartItem(
                        cartKey = cartKey,
                        deliveryId = delivery.id,
                        saleId = saleId,
                        saleNumber = sale.saleNumber,
                        saleItemId = saleItemId,
                        productVariantId = item.productVariant.id,
                        productName = item.productVariant.product?.name ?: "-",
                        description = item.productVariant.description ?: "-",
                        image = item.productVariant.product?.image,
                        quantity = minOf(1.0, remainingQty),
                        remainingQuantity = remainingQty,
                        unitPrice = 0.0,
                        createdAt = sale.createdAt,
                    ),
                )
                hasChanges = true
            }
        }

        if (!hasChanges) {
            uiState = uiState.copy(errorMessage = "No remaining items to add.")
            return
        }

        uiState = uiState.copy(deliveryCartItems = current)
    }

    fun openDeliveryCartFromSale(saleId: Int) {
        val sale =
            uiState.sales.firstOrNull { it.id == saleId }
                ?: run {
                    uiState = uiState.copy(errorMessage = "Unable to open delivery cart for this sale.")
                    selectTab(AppTab.DELIVERY)
                    return
                }

        val deliveryRecord =
            mapSaleToDeliveryQueueRecord(sale)
                ?: run {
                    uiState = uiState.copy(errorMessage = "No remaining items to deliver.")
                    selectTab(AppTab.DELIVERY)
                    return
                }

        val previousCount = uiState.deliveryCartItems.size
        toggleDeliveryCart(deliveryRecord)
        selectTab(AppTab.DELIVERY)

        val hasItemsForSale = uiState.deliveryCartItems.any { it.saleId == saleId }
        if (hasItemsForSale && uiState.deliveryCartItems.size >= previousCount) {
            uiState =
                uiState.copy(
                    deliveryCartOpenSignal = uiState.deliveryCartOpenSignal + 1,
                )
        }
    }

    fun updateDeliveryCartQuantity(
        cartKey: String,
        delta: Double,
    ) {
        val current = uiState.deliveryCartItems.toMutableList()
        val index = current.indexOfFirst { it.cartKey == cartKey }
        if (index < 0) {
            return
        }

        val existing = current[index]
        val nextQty = (existing.quantity + delta).coerceIn(0.0, existing.remainingQuantity)
        if (nextQty <= 0.0) {
            current.removeAt(index)
        } else {
            current[index] = existing.copy(quantity = nextQty)
        }

        uiState = uiState.copy(deliveryCartItems = current)
    }

    fun setDeliveryCartQuantity(
        cartKey: String,
        quantity: Double,
    ) {
        val current = uiState.deliveryCartItems.toMutableList()
        val index = current.indexOfFirst { it.cartKey == cartKey }
        if (index < 0) {
            return
        }

        val existing = current[index]
        val normalizedQty = quantity.coerceIn(0.0, existing.remainingQuantity)
        if (normalizedQty <= 0.0) {
            current.removeAt(index)
        } else {
            current[index] = existing.copy(quantity = normalizedQty)
        }

        uiState = uiState.copy(deliveryCartItems = current)
    }

    fun removeDeliveryCartItem(cartKey: String) {
        uiState =
            uiState.copy(
                deliveryCartItems =
                    uiState.deliveryCartItems.filterNot { it.cartKey == cartKey },
            )
    }

    fun clearDeliveryCart() {
        uiState = uiState.copy(deliveryCartItems = emptyList())
    }

    fun processDeliveryCart(
        pin: String,
        notes: String,
        onSuccess: (Int) -> Unit = {},
    ) {
        val normalizedPin = pin.filter(Char::isDigit)
        if (normalizedPin.length != 4) {
            uiState = uiState.copy(errorMessage = "PIN must be 4 digits.")
            return
        }
        if (uiState.deliveryCartItems.isEmpty()) {
            uiState = uiState.copy(errorMessage = "No delivery items in cart.")
            return
        }

        val saleIds = uiState.deliveryCartItems.map { it.saleId }.distinct()
        if (saleIds.size != 1) {
            uiState = uiState.copy(errorMessage = "Please process one sale at a time.")
            return
        }

        val payload =
            uiState.deliveryCartItems
                .groupBy { it.saleItemId }
                .mapNotNull { (saleItemId, items) ->
                    val quantity = items.sumOf { it.quantity }
                    if (quantity <= 0.0) {
                        null
                    } else {
                        SaleItemQuantityRequest(
                            saleItemId = saleItemId,
                            quantity = quantity,
                        )
                    }
                }

        if (payload.isEmpty()) {
            uiState = uiState.copy(errorMessage = "No valid quantities to process.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                api.verifyPin(PinRequest(pin = normalizedPin))
                val response =
                    api.addSaleDeliveryItems(
                        saleId = saleIds.first(),
                        request =
                            AddDeliveryRequest(
                                items = payload,
                                notes = notes.ifBlank { null },
                            ),
                    )

                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          deliveryCartItems = emptyList(),
                          successMessage = response.message ?: "Delivery processed successfully.",
                      )
                  triggerPostActionRefresh(
                      action = DomainAction.DELIVERY_MARKED_DELIVERED,
                      entityId = response.data.id,
                  )
                  onSuccess(response.data.id)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun toggleWeighCart(tx: WeighInTransaction) {
        val current = uiState.weighCartItems.toMutableList()
        val index = current.indexOfFirst { it.transactionId == tx.id }

        if (index >= 0) {
            current.removeAt(index)
        } else {
            val firstType = tx.weighIns.firstOrNull()?.type.orEmpty()
            current.add(
                WeighCartItem(
                    transactionId = tx.id,
                    refNumber = tx.refNum ?: "WIT-${tx.id}",
                    title = prettyType(firstType.ifBlank { "weigh_in" }),
                    amount = tx.totalAmount,
                    weighedAt = tx.weighedAt ?: tx.createdAt.orEmpty(),
                ),
            )
        }

        uiState = uiState.copy(weighCartItems = current)
    }

    fun removeWeighCartItem(transactionId: Int) {
        uiState =
            uiState.copy(
                weighCartItems =
                    uiState.weighCartItems.filterNot { it.transactionId == transactionId },
            )
    }

    fun clearWeighCart() {
        uiState = uiState.copy(weighCartItems = emptyList())
    }

    fun checkoutPosCart(
        pin: String,
        paymentAmount: Double,
        paymentMethod: String,
        notes: String,
        isForDelivery: Boolean,
        deliveryName: String,
        deliveryAddress: String,
        deliveryContact: String,
        onSuccess: (Int) -> Unit = {},
    ) {
        if (uiState.posCartItems.isEmpty()) {
            uiState = uiState.copy(errorMessage = "Cart is empty.")
            return
        }
        val normalizedPin = pin.filter(Char::isDigit)
        if (normalizedPin.length != 4) {
            uiState = uiState.copy(errorMessage = "PIN must be 4 digits.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val request =
                    PosCheckoutRequest(
                        pin = normalizedPin,
                        items =
                            uiState.posCartItems.map {
                                PosCheckoutItemRequest(
                                    productVariantId = it.variantId,
                                    quantity = maxOf(0.01, it.quantity),
                                    unitPrice = it.customUnitPrice,
                                )
                            },
                        notes = notes.trim().ifBlank { null },
                        paymentAmount = maxOf(0.0, paymentAmount),
                        paymentMethod = paymentMethod,
                        isForDelivery = isForDelivery,
                        deliveryName = if (isForDelivery) deliveryName.trim().ifBlank { null } else null,
                        deliveryAddress = if (isForDelivery) deliveryAddress.trim().ifBlank { null } else null,
                        deliveryContact = if (isForDelivery) deliveryContact.trim().ifBlank { null } else null,
                    )

                val response = api.checkoutPos(request)
                  uiState =
                      uiState.copy(
                          isActionLoading = false,
                          posCartItems = emptyList(),
                          successMessage = response.message ?: "Sale completed successfully.",
                      )
                  triggerPostActionRefresh(
                      action = if (isForDelivery) DomainAction.SALE_CREATED_DELIVERY else DomainAction.SALE_COMPLETED_WALK_IN,
                      entityId = response.data.sale.id,
                  )
                  onSuccess(response.data.sale.id)
            } catch (e: Exception) {
                if (isOfflineQueueableError(e)) {
                    val outboxRequest =
                        OutboxSaleCreateRequest(
                            clientRequestId = UUID.randomUUID().toString(),
                            items =
                                uiState.posCartItems.map {
                                    OutboxSaleItemRequest(
                                        productVariantId = it.variantId,
                                        quantity = maxOf(0.01, it.quantity),
                                        unitPrice = it.customUnitPrice ?: it.unitPrice,
                                    )
                                },
                            paymentAmount = maxOf(0.0, paymentAmount),
                            paymentMethod = paymentMethod,
                            isForDelivery = isForDelivery,
                            deliveryName = if (isForDelivery) deliveryName.trim().ifBlank { null } else null,
                            deliveryAddress = if (isForDelivery) deliveryAddress.trim().ifBlank { null } else null,
                            deliveryContact = if (isForDelivery) deliveryContact.trim().ifBlank { null } else null,
                            notes = notes.trim().ifBlank { null },
                        )

                    outboxRepository.enqueueEvent(
                        type = OutboxEventTypes.SALE_CREATE,
                        payloadJson = gson.toJson(outboxRequest),
                    )

                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            isOfflineMode = true,
                            posCartItems = emptyList(),
                            successMessage = "No connection. Sale queued and will sync automatically.",
                        )
                    onSuccess(-1)
                } else {
                    uiState =
                        uiState.copy(
                            isActionLoading = false,
                            errorMessage = networkErrorMessage(e),
                        )
                }
            }
        }
    }

    fun fetchSaleReceiptText(
        saleId: Int,
        onSuccess: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = api.getSaleReceipt(saleId = saleId, charWidth = receiptCharWidth)
                val text = normalizeReceiptTextForPrint(response.data.receiptText.orEmpty())
                if (text.isBlank()) {
                    uiState = uiState.copy(errorMessage = "Receipt text is empty.")
                    return@launch
                }
                onSuccess(text)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun fetchSaleDetails(
        saleId: Int,
        onSuccess: (com.hims.nativeapp.data.model.Sale) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                onSuccess(salesRepository.getSale(saleId, forceRefresh = true))
            } catch (e: Exception) {
                uiState = uiState.copy(errorMessage = networkErrorMessage(e))
            }
        }
    }

    fun fetchDeliveryDetails(
        deliveryId: Int,
        onSuccess: (Delivery) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = api.getDelivery(deliveryId)
                onSuccess(response.data)
            } catch (e: Exception) {
                uiState = uiState.copy(errorMessage = networkErrorMessage(e))
            }
        }
    }

    fun fetchDeliveryReceiptText(
        deliveryId: Int,
        onSuccess: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = api.getDeliveryReceipt(deliveryId = deliveryId, charWidth = receiptCharWidth)
                val text = normalizeReceiptTextForPrint(response.data.receiptText.orEmpty())
                if (text.isBlank()) {
                    uiState = uiState.copy(errorMessage = "Receipt text is empty.")
                    return@launch
                }
                onSuccess(text)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun fetchWeighReceiptText(
        transactionId: Int,
        onSuccess: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = api.getWeighInReceipt(transactionId = transactionId, charWidth = receiptCharWidth)
                val text = normalizeReceiptTextForPrint(response.data.receiptText.orEmpty())
                if (text.isBlank()) {
                    uiState = uiState.copy(errorMessage = "Receipt text is empty.")
                    return@launch
                }
                onSuccess(text)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun voidSale(
        saleId: Int,
        reason: String,
        onSuccess: () -> Unit = {},
    ) {
        if (!isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can void sales.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response = api.voidSale(saleId, VoidSaleRequest(reason = reason.ifBlank { "Voided from mobile app" }))
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Sale voided successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.SALE_VOIDED,
                    entityId = saleId,
                )
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun addPaymentToSale(
        saleId: Int,
        amount: Double,
        paymentMethod: String,
        notes: String,
        onSuccess: () -> Unit = {},
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.addSalePayment(
                    saleId = saleId,
                    request =
                        AddPaymentRequest(
                            amount = amount,
                            paymentMethod = paymentMethod,
                            notes = notes.ifBlank { null },
                        ),
                )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Payment added successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.SALE_PAYMENT_ADDED,
                    entityId = saleId,
                )
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun cancelSaleItem(
        saleId: Int,
        saleItemId: Int,
        quantityToCancel: Double,
        reason: String,
        onSuccess: () -> Unit = {},
    ) {
        val isDeliverySale =
            uiState.sales.firstOrNull { it.id == saleId }?.isForDelivery
                ?: uiState.deliveryQueue.any { it.sale?.id == saleId }
        if (!isDeliverySale) {
            uiState = uiState.copy(errorMessage = "Item cancellation is only available for delivery sales.")
            return
        }
        if (isDeliverySale && !isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can cancel delivery sale items.")
            return
        }
        val affectedVariantIds =
            uiState.sales
                .firstOrNull { sale -> sale.id == saleId }
                ?.items
                .orEmpty()
                .firstOrNull { item -> item.id == saleItemId }
                ?.productVariant
                ?.id
                ?.let { variantId -> setOf(variantId) }
                .orEmpty()

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.cancelSaleItem(
                    saleId = saleId,
                    request =
                        CancelSaleItemRequest(
                            saleItemId = saleItemId,
                            reason = reason.ifBlank { "Canceled from mobile app" },
                            quantityToCancel = quantityToCancel,
                        ),
                )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Item canceled successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.SALE_REFUNDED,
                    entityId = saleId,
                    affectedVariantIds = affectedVariantIds,
                )
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun fetchSaleDeliveryDetails(
        saleId: Int,
        onSuccess: (DeliveryForSaleData) -> Unit,
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null)
            try {
                val response = api.getSaleDeliveryDetails(saleId)
                uiState = uiState.copy(isActionLoading = false)
                onSuccess(response.data)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun submitSaleDelivery(
        saleId: Int,
        items: List<SaleItemQuantityRequest>,
        notes: String,
        onSuccess: () -> Unit = {},
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.addSaleDeliveryItems(
                    saleId = saleId,
                    request =
                        AddDeliveryRequest(
                            items = items,
                            notes = notes.ifBlank { null },
                        ),
                )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Delivery updated successfully.",
                    )
                triggerPostActionRefresh(
                    action = DomainAction.DELIVERY_MARKED_DELIVERED,
                    entityId = saleId,
                )
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun fetchRefundDetails(
        saleId: Int,
        onSuccess: (RefundForSaleData) -> Unit,
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null)
            try {
                val response = salesRepository.getRefundForSale(saleId)
                uiState = uiState.copy(isActionLoading = false)
                onSuccess(response)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun createSaleRefund(
        saleId: Int,
        items: List<RefundItemRequest>,
        reason: String,
        refundMethod: String,
        onSuccess: () -> Unit = {},
    ) {
        if (!isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can process refunds.")
            return
        }

        val normalizedReason = reason.trim()
        if (normalizedReason.isBlank()) {
            uiState = uiState.copy(errorMessage = "Refund reason is required.")
            return
        }

        val normalizedItems =
            items
                .filter { it.quantity > 0 }
                .map { it.copy(quantity = it.quantity.coerceAtLeast(1)) }
        if (normalizedItems.isEmpty()) {
            uiState = uiState.copy(errorMessage = "Enter at least one quantity to refund.")
            return
        }

        val normalizedMethod = refundMethod.trim().lowercase().ifBlank { "cash" }
        val allowedMethods = setOf("cash", "card", "gcash", "maya", "store_credit")
        if (normalizedMethod !in allowedMethods) {
            uiState = uiState.copy(errorMessage = "Invalid refund method.")
            return
        }

        val refundItemIds = normalizedItems.map { item -> item.saleItemId }.toSet()
        val affectedVariantIds =
            uiState.sales
                .firstOrNull { sale -> sale.id == saleId }
                ?.items
                .orEmpty()
                .filter { saleItem -> refundItemIds.contains(saleItem.id) }
                .map { saleItem -> saleItem.productVariant.id }
                .toSet()

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val resolvedVariantIds =
                    if (affectedVariantIds.isNotEmpty()) {
                        affectedVariantIds
                    } else {
                        runCatching {
                            salesRepository
                                .getRefundForSale(saleId)
                                .refundableItems
                                .filter { refundable ->
                                    refundItemIds.contains(refundable.saleItem.id)
                                }
                                .map { refundable -> refundable.saleItem.productVariant.id }
                                .toSet()
                        }.getOrDefault(emptySet())
                    }
                val successMessage =
                    salesRepository.refundSale(
                        saleId = saleId,
                        items = normalizedItems,
                        reason = normalizedReason,
                        refundMethod = normalizedMethod,
                        affectedInventoryVariantIds = resolvedVariantIds,
                    )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = successMessage ?: "Refund processed successfully.",
                    )
                runCatching {
                    EmitImpact.emit(
                        action = DomainAction.SALE_REFUNDED,
                        reason = "local",
                        entityId = saleId,
                    )
                }
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun addWeighTypeToDraft(type: String) {
        val baseUnitPrice = uiState.weighPrices[type]
        if (baseUnitPrice == null || baseUnitPrice <= 0.0) {
            uiState = uiState.copy(errorMessage = "Price not set for ${prettyType(type)}.")
            return
        }

        // If current cart already has a custom price for the same type, inherit it for newly added rows.
        val inheritedCustomPrice =
            uiState.weighDraftItems
                .lastOrNull { it.type.trim().lowercase() == type.trim().lowercase() && it.customUnitPrice != null }
                ?.customUnitPrice
        val activeUnitPrice = inheritedCustomPrice ?: baseUnitPrice

        val isCoconut = type == "coconut"
        val weight = if (isCoconut) null else 1.0
        val count = if (isCoconut) 1 else null
        val totalAmount = if (isCoconut) (count ?: 0) * activeUnitPrice else (weight ?: 0.0) * activeUnitPrice

        val next =
            uiState.weighDraftItems +
                WeighDraftItem(
                    localId = "draft-${System.currentTimeMillis()}-${(1000..9999).random()}",
                    type = type,
                    weightKg = weight,
                    count = count,
                    unitPrice = baseUnitPrice,
                    customUnitPrice = inheritedCustomPrice,
                    totalAmount = totalAmount,
                )

        uiState = uiState.copy(weighDraftItems = next)
    }

    fun updateWeighDraftWeight(localId: String, weightKg: Double) {
        val next =
            uiState.weighDraftItems.map { item ->
                if (item.localId != localId) {
                    item
                } else {
                    val normalized = maxOf(0.01, weightKg)
                    val activeUnitPrice = item.customUnitPrice ?: item.unitPrice
                    item.copy(
                        weightKg = normalized,
                        totalAmount = normalized * activeUnitPrice,
                    )
                }
            }
        uiState = uiState.copy(weighDraftItems = next)
    }

    fun updateWeighDraftCount(localId: String, count: Int) {
        val next =
            uiState.weighDraftItems.map { item ->
                if (item.localId != localId) {
                    item
                } else {
                    val normalized = maxOf(1, count)
                    val activeUnitPrice = item.customUnitPrice ?: item.unitPrice
                    item.copy(
                        count = normalized,
                        totalAmount = normalized * activeUnitPrice,
                    )
                }
            }
        uiState = uiState.copy(weighDraftItems = next)
    }

    fun updateWeighDraftUnitPrice(
        localId: String,
        unitPrice: Double?,
    ) {
        val next =
            uiState.weighDraftItems.map { item ->
                if (item.localId != localId) {
                    item
                } else {
                    val normalized = unitPrice?.let { if (it > 0.0) it else null }
                    val activeUnitPrice = normalized ?: item.unitPrice
                    val total =
                        if (item.type == "coconut") {
                            (item.count ?: 1) * activeUnitPrice
                        } else {
                            (item.weightKg ?: 1.0) * activeUnitPrice
                        }
                    item.copy(
                        customUnitPrice = normalized,
                        totalAmount = total,
                    )
                }
            }
        uiState = uiState.copy(weighDraftItems = next)
    }

    fun applyWeighDraftUnitPriceByType(
        type: String,
        unitPrice: Double?,
    ) {
        val targetType = type.trim().lowercase()
        val normalized = unitPrice?.let { if (it > 0.0) it else null }
        val next =
            uiState.weighDraftItems.map { item ->
                if (item.type.trim().lowercase() != targetType) {
                    item
                } else {
                    val activeUnitPrice = normalized ?: item.unitPrice
                    val total =
                        if (item.type == "coconut") {
                            (item.count ?: 1) * activeUnitPrice
                        } else {
                            (item.weightKg ?: 1.0) * activeUnitPrice
                        }
                    item.copy(
                        customUnitPrice = normalized,
                        totalAmount = total,
                    )
                }
            }
        uiState = uiState.copy(weighDraftItems = next)
    }

    fun removeWeighDraftItem(localId: String) {
        uiState =
            uiState.copy(
                weighDraftItems = uiState.weighDraftItems.filterNot { it.localId == localId },
            )
    }

    fun clearWeighDraft() {
        uiState = uiState.copy(weighDraftItems = emptyList())
    }

    fun processWeighDraft(
        pin: String,
        onSuccess: (WeighInTransaction) -> Unit = {},
    ) {
        val normalizedPin = pin.filter(Char::isDigit)
        if (normalizedPin.length != 4) {
            uiState = uiState.copy(errorMessage = "PIN must be 4 digits.")
            return
        }
        if (uiState.weighDraftItems.isEmpty()) {
            uiState = uiState.copy(errorMessage = "No weigh-ins in cart.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.batchStoreWeighIns(
                    WeighBatchStoreRequest(
                        pin = normalizedPin,
                        weighIns =
                            uiState.weighDraftItems.map {
                                WeighBatchItemRequest(
                                    type = it.type,
                                    weightKg = if (it.type == "coconut") null else (it.weightKg ?: 1.0),
                                    count = if (it.type == "coconut") (it.count ?: 1) else null,
                                    unitPrice = it.customUnitPrice,
                                )
                            },
                    ),
                )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        weighDraftItems = emptyList(),
                        successMessage = response.message ?: "Weigh-ins saved successfully.",
                    )
                triggerPostActionRefresh(action = DomainAction.WEIGH_IN_RECORDED)
                onSuccess(response.data)
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun markUnpaidWeighTransactionPaid(
        transactionId: Int,
        pin: String,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedPin = pin.filter(Char::isDigit)
        if (normalizedPin.length != 4) {
            uiState = uiState.copy(errorMessage = "PIN must be 4 digits.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.markWeighTransactionPaid(
                    weighInId = transactionId,
                    request = PinRequest(pin = normalizedPin),
                )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Weigh-in marked as paid.",
                    )
                refreshWeighIns()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun updateWeighPrice(
        type: String,
        price: Double,
        onSuccess: () -> Unit = {},
    ) {
        if (!isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can update weigh-in prices.")
            return
        }

        val normalizedType = type.trim().lowercase()
        if (normalizedType !in setOf("cooked_copra", "uncooked_copra", "coconut", "bagol")) {
            uiState = uiState.copy(errorMessage = "Invalid weigh-in type.")
            return
        }
        if (price < 0.0) {
            uiState = uiState.copy(errorMessage = "Price must be zero or higher.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val response =
                    api.updateWeighPrice(
                        type = normalizedType,
                        request = WeighPriceUpdateRequest(price = price),
                    )
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = response.message ?: "Price updated successfully.",
                    )
                refreshWeighIns()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun updateWeighPrices(
        prices: Map<String, Double>,
        onSuccess: () -> Unit = {},
    ) {
        if (!isCurrentUserAdmin()) {
            uiState = uiState.copy(errorMessage = "Only administrators can update weigh-in prices.")
            return
        }

        if (prices.isEmpty()) {
            return
        }
        val invalid = prices.any { (type, value) ->
            type !in setOf("cooked_copra", "uncooked_copra", "coconut", "bagol") || value < 0.0
        }
        if (invalid) {
            uiState = uiState.copy(errorMessage = "Invalid weigh-in prices payload.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                prices.forEach { (type, value) ->
                    api.updateWeighPrice(
                        type = type,
                        request = WeighPriceUpdateRequest(price = value),
                    )
                }
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        successMessage = "Prices updated successfully.",
                    )
                refreshWeighIns()
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    fun createProductionRun(
        runType: String,
        inputQty: Double,
        outputWeightKg: Double,
        productionDate: String,
        operator: String,
        supplierSource: String,
        dryingMethod: String,
        notes: String,
        onSuccess: () -> Unit = {},
    ) {
        val normalizedRunType = runType.trim().lowercase()
        if (normalizedRunType !in setOf("coconut_to_uncooked", "uncooked_to_cooked", "coconut_to_cooked")) {
            uiState = uiState.copy(errorMessage = "Invalid production run type.")
            return
        }
        if (inputQty <= 0.0) {
            uiState = uiState.copy(errorMessage = "Input quantity must be greater than zero.")
            return
        }
        if (outputWeightKg <= 0.0) {
            uiState = uiState.copy(errorMessage = "Output weight must be greater than zero.")
            return
        }
        if (normalizedRunType == "uncooked_to_cooked" && outputWeightKg > inputQty) {
            uiState = uiState.copy(errorMessage = "Cooked output cannot exceed uncooked input.")
            return
        }

        val isPieceToKgRun = normalizedRunType == "coconut_to_uncooked" || normalizedRunType == "coconut_to_cooked"
        val kgPerPc = if (isPieceToKgRun) outputWeightKg / inputQty else 0.0
        if (isPieceToKgRun && kgPerPc > 0.60) {
            uiState = uiState.copy(errorMessage = "Output weight exceeds realistic biological limits.")
            return
        }

        viewModelScope.launch {
            uiState = uiState.copy(isActionLoading = true, errorMessage = null, successMessage = null)
            try {
                val run =
                    api.createProductionRun(
                        ProductionRunRequest(
                            runType = normalizedRunType,
                            inputQty = inputQty,
                            outputWeightKg = outputWeightKg,
                            productionDate = productionDate.trim(),
                            operator = operator.trim().ifBlank { null },
                            supplierSource = supplierSource.trim().ifBlank { null },
                            dryingMethod = dryingMethod.trim().ifBlank { null },
                            notes = notes.trim().ifBlank { null },
                        ),
                    ).data

                val refreshedRuns = api.getProductionRuns(perPage = 200).data.data
                val refreshedInventoryVariants = api.getInventory().data.data
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        inventoryVariants = refreshedInventoryVariants,
                        productionRuns = refreshedRuns,
                        successMessage = "Production run saved: ${run.batchCode}",
                    )
                onSuccess()
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isActionLoading = false,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    private fun refreshPosSilently() {
        refreshPos(forceRefresh = true, showLoading = false)
    }

    private fun refreshSalesSilently() {
        refreshSales(forceRefresh = true, showLoading = false)
    }

    private fun refreshDeliveriesSilently() {
        viewModelScope.launch {
            runCatching {
                val queue =
                    fetchDeliveryQueueRecords(
                        statusFilter = uiState.deliveryStatusFilter,
                        dateFrom = asDateQuery(uiState.deliveryDateFrom),
                        dateTo = asDateQuery(uiState.deliveryDateTo),
                    )
                val history = api.getDeliveries(perPage = 200).data.data
                uiState = uiState.copy(deliveryQueue = queue, deliveries = history)
            }
        }
    }

    private fun refreshInventorySilently() {
        refreshInventory(forceRefresh = true, showLoading = false)
    }

    private fun refreshProductsMenuSilently() {
        viewModelScope.launch {
            runCatching {
                val categories = api.getPosCategories().data
                val products = api.getProducts(perPage = 100).data.data
                uiState = uiState.copy(productMenuItems = products, inventoryCategories = categories)
            }
        }
    }

    private fun refreshDashboardSilently() {
        refreshDashboard(forceRefresh = true, showLoading = false)
    }

    private fun applyDashboardAccessDeniedState() {
        uiState =
            uiState.copy(
                isRefreshing = false,
                dashboardData = null,
                dashboardAccessDenied = true,
                dashboardStatusMessage = "Dashboard is not available for this account.",
                errorMessage = "Dashboard is available to administrators only.",
            )
    }

    private fun applyDashboardErrorState(message: String) {
        uiState =
            uiState.copy(
                isRefreshing = false,
                dashboardAccessDenied = false,
                dashboardStatusMessage = "Dashboard data unavailable. Pull to refresh.",
                errorMessage = message,
            )
    }

    private fun refreshWeighInsSilently() {
        viewModelScope.launch {
            runCatching {
                val landing = api.getWeighLanding().data
                val weighIns =
                    api.getWeighIns(
                        perPage = 200,
                        type = asQueryValue(uiState.weighTypeFilter),
                        status = asQueryValue(uiState.weighStatusFilter),
                        dateFrom = asDateQuery(uiState.weighDateFrom),
                        dateTo = asDateQuery(uiState.weighDateTo),
                    ).data.data
                val unpaid = api.getUnpaidWeighIns().data
                uiState =
                    uiState.copy(
                        weighIns = weighIns,
                        weighPrices = landing.prices.mapValues { entry -> entry.value.price },
                        weighProducts = landing.products,
                        unpaidWeighTransactions = unpaid,
                    )
            }
        }
    }

    private fun refreshAll(initial: Boolean = false) {
        viewModelScope.launch {
            uiState =
                uiState.copy(
                    isLoading = initial,
                    isRefreshing = !initial,
                    errorMessage = null,
                )

            try {
                val products = posRepository.getPosSummary(forceRefresh = true)
                val inventorySummary =
                    inventoryRepository.getSummary(
                        query =
                            InventorySummaryQuery(
                                categoryId = uiState.inventoryCategoryFilter,
                                lowStockOnly = if (uiState.inventoryLowStockOnly) true else null,
                            ),
                        forceRefresh = true,
                    )
                val sales =
                    salesRepository.getSales(
                        query = buildSalesQuery(),
                        forceRefresh = true,
                    )
                val deliveryQueue =
                    fetchDeliveryQueueRecords(
                        statusFilter = uiState.deliveryStatusFilter,
                        dateFrom = asDateQuery(uiState.deliveryDateFrom),
                        dateTo = asDateQuery(uiState.deliveryDateTo),
                    )
                val deliveries =
                    api.getDeliveries(
                        perPage = 200,
                    ).data.data
                var userName = uiState.userName
                var userRole = canonicalizeRole(uiState.userRole)
                var inventoryDashboard = inventorySummary.dashboard
                val inventoryMovements = inventorySummary.movements
                var weighIns = uiState.weighIns
                var weighPrices = uiState.weighPrices
                var weighProducts = uiState.weighProducts
                var unpaidTransactions = uiState.unpaidWeighTransactions
                var productMenuItems = uiState.productMenuItems
                var dashboardData = uiState.dashboardData
                var productionRuns = uiState.productionRuns
                val cookedCopraStockSummary = inventorySummary.cookedCopraStockSummary
                val nonBlockingErrors = mutableListOf<String>()
                inventorySummary.warningMessage?.let { warning ->
                    nonBlockingErrors += warning
                }

                try {
                    val currentUser = api.getAuthenticatedUser().data
                    userName = currentUser.name
                    userRole = canonicalizeRole(currentUser.role)
                    val token = sessionStore.getToken()
                    if (!token.isNullOrBlank()) {
                        sessionStore.saveSession(token, userName, userRole)
                    }
                } catch (e: Exception) {
                    if (isUnauthorized(e)) {
                        throw e
                    }
                    nonBlockingErrors.add("Profile sync failed. ${networkErrorMessage(e)}")
                }

                try {
                    productMenuItems = api.getProducts(perPage = 100).data.data
                } catch (e: Exception) {
                    if (isUnauthorized(e)) {
                        throw e
                    }
                    nonBlockingErrors.add("Products menu failed to load. ${networkErrorMessage(e)}")
                }

                try {
                    weighIns =
                        api.getWeighIns(
                            perPage = 200,
                            type = asQueryValue(uiState.weighTypeFilter),
                            status = asQueryValue(uiState.weighStatusFilter),
                            dateFrom = asDateQuery(uiState.weighDateFrom),
                            dateTo = asDateQuery(uiState.weighDateTo),
                        ).data.data
                    val landing = api.getWeighLanding().data
                    weighPrices =
                        landing.prices.mapValues { entry ->
                            entry.value.price
                        }
                    weighProducts = landing.products
                    unpaidTransactions = api.getUnpaidWeighIns().data
                } catch (e: Exception) {
                    if (isUnauthorized(e)) {
                        throw e
                    }
                    nonBlockingErrors.add("Weigh-Ins failed to load. ${networkErrorMessage(e)}")
                }

                try {
                    val dashboardMetrics = dashboardRepository.getMetrics(forceRefresh = true)
                    dashboardData = dashboardMetrics.dashboard
                    inventoryDashboard = dashboardMetrics.inventoryDashboard ?: inventoryDashboard
                } catch (e: Exception) {
                    if (isUnauthorized(e)) {
                        throw e
                    }
                    if (!isForbidden(e)) {
                        nonBlockingErrors.add("Dashboard failed to load. ${networkErrorMessage(e)}")
                    }
                }

                try {
                    productionRuns = api.getProductionRuns(perPage = 200).data.data
                } catch (e: Exception) {
                    if (isUnauthorized(e)) {
                        throw e
                    }
                    if (!isForbidden(e)) {
                        nonBlockingErrors.add("Production menu failed to load. ${networkErrorMessage(e)}")
                    }
                }

                uiState =
                    uiState.copy(
                        isLoading = false,
                        isRefreshing = false,
                        userName = userName,
                        userRole = userRole,
                        products = products,
                        productMenuItems = productMenuItems,
                        inventoryVariants = inventorySummary.variants,
                        inventoryCategories = inventorySummary.categories,
                        inventoryDashboard = inventoryDashboard,
                        cookedCopraStockSummary = cookedCopraStockSummary,
                        inventoryMovements = inventoryMovements,
                        dashboardData = dashboardData,
                        productionRuns = productionRuns,
                        sales = sales,
                        deliveryQueue = deliveryQueue,
                        deliveries = deliveries,
                        weighIns = weighIns,
                        weighPrices = weighPrices,
                        weighProducts = weighProducts,
                        unpaidWeighTransactions = unpaidTransactions,
                        errorMessage = nonBlockingErrors.firstOrNull(),
                    )
            } catch (e: Exception) {
                if (isUnauthorized(e)) {
                    logout()
                } else {
                    uiState =
                        uiState.copy(
                            isLoading = false,
                            isRefreshing = false,
                            errorMessage = networkErrorMessage(e),
                        )
                }
            }
        }
    }

    private fun refreshPos(
        forceRefresh: Boolean = true,
        showLoading: Boolean = true,
    ) {
        viewModelScope.launch {
            uiState =
                if (showLoading) {
                    uiState.copy(isRefreshing = true, errorMessage = null)
                } else {
                    uiState.copy(errorMessage = null)
                }
            try {
                val products = posRepository.getPosSummary(forceRefresh = forceRefresh)
                uiState =
                    uiState.copy(
                        products = products,
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                    )
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    private fun refreshSales(
        forceRefresh: Boolean = true,
        showLoading: Boolean = true,
    ) {
        viewModelScope.launch {
            uiState =
                if (showLoading) {
                    uiState.copy(isRefreshing = true, errorMessage = null)
                } else {
                    uiState.copy(errorMessage = null)
                }
            try {
                uiState =
                    uiState.copy(
                        sales = salesRepository.getSales(query = buildSalesQuery(), forceRefresh = forceRefresh),
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                    )
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    private fun refreshDeliveries() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                val queue =
                    fetchDeliveryQueueRecords(
                        statusFilter = uiState.deliveryStatusFilter,
                        dateFrom = asDateQuery(uiState.deliveryDateFrom),
                        dateTo = asDateQuery(uiState.deliveryDateTo),
                    )
                val history = api.getDeliveries(perPage = 200).data.data
                uiState =
                    uiState.copy(
                        deliveryQueue = queue,
                        deliveries = history,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
            }
        }
    }

    private fun refreshInventory(
        forceRefresh: Boolean = true,
        showLoading: Boolean = true,
    ) {
        viewModelScope.launch {
            uiState =
                if (showLoading) {
                    uiState.copy(isRefreshing = true, errorMessage = null)
                } else {
                    uiState.copy(errorMessage = null)
                }
            try {
                val summary =
                    inventoryRepository.getSummary(
                        query =
                            InventorySummaryQuery(
                                categoryId = uiState.inventoryCategoryFilter,
                                lowStockOnly = if (uiState.inventoryLowStockOnly) true else null,
                            ),
                        forceRefresh = forceRefresh,
                    )

                uiState =
                    uiState.copy(
                        inventoryCategories = summary.categories,
                        inventoryVariants = summary.variants,
                        inventoryDashboard = summary.dashboard,
                        cookedCopraStockSummary = summary.cookedCopraStockSummary,
                        inventoryMovements = summary.movements,
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                        errorMessage = summary.warningMessage,
                    )
            } catch (e: Exception) {
                uiState =
                    uiState.copy(
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                        errorMessage = networkErrorMessage(e),
                    )
            }
        }
    }

    private fun refreshProductsMenu() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                val categories = api.getPosCategories().data
                val products = api.getProducts(perPage = 100).data.data
                uiState =
                    uiState.copy(
                        productMenuItems = products,
                        inventoryCategories = categories,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
            }
        }
    }

    private fun refreshProductionRuns() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                uiState =
                    uiState.copy(
                        productionRuns = api.getProductionRuns(perPage = 200).data.data,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                if (isForbidden(e)) {
                    uiState =
                        uiState.copy(
                            isRefreshing = false,
                            productionRuns = emptyList(),
                            errorMessage = "Production is available to administrators only.",
                        )
                } else {
                    uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
                }
            }
        }
    }

    private fun refreshDashboard(
        forceRefresh: Boolean = true,
        showLoading: Boolean = true,
    ) {
        if (dashboardRefreshInFlight) {
            return
        }
        dashboardRefreshInFlight = true
        viewModelScope.launch {
            uiState =
                if (showLoading) {
                    uiState.copy(
                        isRefreshing = true,
                        errorMessage = null,
                        dashboardAccessDenied = false,
                        dashboardStatusMessage = null,
                    )
                } else {
                    uiState.copy(
                        errorMessage = null,
                        dashboardAccessDenied = false,
                        dashboardStatusMessage = null,
                    )
                }
            try {
                if (!isCurrentUserAdmin()) {
                    applyDashboardAccessDeniedState()
                    return@launch
                }

                val result = dashboardRepository.getMetrics(forceRefresh = forceRefresh)

                uiState =
                    uiState.copy(
                        dashboardData = result.dashboard,
                        inventoryDashboard = result.inventoryDashboard,
                        dashboardAccessDenied = false,
                        dashboardStatusMessage = null,
                        isRefreshing = if (showLoading) false else uiState.isRefreshing,
                        errorMessage = null,
                    )
            } catch (e: Exception) {
                if (isForbidden(e)) {
                    applyDashboardAccessDeniedState()
                } else {
                    if (showLoading) {
                        applyDashboardErrorState(networkErrorMessage(e))
                    } else {
                        uiState = uiState.copy(errorMessage = networkErrorMessage(e))
                    }
                }
            } finally {
                dashboardRefreshInFlight = false
            }
        }
    }

    fun refreshSalesReport() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                uiState =
                    uiState.copy(
                        salesReportData =
                            api.getSalesReport(
                                perPage = 200,
                                status = asQueryValue(uiState.salesReportStatusFilter),
                                dateFrom = asDateQuery(uiState.salesReportDateFrom),
                                dateTo = asDateQuery(uiState.salesReportDateTo),
                            ).data,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                if (isForbidden(e)) {
                    uiState =
                        uiState.copy(
                            isRefreshing = false,
                            salesReportData = null,
                            errorMessage = "Sales report is available to administrators only.",
                        )
                } else {
                    uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
                }
            }
        }
    }

    fun refreshWeighReport() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                uiState =
                    uiState.copy(
                        weighReportTransactions =
                            api.getWeighIns(
                                perPage = 200,
                                type = asQueryValue(uiState.weighReportTypeFilter),
                                status = asQueryValue(uiState.weighReportStatusFilter),
                                dateFrom = asDateQuery(uiState.weighReportDateFrom),
                                dateTo = asDateQuery(uiState.weighReportDateTo),
                            ).data.data,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                if (isForbidden(e)) {
                    uiState =
                        uiState.copy(
                            isRefreshing = false,
                            weighReportTransactions = emptyList(),
                            errorMessage = "Weigh-ins report is available to administrators only.",
                        )
                } else {
                    uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
                }
            }
        }
    }

    private fun refreshWeighIns() {
        viewModelScope.launch {
            uiState = uiState.copy(isRefreshing = true, errorMessage = null)
            try {
                val landing = api.getWeighLanding().data
                uiState =
                    uiState.copy(
                        weighIns =
                            api.getWeighIns(
                                perPage = 200,
                                type = asQueryValue(uiState.weighTypeFilter),
                                status = asQueryValue(uiState.weighStatusFilter),
                                dateFrom = asDateQuery(uiState.weighDateFrom),
                                dateTo = asDateQuery(uiState.weighDateTo),
                            ).data.data,
                        weighPrices = landing.prices.mapValues { entry -> entry.value.price },
                        weighProducts = landing.products,
                        unpaidWeighTransactions = api.getUnpaidWeighIns().data,
                        isRefreshing = false,
                    )
            } catch (e: Exception) {
                uiState = uiState.copy(isRefreshing = false, errorMessage = networkErrorMessage(e))
            }
        }
    }

    private suspend fun fetchDeliveryQueueRecords(
        statusFilter: String,
        dateFrom: String?,
        dateTo: String?,
    ): List<Delivery> {
        val statuses =
            when (statusFilter.trim().lowercase()) {
                "pending" -> listOf("PENDING")
                "partial" -> listOf("PARTIAL")
                "all", "" -> listOf("PENDING", "PARTIAL")
                else -> emptyList()
            }

        if (statuses.isEmpty()) {
            return emptyList()
        }

        val queueSales = mutableListOf<Sale>()
        statuses.forEach { deliveryStatus ->
            val pageData =
                api.getSales(
                    perPage = 200,
                    deliveryStatus = deliveryStatus,
                    dateFrom = dateFrom,
                    dateTo = dateTo,
                ).data.data
            queueSales.addAll(pageData)
        }

        return queueSales
            .distinctBy { it.id }
            .mapNotNull { sale -> mapSaleToDeliveryQueueRecord(sale) }
            .sortedByDescending { it.createdAt }
    }

    private fun mapSaleToDeliveryQueueRecord(sale: Sale): Delivery? {
        if (!sale.isForDelivery) {
            return null
        }

        val deliveryStatus = sale.deliveryStatus.orEmpty().uppercase()
        if (deliveryStatus != "PENDING" && deliveryStatus != "PARTIAL") {
            return null
        }

        val deliveredBySaleItemId =
            sale.deliveries
                .flatMap { it.items }
                .groupBy { it.saleItemId ?: it.id }
                .mapValues { (_, deliveryItems) ->
                    deliveryItems.sumOf { it.quantity }
                }

        val queueItems =
            sale.items.mapNotNull { saleItem ->
                val deliveredQty =
                    maxOf(
                        saleItem.deliveredQuantity ?: 0.0,
                        deliveredBySaleItemId[saleItem.id] ?: 0.0,
                    )
                val refundedQty = saleItem.refundedQuantity ?: 0.0
                val canceledQty = saleItem.canceledQuantity ?: 0.0
                val remainingQty = (saleItem.quantity - deliveredQty - refundedQty - canceledQty).coerceAtLeast(0.0)
                if (remainingQty <= 0.0) {
                    null
                } else {
                    DeliveryItem(
                        id = saleItem.id,
                        saleItemId = saleItem.id,
                        quantity = remainingQty,
                        remainingQuantity = remainingQty,
                        productVariant = saleItem.productVariant,
                    )
                }
            }

        if (queueItems.isEmpty()) {
            return null
        }

        return Delivery(
            id = sale.id,
            status = deliveryStatus.lowercase(),
            createdAt = sale.createdAt,
            notes = sale.notes,
            sale =
                DeliverySale(
                    id = sale.id,
                    saleNumber = sale.saleNumber,
                    deliveryStatus = sale.deliveryStatus,
                    deliveryName = sale.deliveryName,
                    deliveryAddress = sale.deliveryAddress,
                    deliveryContact = sale.deliveryContact,
                    createdAt = sale.createdAt,
                ),
            items = queueItems,
        )
    }

    private fun asQueryValue(value: String): String? {
        val trimmed = value.trim()
        return if (trimmed.isBlank() || trimmed.equals("all", ignoreCase = true)) null else trimmed
    }

    private fun asDateQuery(value: String): String? {
        val trimmed = value.trim()
        return if (trimmed.isBlank()) null else trimmed
    }

    private fun variantAvailableForPos(variant: ProductVariant): Double {
        val stock = variant.inventory?.quantityOnHand ?: 0.0
        val reserved = variant.reservedForDelivery ?: 0.0
        val availableFromApi = variant.availableQuantity
        return (availableFromApi ?: (stock - reserved)).coerceAtLeast(0.0)
    }

    private fun isOfflineQueueableError(e: Exception): Boolean {
        if (e is IOException) {
            return true
        }

        if (e is HttpException) {
            return e.code() in 500..599 || e.code() == 408 || e.code() == 429
        }

        return false
    }

    private fun isUnauthorized(e: Exception): Boolean {
        return e is HttpException && e.code() == 401
    }

    private fun isForbidden(e: Exception): Boolean {
        return e is HttpException && e.code() == 403
    }

    private fun isCurrentUserAdmin(): Boolean {
        return isAdminRole(uiState.userRole)
    }

    private fun isCurrentUserStaff(): Boolean {
        return isStaffRole(uiState.userRole)
    }

    private fun isAdminRole(role: String?): Boolean {
        return canonicalizeRole(role) == "admin"
    }

    private fun isStaffRole(role: String?): Boolean {
        return canonicalizeRole(role) == "staff"
    }

    private fun canonicalizeRole(role: String?): String? {
        val normalized = role?.trim()?.lowercase().orEmpty()
        if (normalized.isBlank()) {
            return null
        }

        return when (normalized) {
            "admin", "administrator", "owner", "manager" -> "admin"
            "staff", "cashier", "employee" -> "staff"
            else -> normalized
        }
    }

    private fun prettyType(type: String): String {
        return when (type.lowercase()) {
            "cooked_copra" -> "Cooked Copra"
            "uncooked_copra" -> "Uncooked Copra"
            "coconut" -> "Coconut"
            "bagol" -> "Bagol"
            else -> type.replace('_', ' ').replaceFirstChar { it.uppercaseChar() }
        }
    }

    private fun normalizeReceiptTextForPrint(raw: String): String {
        if (raw.isBlank()) {
            return raw
        }

        return raw
            .replace("\r\n", "\n")
            .replace('\r', '\n')
            .lineSequence()
            .map { line ->
                val trimmed = line.trim()
                if (trimmed.isNotEmpty() && trimmed.all { char -> char in receiptSeparatorChars }) {
                    receiptSeparatorChar.toString().repeat(receiptCharWidth)
                } else {
                    line
                }
            }
            .joinToString("\n")
    }

    private fun networkErrorMessage(e: Exception): String {
        if (e is HttpException) {
            val serverMessage = extractServerErrorMessage(e)
            return when (e.code()) {
                401 -> serverMessage ?: "Session expired. Please login again."
                403 -> serverMessage ?: "You do not have permission to perform this action."
                422 -> serverMessage ?: "Invalid request. Please check input."
                else -> serverMessage ?: "Server error (${e.code()})."
            }
        }
        return e.message ?: "Request failed. Check network and API_BASE_URL."
    }

    private fun extractServerErrorMessage(e: HttpException): String? {
        return try {
            val body = e.response()?.errorBody()?.string()?.trim().orEmpty()
            if (body.isBlank()) {
                return null
            }

            val json = JSONObject(body)
            val errors = json.optJSONObject("errors")
            if (errors != null) {
                val keys = errors.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val messages = errors.optJSONArray(key)
                    if (messages != null && messages.length() > 0) {
                        val firstMessage = messages.optString(0).trim()
                        if (firstMessage.isNotBlank()) {
                            return firstMessage
                        }
                    }
                }
            }

            json.optString("message").trim().ifBlank { null }
        } catch (_: Exception) {
            null
        }
    }
}
