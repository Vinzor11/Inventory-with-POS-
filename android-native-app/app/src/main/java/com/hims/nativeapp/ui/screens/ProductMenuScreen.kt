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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckCircleOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.ToggleOff
import androidx.compose.material.icons.outlined.ToggleOn
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hims.nativeapp.BuildConfig
import com.hims.nativeapp.data.model.Product
import com.hims.nativeapp.data.model.ProductCategory
import com.hims.nativeapp.data.model.ProductVariant
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.ui.components.rememberIncrementalListState
import com.hims.nativeapp.util.formatPeso
import com.hims.nativeapp.util.formatQty
import com.hims.nativeapp.util.fullImageUrl

private data class ProductStockGroup(
    val label: String,
    val products: List<Product>,
)

private fun totalProductStock(product: Product): Double {
    return product.variants.sumOf { variant -> variant.inventory?.quantityOnHand ?: 0.0 }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ProductMenuScreen(
    products: List<Product>,
    categories: List<ProductCategory>,
    searchQuery: String,
    selectedCategoryId: Int?,
    activeFilter: String,
    isActionLoading: Boolean,
    onCreateProduct: (
        name: String,
        description: String,
        categoryId: Int?,
        baseUnit: String,
        imageUrl: String,
        isActive: Boolean,
        trackStock: Boolean,
        onSuccess: () -> Unit,
    ) -> Unit,
    onUpdateProduct: (
        productId: Int,
        name: String,
        description: String,
        categoryId: Int?,
        baseUnit: String,
        imageUrl: String,
        isActive: Boolean,
        trackStock: Boolean,
        onSuccess: () -> Unit,
    ) -> Unit,
    onToggleStock: (productId: Int, onSuccess: () -> Unit) -> Unit,
    onToggleActive: (productId: Int, onSuccess: () -> Unit) -> Unit,
    onAddVariant: (
        productId: Int,
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit,
    ) -> Unit,
    onUpdateVariant: (
        productId: Int,
        variantId: Int,
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit,
    ) -> Unit,
    onFullscreenModeChange: (Boolean) -> Unit = {},
) {
    var expandedProductId by remember { mutableStateOf<Int?>(null) }
    var showCreateForm by remember { mutableStateOf(false) }
    var editProduct by remember { mutableStateOf<Product?>(null) }
    var detailProductId by remember { mutableStateOf<Int?>(null) }

    val detailProduct =
        remember(products, detailProductId) {
            val id = detailProductId
            if (id == null) {
                null
            } else {
                products.firstOrNull { product -> product.id == id }
            }
        }

    LaunchedEffect(detailProductId != null) {
        onFullscreenModeChange(detailProductId != null)
    }
    DisposableEffect(Unit) {
        onDispose { onFullscreenModeChange(false) }
    }

    LaunchedEffect(detailProductId, detailProduct) {
        if (detailProductId != null && detailProduct == null) {
            detailProductId = null
        }
    }

    val filtered =
        remember(products, searchQuery, selectedCategoryId, activeFilter) {
            val q = searchQuery.trim()
            products
                .filter { product ->
                    val matchesSearch =
                        if (q.isBlank()) {
                            true
                        } else {
                            product.name.contains(q, ignoreCase = true) ||
                                product.description.orEmpty().contains(q, ignoreCase = true) ||
                                product.category?.name.orEmpty().contains(q, ignoreCase = true) ||
                                product.variants.any { it.description.orEmpty().contains(q, ignoreCase = true) }
                        }
                    val matchesCategory = selectedCategoryId == null || product.category?.id == selectedCategoryId
                    val matchesStatus =
                        when (activeFilter.lowercase()) {
                            "active" -> product.isActive
                            "inactive" -> !product.isActive
                            else -> true
                        }
                    matchesSearch && matchesCategory && matchesStatus
                }.sortedWith(
                    compareByDescending<Product> { totalProductStock(it) }
                        .thenBy { it.name.lowercase() },
                )
        }
    val incrementalState = rememberIncrementalListState(totalItems = filtered.size)
    val visibleProducts =
        remember(filtered, incrementalState.visibleCount) {
            filtered.take(incrementalState.visibleCount)
        }

    val groupedByStock =
        remember(visibleProducts) {
            val inStock = visibleProducts.filter { product -> totalProductStock(product) > 10.0 }
            val lowStock =
                visibleProducts.filter { product ->
                    val stock = totalProductStock(product)
                    stock > 0.0 && stock <= 10.0
                }
            val outOfStock = visibleProducts.filter { product -> totalProductStock(product) <= 0.0 }

            listOf(
                ProductStockGroup(label = "In Stock", products = inStock),
                ProductStockGroup(label = "Low Stock", products = lowStock),
                ProductStockGroup(label = "Out of Stock", products = outOfStock),
            ).filter { group -> group.products.isNotEmpty() }
        }

    if (detailProduct != null && detailProductId != null) {
        ProductDetailsFullScreen(
            product = detailProduct,
            isActionLoading = isActionLoading,
            onDismiss = { detailProductId = null },
            onAddVariant = { sku, description, unitPrice, costPrice, onSuccess ->
                onAddVariant(
                    detailProduct.id,
                    sku,
                    description,
                    unitPrice,
                    costPrice,
                    onSuccess,
                )
            },
            onUpdateVariant = { variantId, sku, description, unitPrice, costPrice, onSuccess ->
                onUpdateVariant(
                    detailProduct.id,
                    variantId,
                    sku,
                    description,
                    unitPrice,
                    costPrice,
                    onSuccess,
                )
            },
        )
    } else {
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
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (filtered.isEmpty()) {
                    item("empty-products") {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "No products found.",
                                color = Color(0xFF6B7280),
                                fontSize = 14.sp,
                            )
                        }
                    }
                } else {
                    groupedByStock.forEach { group ->
                        stickyHeader(key = "product-stock-${group.label}") {
                            Box(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .background(AppBackground)
                                        .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = group.label,
                                    color = TextCharcoal,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        }

                        items(group.products, key = { it.id }) { product ->
                            ProductMenuCard(
                                product = product,
                                expanded = expandedProductId == product.id,
                                onToggleExpand = {
                                    expandedProductId =
                                        if (expandedProductId == product.id) {
                                            null
                                        } else {
                                            product.id
                                        }
                                },
                                onView = { detailProductId = product.id },
                                onEdit = { editProduct = product },
                                onToggleStock = { onToggleStock(product.id) { } },
                                onToggleActive = { onToggleActive(product.id) { } },
                            )
                        }
                    }
                    if (incrementalState.visibleCount < filtered.size) {
                        item("load-more-products-menu") {
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
                }
            }

            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 20.dp, bottom = 92.dp)
                        .size(54.dp)
                        .background(PrimaryBlue, RoundedCornerShape(27.dp))
                        .clickable { showCreateForm = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Add,
                    contentDescription = "Add Product",
                    tint = BaseWhite,
                    modifier = Modifier.size(28.dp),
                )
            }
        }
    }

    if (showCreateForm) {
        ProductFormDialog(
            title = "Create Product",
            categories = categories,
            isActionLoading = isActionLoading,
            onDismiss = { if (!isActionLoading) showCreateForm = false },
            onSubmit = { name, description, categoryId, baseUnit, imageUrl, isActive, trackStock ->
                onCreateProduct(
                    name,
                    description,
                    categoryId,
                    baseUnit,
                    imageUrl,
                    isActive,
                    trackStock,
                ) {
                    showCreateForm = false
                }
            },
        )
    }

    editProduct?.let { editing ->
        ProductFormDialog(
            title = "Edit Product",
            categories = categories,
            initialProduct = editing,
            isActionLoading = isActionLoading,
            onDismiss = { if (!isActionLoading) editProduct = null },
            onSubmit = { name, description, categoryId, baseUnit, imageUrl, isActive, trackStock ->
                onUpdateProduct(
                    editing.id,
                    name,
                    description,
                    categoryId,
                    baseUnit,
                    imageUrl,
                    isActive,
                    trackStock,
                ) {
                    editProduct = null
                }
            },
        )
    }
}

