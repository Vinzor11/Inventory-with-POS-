package com.hims.nativeapp.data.network

import com.hims.nativeapp.data.model.ApiEnvelope
import com.hims.nativeapp.data.model.AddDeliveryRequest
import com.hims.nativeapp.data.model.AddPaymentData
import com.hims.nativeapp.data.model.AddPaymentRequest
import com.hims.nativeapp.data.model.CookedCopraSaleRequest
import com.hims.nativeapp.data.model.CookedCopraSaleResult
import com.hims.nativeapp.data.model.CookedCopraStockSummary
import com.hims.nativeapp.data.model.CreateRefundRequest
import com.hims.nativeapp.data.model.CancelSaleItemRequest
import com.hims.nativeapp.data.model.DashboardData
import com.hims.nativeapp.data.model.Delivery
import com.hims.nativeapp.data.model.DeliveryForSaleData
import com.hims.nativeapp.data.model.DeliveryReceiptData
import com.hims.nativeapp.data.model.InventoryDashboardData
import com.hims.nativeapp.data.model.InventoryAdjustRequest
import com.hims.nativeapp.data.model.InventoryMovement
import com.hims.nativeapp.data.model.InventoryVariant
import com.hims.nativeapp.data.model.LoginData
import com.hims.nativeapp.data.model.LoginRequest
import com.hims.nativeapp.data.model.PaginatedData
import com.hims.nativeapp.data.model.PinRequest
import com.hims.nativeapp.data.model.PosCheckoutData
import com.hims.nativeapp.data.model.PosCheckoutRequest
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.data.model.ProductUpsertRequest
import com.hims.nativeapp.data.model.ProductVariant
import com.hims.nativeapp.data.model.ProductVariantUpsertRequest
import com.hims.nativeapp.data.model.ProductionRun
import com.hims.nativeapp.data.model.ProductionRunRequest
import com.hims.nativeapp.data.model.RefundForSaleData
import com.hims.nativeapp.data.model.Sale
import com.hims.nativeapp.data.model.SalePayment
import com.hims.nativeapp.data.model.SaleReceiptData
import com.hims.nativeapp.data.model.SalesReportData
import com.hims.nativeapp.data.model.StockInRequest
import com.hims.nativeapp.data.model.VoidSaleRequest
import com.hims.nativeapp.data.model.WeighLandingData
import com.hims.nativeapp.data.model.WeighBatchStoreRequest
import com.hims.nativeapp.data.model.WeighInPrice
import com.hims.nativeapp.data.model.WeighPriceUpdateRequest
import com.hims.nativeapp.data.model.WeighInTransaction
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiEnvelope<LoginData>

    @GET("api/pos/products")
    suspend fun getPosProducts(
        @Query("category_id") categoryId: Int? = null,
    ): ApiEnvelope<List<Product>>

    @GET("api/pos/categories")
    suspend fun getPosCategories(): ApiEnvelope<List<ProductCategory>>

    @GET("api/products")
    suspend fun getProducts(
        @Query("per_page") perPage: Int = 200,
        @Query("search") search: String? = null,
        @Query("category_id") categoryId: Int? = null,
        @Query("active_only") activeOnly: Boolean? = null,
    ): ApiEnvelope<PaginatedData<Product>>

    @POST("api/products")
    suspend fun createProduct(
        @Body request: ProductUpsertRequest,
    ): ApiEnvelope<Product>

    @PUT("api/products/{productId}")
    suspend fun updateProduct(
        @Path("productId") productId: Int,
        @Body request: ProductUpsertRequest,
    ): ApiEnvelope<Product>

    @retrofit2.http.PATCH("api/products/{productId}/toggle-stock")
    suspend fun toggleProductStock(
        @Path("productId") productId: Int,
    ): ApiEnvelope<Product>

    @retrofit2.http.PATCH("api/products/{productId}/toggle-active")
    suspend fun toggleProductActive(
        @Path("productId") productId: Int,
    ): ApiEnvelope<Product>

    @POST("api/products/{productId}/variants")
    suspend fun createProductVariant(
        @Path("productId") productId: Int,
        @Body request: ProductVariantUpsertRequest,
    ): ApiEnvelope<ProductVariant>

    @PUT("api/products/{productId}/variants/{variantId}")
    suspend fun updateProductVariant(
        @Path("productId") productId: Int,
        @Path("variantId") variantId: Int,
        @Body request: ProductVariantUpsertRequest,
    ): ApiEnvelope<ProductVariant>

    @POST("api/pos/checkout")
    suspend fun checkoutPos(
        @Body request: PosCheckoutRequest,
    ): ApiEnvelope<PosCheckoutData>

    @POST("api/pos/verify-pin")
    suspend fun verifyPin(
        @Body request: PinRequest,
    ): ApiEnvelope<Map<String, Any?>>

    @GET("api/sales")
    suspend fun getSales(
        @Query("per_page") perPage: Int = 30,
        @Query("status") status: String? = null,
        @Query("payment_status") paymentStatus: String? = null,
        @Query("delivery_status") deliveryStatus: String? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
    ): ApiEnvelope<PaginatedData<Sale>>

    @GET("api/sales/{saleId}")
    suspend fun getSale(
        @Path("saleId") saleId: Int,
    ): ApiEnvelope<Sale>

    @POST("api/sales/{saleId}/void")
    suspend fun voidSale(
        @Path("saleId") saleId: Int,
        @Body request: VoidSaleRequest,
    ): ApiEnvelope<Sale>

    @POST("api/sales/{saleId}/cancel-item")
    suspend fun cancelSaleItem(
        @Path("saleId") saleId: Int,
        @Body request: CancelSaleItemRequest,
    ): ApiEnvelope<Sale>

    @GET("api/receipts/sales/{saleId}")
    suspend fun getSaleReceipt(
        @Path("saleId") saleId: Int,
        @Query("char_width") charWidth: Int = 80,
    ): ApiEnvelope<SaleReceiptData>

    @GET("api/sales/{saleId}/payments")
    suspend fun getSalePayments(
        @Path("saleId") saleId: Int,
    ): ApiEnvelope<List<SalePayment>>

    @POST("api/sales/{saleId}/payments")
    suspend fun addSalePayment(
        @Path("saleId") saleId: Int,
        @Body request: AddPaymentRequest,
    ): ApiEnvelope<AddPaymentData>

    @GET("api/sales/{saleId}/refund")
    suspend fun getRefundForSale(
        @Path("saleId") saleId: Int,
    ): ApiEnvelope<RefundForSaleData>

    @POST("api/sales/{saleId}/refund")
    suspend fun createRefund(
        @Path("saleId") saleId: Int,
        @Body request: CreateRefundRequest,
    ): ApiEnvelope<Any>

    @GET("api/deliveries")
    suspend fun getDeliveries(
        @Query("per_page") perPage: Int = 30,
        @Query("status") status: String? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
    ): ApiEnvelope<PaginatedData<Delivery>>

    @GET("api/deliveries/{deliveryId}")
    suspend fun getDelivery(
        @Path("deliveryId") deliveryId: Int,
    ): ApiEnvelope<Delivery>

    @GET("api/sales/{saleId}/delivery")
    suspend fun getSaleDeliveryDetails(
        @Path("saleId") saleId: Int,
    ): ApiEnvelope<DeliveryForSaleData>

    @POST("api/sales/{saleId}/deliveries")
    suspend fun addSaleDeliveryItems(
        @Path("saleId") saleId: Int,
        @Body request: AddDeliveryRequest,
    ): ApiEnvelope<Delivery>

    @GET("api/receipts/deliveries/{deliveryId}")
    suspend fun getDeliveryReceipt(
        @Path("deliveryId") deliveryId: Int,
        @Query("char_width") charWidth: Int = 80,
    ): ApiEnvelope<DeliveryReceiptData>

    @GET("api/weigh-ins")
    suspend fun getWeighIns(
        @Query("per_page") perPage: Int = 30,
        @Query("type") type: String? = null,
        @Query("status") status: String? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
    ): ApiEnvelope<PaginatedData<WeighInTransaction>>

    @GET("api/weigh-ins/unpaid")
    suspend fun getUnpaidWeighIns(): ApiEnvelope<List<WeighInTransaction>>

    @GET("api/weigh-ins/landing")
    suspend fun getWeighLanding(): ApiEnvelope<WeighLandingData>

    @POST("api/weigh-ins/batch-store")
    suspend fun batchStoreWeighIns(
        @Body request: WeighBatchStoreRequest,
    ): ApiEnvelope<WeighInTransaction>

    @POST("api/weigh-ins/{weighInId}/mark-as-paid")
    suspend fun markWeighTransactionPaid(
        @Path("weighInId") weighInId: Int,
        @Body request: PinRequest,
    ): ApiEnvelope<WeighInTransaction>

    @POST("api/weigh-ins/{weighInId}/process-payment")
    suspend fun processWeighPayment(
        @Path("weighInId") weighInId: Int,
        @Body request: PinRequest,
    ): ApiEnvelope<WeighInTransaction>

    @GET("api/weigh-in-prices")
    suspend fun getWeighPrices(): ApiEnvelope<Map<String, WeighInPrice>>

    @PUT("api/weigh-in-prices/{type}")
    suspend fun updateWeighPrice(
        @Path("type") type: String,
        @Body request: WeighPriceUpdateRequest,
    ): ApiEnvelope<WeighInPrice>

    @PUT("api/weigh-ins/{weighInId}/status")
    suspend fun updateWeighStatus(
        @Path("weighInId") weighInId: Int,
        @Body body: Map<String, String>,
    ): ApiEnvelope<WeighInTransaction>

    @GET("api/inventory")
    suspend fun getInventory(
        @Query("per_page") perPage: Int = 200,
        @Query("search") search: String? = null,
        @Query("category_id") categoryId: Int? = null,
        @Query("low_stock_only") lowStockOnly: Boolean? = null,
    ): ApiEnvelope<PaginatedData<InventoryVariant>>

    @GET("api/inventory/dashboard")
    suspend fun getInventoryDashboard(): ApiEnvelope<InventoryDashboardData>

    @GET("api/dashboard")
    suspend fun getDashboard(): ApiEnvelope<DashboardData>

    @GET("api/reports/sales")
    suspend fun getSalesReport(
        @Query("per_page") perPage: Int = 100,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
        @Query("status") status: String? = null,
        @Query("cashier_id") cashierId: Int? = null,
    ): ApiEnvelope<SalesReportData>

    @GET("api/production/runs")
    suspend fun getProductionRuns(
        @Query("per_page") perPage: Int = 100,
        @Query("run_type") runType: String? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
    ): ApiEnvelope<PaginatedData<ProductionRun>>

    @POST("api/production/runs")
    suspend fun createProductionRun(
        @Body request: ProductionRunRequest,
    ): ApiEnvelope<ProductionRun>

    @GET("api/cooked-copra/stock-summary")
    suspend fun getCookedCopraStockSummary(): ApiEnvelope<CookedCopraStockSummary>

    @POST("api/cooked-copra/sales")
    suspend fun createCookedCopraSale(
        @Body request: CookedCopraSaleRequest,
    ): ApiEnvelope<CookedCopraSaleResult>

    @GET("api/inventory/movements")
    suspend fun getInventoryMovements(
        @Query("per_page") perPage: Int = 200,
        @Query("type") type: String? = null,
        @Query("reason") reason: String? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
    ): ApiEnvelope<PaginatedData<InventoryMovement>>

    @POST("api/inventory/stock-in")
    suspend fun stockInInventory(
        @Body request: StockInRequest,
    ): ApiEnvelope<Map<String, Any?>>

    @POST("api/inventory/{variantId}/adjust")
    suspend fun adjustInventory(
        @Path("variantId") variantId: Int,
        @Body request: InventoryAdjustRequest,
    ): ApiEnvelope<InventoryVariant>
}
