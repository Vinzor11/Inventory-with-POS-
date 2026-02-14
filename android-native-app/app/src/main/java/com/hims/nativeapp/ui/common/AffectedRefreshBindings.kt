package com.hims.nativeapp.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.paging.compose.LazyPagingItems
import com.hims.nativeapp.core.DataChangeBus
import com.hims.nativeapp.core.DataTopic
import kotlinx.coroutines.flow.collectLatest

@Composable
fun <T : Any> RefreshPagingOnProductsTopic(
    pagingItems: LazyPagingItems<T>,
) {
    LaunchedEffect(pagingItems) {
        DataChangeBus.events.collectLatest { event ->
            if (event.topic == DataTopic.PRODUCTS) {
                pagingItems.refresh()
            }
        }
    }
}

@Composable
fun <T : Any> RefreshPagingOnTransactionsTopic(
    pagingItems: LazyPagingItems<T>,
) {
    LaunchedEffect(pagingItems) {
        DataChangeBus.events.collectLatest { event ->
            if (event.topic == DataTopic.TRANSACTIONS) {
                pagingItems.refresh()
            }
        }
    }
}

@Composable
fun <T : Any> RefreshPagingOnDeliveriesTopic(
    pagingItems: LazyPagingItems<T>,
) {
    LaunchedEffect(pagingItems) {
        DataChangeBus.events.collectLatest { event ->
            if (event.topic == DataTopic.DELIVERIES) {
                pagingItems.refresh()
            }
        }
    }
}