@Composable
private fun ProductMenuCard(
    product: Product,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onView: () -> Unit,
    onEdit: () -> Unit,
    onToggleStock: () -> Unit,
    onToggleActive: () -> Unit,
) {
    val firstVariant = product.variants.firstOrNull()
    val firstStock = firstVariant?.inventory?.quantityOnHand ?: 0.0
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, product.image)
    val statusText = if (product.isActive) "Active" else "Inactive"
    val statusColor = if (product.isActive) Color(0xFF059669) else Color(0xFF9CA3AF)

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleExpand),
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
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = product.name,
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = statusText,
                    color = statusColor,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = product.category?.name ?: "-",
                color = Color(0xFF374151),
                fontSize = 13.sp,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Box(
                    modifier =
                        Modifier
                            .size(74.dp)
                            .background(Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = product.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Outlined.Image,
                            contentDescription = null,
                            tint = Color(0xFF9CA3AF),
                            modifier = Modifier.size(30.dp),
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = firstVariant?.description ?: "No variants yet",
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "Variants: ${product.variants.size}",
                        color = Color(0xFF374151),
                        fontSize = 14.sp,
                    )
                    Text(
                        text = "Stock: ${formatQty(firstStock)} ${product.baseUnit ?: ""}".trim(),
                        color = Color(0xFF374151),
                        fontSize = 14.sp,
                    )
                }
                Text(
                    text = firstVariant?.unitPrice?.let { formatPeso(it) } ?: "-",
                    color = TextCharcoal,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.clickable(onClick = onToggleExpand),
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

            if (expanded) {
                HorizontalDivider(modifier = Modifier.padding(top = 10.dp, bottom = 6.dp), color = BorderSoft)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    ActionButton(
                        icon = Icons.Outlined.Visibility,
                        label = "View",
                        color = TextCharcoal,
                        onClick = onView,
                    )
                    ActionButtonDivider()
                    ActionButton(
                        icon = Icons.Outlined.Edit,
                        label = "Edit",
                        color = SafetyOrange,
                        onClick = onEdit,
                    )
                    ActionButtonDivider()
                    ActionButton(
                        icon = Icons.Outlined.Inventory2,
                        label = if (product.trackStock) "Stock On" else "Stock Off",
                        color = if (product.trackStock) PrimaryBlue else Color(0xFF9CA3AF),
                        onClick = onToggleStock,
                    )
                    ActionButtonDivider()
                    ActionButton(
                        icon = if (product.isActive) Icons.Outlined.ToggleOn else Icons.Outlined.ToggleOff,
                        label = if (product.isActive) "Active" else "Inactive",
                        color = if (product.isActive) Color(0xFF059669) else Color(0xFF9CA3AF),
                        onClick = onToggleActive,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductDetailsFullScreen(
    product: Product,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onAddVariant: (
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit,
    ) -> Unit,
    onUpdateVariant: (
        variantId: Int,
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
        onSuccess: () -> Unit,
    ) -> Unit,
) {
    val imageUrl = fullImageUrl(BuildConfig.API_BASE_URL, product.image)
    val sortedVariants =
        remember(product.id, product.variants) {
            product.variants.sortedWith(
                compareByDescending<ProductVariant> { it.inventory?.quantityOnHand ?: 0.0 }
                    .thenBy { it.description.orEmpty().lowercase() },
            )
        }
    var showAddVariant by remember(product.id) { mutableStateOf(false) }
    var editVariant by remember(product.id) { mutableStateOf<ProductVariant?>(null) }

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
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = product.name,
                            modifier = Modifier.fillMaxWidth().height(220.dp),
                            contentScale = ContentScale.Crop,
                        )
                    }
                    Text(
                        text = product.name,
                        color = TextCharcoal,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    DetailRow(label = "Category", value = product.category?.name ?: "-")
                    DetailRow(label = "Base Unit", value = product.baseUnit ?: "-")
                    DetailRow(label = "Status", value = if (product.isActive) "Active" else "Inactive")
                    DetailRow(label = "Track Stock", value = if (product.trackStock) "Enabled" else "Disabled")
                    if (!product.description.isNullOrBlank()) {
                        DetailRow(label = "Description", value = product.description)
                    }
                }
            }

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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Variants",
                            color = TextCharcoal,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(
                            enabled = !isActionLoading,
                            onClick = { showAddVariant = true },
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Add,
                                contentDescription = null,
                                tint = PrimaryBlue,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Add",
                                color = PrimaryBlue,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                            )
                        }
                    }
                    if (sortedVariants.isEmpty()) {
                        Text(
                            text = "No variants available.",
                            color = Color(0xFF6B7280),
                            fontSize = 13.sp,
                        )
                    } else {
                        sortedVariants.forEachIndexed { index, variant ->
                            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text = variant.description ?: "-",
                                        color = TextCharcoal,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier.weight(1f),
                                    )
                                    TextButton(
                                        enabled = !isActionLoading,
                                        onClick = { editVariant = variant },
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Edit,
                                            contentDescription = null,
                                            tint = SafetyOrange,
                                            modifier = Modifier.size(15.dp),
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "Edit",
                                            color = SafetyOrange,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                }
                                if (!variant.sku.isNullOrBlank()) {
                                    Text(
                                        text = "SKU: ${variant.sku}",
                                        color = Color(0xFF6B7280),
                                        fontSize = 12.sp,
                                    )
                                }
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(
                                        text = "Stock: ${formatQty(variant.inventory?.quantityOnHand ?: 0.0)} ${product.baseUnit.orEmpty()}".trim(),
                                        color = Color(0xFF374151),
                                        fontSize = 13.sp,
                                    )
                                    Text(
                                        text = formatPeso(variant.unitPrice),
                                        color = TextCharcoal,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                                if (variant.costPrice != null) {
                                    Text(
                                        text = "Cost: ${formatPeso(variant.costPrice)}",
                                        color = Color(0xFF6B7280),
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                            if (index < sortedVariants.lastIndex) {
                                HorizontalDivider(color = BorderSoft, modifier = Modifier.padding(vertical = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddVariant) {
        VariantFormDialog(
            title = "Add Variant",
            isActionLoading = isActionLoading,
            onDismiss = {
                if (!isActionLoading) {
                    showAddVariant = false
                }
            },
            onSubmit = { sku, description, unitPrice, costPrice ->
                onAddVariant(
                    sku,
                    description,
                    unitPrice,
                    costPrice,
                ) {
                    showAddVariant = false
                }
            },
        )
    }

    editVariant?.let { variant ->
        VariantFormDialog(
            title = "Edit Variant",
            initialVariant = variant,
            isActionLoading = isActionLoading,
            onDismiss = {
                if (!isActionLoading) {
                    editVariant = null
                }
            },
            onSubmit = { sku, description, unitPrice, costPrice ->
                onUpdateVariant(
                    variant.id,
                    sku,
                    description,
                    unitPrice,
                    costPrice,
                ) {
                    editVariant = null
                }
            },
        )
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
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
            color = TextCharcoal,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VariantFormDialog(
    title: String,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (
        sku: String,
        description: String,
        unitPrice: Double,
        costPrice: Double?,
    ) -> Unit,
    initialVariant: ProductVariant? = null,
) {
    var sku by remember(initialVariant?.id) { mutableStateOf(initialVariant?.sku.orEmpty()) }
    var description by remember(initialVariant?.id) { mutableStateOf(initialVariant?.description.orEmpty()) }
    var unitPrice by remember(initialVariant?.id) { mutableStateOf(initialVariant?.unitPrice?.toString().orEmpty()) }
    var costPrice by remember(initialVariant?.id) { mutableStateOf(initialVariant?.costPrice?.toString().orEmpty()) }
    var localError by remember(initialVariant?.id) { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderSoft, RoundedCornerShape(14.dp))
                            .padding(12.dp),
                ) {
                    Text(
                        text = title,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    OutlinedTextField(
                        value = sku,
                        onValueChange = {
                            sku = it
                            localError = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isActionLoading,
                        label = { Text("SKU (Optional)") },
                    )
                    OutlinedTextField(
                        value = description,
                        onValueChange = {
                            description = it
                            localError = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isActionLoading,
                        label = { Text("Variant Description") },
                    )
                    OutlinedTextField(
                        value = unitPrice,
                        onValueChange = {
                            unitPrice = it
                            localError = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isActionLoading,
                        label = { Text("Unit Price") },
                        prefix = { Text("\u20B1") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    OutlinedTextField(
                        value = costPrice,
                        onValueChange = {
                            costPrice = it
                            localError = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isActionLoading,
                        label = { Text("Cost Price (Optional)") },
                        prefix = { Text("\u20B1") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    localError?.let {
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
                        val normalizedDescription = description.trim()
                        if (normalizedDescription.isBlank()) {
                            localError = "Variant description is required."
                            return@Button
                        }

                        val parsedUnitPrice = unitPrice.trim().toDoubleOrNull()
                        if (parsedUnitPrice == null || parsedUnitPrice < 0.0) {
                            localError = "Unit price must be a valid non-negative number."
                            return@Button
                        }

                        val parsedCostPrice =
                            if (costPrice.trim().isBlank()) {
                                null
                            } else {
                                costPrice.trim().toDoubleOrNull()
                            }
                        if (parsedCostPrice != null && parsedCostPrice < 0.0) {
                            localError = "Cost price must be non-negative."
                            return@Button
                        }

                        onSubmit(
                            sku.trim(),
                            normalizedDescription,
                            parsedUnitPrice,
                            parsedCostPrice,
                        )
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
                        text = if (isActionLoading) "Saving..." else "Save",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ActionButtonDivider() {
    Box(
        modifier =
            Modifier
                .height(34.dp)
                .width(1.dp)
                .background(Color(0xFFE5E7EB)),
    )
}

@Composable
private fun RowScope.ActionButton(
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProductFormDialog(
    title: String,
    categories: List<ProductCategory>,
    isActionLoading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (
        name: String,
        description: String,
        categoryId: Int?,
        baseUnit: String,
        imageUrl: String,
        isActive: Boolean,
        trackStock: Boolean,
    ) -> Unit,
    initialProduct: Product? = null,
) {
    var name by remember(initialProduct?.id) { mutableStateOf(initialProduct?.name ?: "") }
    var description by remember(initialProduct?.id) { mutableStateOf(initialProduct?.description.orEmpty()) }
    var categoryId by remember(initialProduct?.id) { mutableStateOf(initialProduct?.category?.id) }
    var baseUnit by remember(initialProduct?.id) { mutableStateOf(initialProduct?.baseUnit.orEmpty()) }
    var imageUrl by remember(initialProduct?.id) { mutableStateOf(initialProduct?.image.orEmpty()) }
    var isActive by remember(initialProduct?.id) { mutableStateOf(initialProduct?.isActive ?: true) }
    var trackStock by remember(initialProduct?.id) { mutableStateOf(initialProduct?.trackStock ?: true) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                        text = title,
                        color = TextCharcoal,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                    )
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Name") },
                        enabled = !isActionLoading,
                    )
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text("Description") },
                        enabled = !isActionLoading,
                    )
                    Text(
                        text = "Category",
                        color = TextCharcoal,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    categories.chunked(2).forEach { rowCategories ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            rowCategories.forEach { category ->
                                Row(
                                    modifier =
                                        Modifier
                                            .weight(1f)
                                            .background(
                                                if (categoryId == category.id) Color(0xFFE8EEF9) else BaseWhite,
                                                RoundedCornerShape(8.dp),
                                            )
                                            .border(
                                                width = 1.dp,
                                                color = if (categoryId == category.id) PrimaryBlue else BorderSoft,
                                                shape = RoundedCornerShape(8.dp),
                                            )
                                            .clickable(enabled = !isActionLoading) { categoryId = category.id }
                                            .padding(horizontal = 10.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text = category.name,
                                        color = if (categoryId == category.id) PrimaryBlue else TextCharcoal,
                                        fontSize = 13.sp,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    if (categoryId == category.id) {
                                        Icon(
                                            imageVector = Icons.Outlined.CheckCircleOutline,
                                            contentDescription = null,
                                            tint = PrimaryBlue,
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }
                            }
                            if (rowCategories.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    OutlinedTextField(
                        value = baseUnit,
                        onValueChange = { baseUnit = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Base Unit (e.g. bag, kg)") },
                        enabled = !isActionLoading,
                    )
                    OutlinedTextField(
                        value = imageUrl,
                        onValueChange = { imageUrl = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Image URL (Optional)") },
                        enabled = !isActionLoading,
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        ToggleChip(
                            label = if (isActive) "Active" else "Inactive",
                            selected = isActive,
                            onClick = { isActive = !isActive },
                            enabled = !isActionLoading,
                            modifier = Modifier.weight(1f),
                        )
                        ToggleChip(
                            label = if (trackStock) "Track Stock" else "No Stock Tracking",
                            selected = trackStock,
                            onClick = { trackStock = !trackStock },
                            enabled = !isActionLoading,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
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
                        onSubmit(name, description, categoryId, baseUnit, imageUrl, isActive, trackStock)
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
                    Text(text = if (isActionLoading) "Saving..." else "Save", fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ToggleChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .background(if (selected) Color(0xFFE8EEF9) else BaseWhite, RoundedCornerShape(8.dp))
                .border(1.dp, if (selected) PrimaryBlue else BorderSoft, RoundedCornerShape(8.dp))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) PrimaryBlue else TextCharcoal,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
