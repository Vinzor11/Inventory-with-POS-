package com.hims.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
import com.hims.nativeapp.data.local.ProductPagedEntity
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal
import com.hims.nativeapp.util.formatPeso

@Composable
fun ProductsPagingScreen(
    searchQuery: String,
    selectedCategoryId: Int?,
    activeFilter: String,
    vm: ProductsPagingViewModel = viewModel(),
) {
    LaunchedEffect(searchQuery, selectedCategoryId, activeFilter) {
        vm.updateFilters(
            search = searchQuery,
            categoryId = selectedCategoryId,
            activeFilter = activeFilter,
        )
    }

    val products = vm.products.collectAsLazyPagingItems()

    Box(
        modifier = Modifier.fillMaxSize().background(AppBackground),
    ) {
        when (val refresh = products.loadState.refresh) {
            is LoadState.Loading -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            is LoadState.Error -> {
                ErrorState(
                    message = refresh.error.message ?: "Failed to load products.",
                    onRetry = products::retry,
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            is LoadState.NotLoading -> {
                if (products.itemCount == 0) {
                    EmptyState(
                        text = "No products found.",
                        modifier = Modifier.align(Alignment.Center),
                    )
                } else {
                    ProductsList(products = products)
                }
            }
        }
    }
}

@Composable
private fun ProductsList(products: LazyPagingItems<ProductPagedEntity>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(
            count = products.itemCount,
            key = products.itemKey { "${it.searchKey}-${it.variantId}" },
        ) { index ->
            val item = products[index]
            if (item != null) {
                ProductPagedRow(item = item)
            }
        }

        item(key = "append_state") {
            when (val append = products.loadState.append) {
                is LoadState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }

                is LoadState.Error -> {
                    ErrorState(
                        message = append.error.message ?: "Failed to load more products.",
                        onRetry = products::retry,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                is LoadState.NotLoading -> Unit
            }
        }
    }
}

@Composable
private fun ProductPagedRow(item: ProductPagedEntity) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(BaseWhite, RoundedCornerShape(12.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                .padding(12.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = item.name,
                color = TextCharcoal,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.description.ifBlank { "-" },
                color = Color(0xFF6B7280),
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Price: ${formatPeso(item.unitPrice)}",
                    color = PrimaryBlue,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Stock: ${item.availableQuantity}",
                    color = Color(0xFF374151),
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun EmptyState(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        color = Color(0xFF6B7280),
        fontSize = 14.sp,
        modifier = modifier,
    )
}

@Composable
private fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = message,
            color = Color(0xFFB91C1C),
            fontSize = 13.sp,
        )
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}
