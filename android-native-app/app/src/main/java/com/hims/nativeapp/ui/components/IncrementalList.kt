package com.hims.nativeapp.ui.components

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map

data class IncrementalListState(
    val listState: LazyListState,
    val visibleCount: Int,
)

@Composable
fun rememberIncrementalListState(
    totalItems: Int,
    pageSize: Int = 20,
    prefetchThreshold: Int = 1,
): IncrementalListState {
    val listState = rememberLazyListState()
    var visibleCount by remember(totalItems, pageSize) {
        mutableStateOf(minOf(pageSize, totalItems))
    }

    LaunchedEffect(totalItems, pageSize) {
        visibleCount = minOf(pageSize, totalItems)
    }

    LaunchedEffect(listState, totalItems, pageSize, prefetchThreshold) {
        snapshotFlow {
            val layoutInfo = listState.layoutInfo
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
            val currentRenderedItems = layoutInfo.totalItemsCount
            lastVisibleIndex to currentRenderedItems
        }
            .map { (lastVisibleIndex, currentRenderedItems) ->
                currentRenderedItems > 0 && lastVisibleIndex >= currentRenderedItems - prefetchThreshold
            }
            .distinctUntilChanged()
            .filter { it }
            .collect {
                if (visibleCount < totalItems) {
                    visibleCount = minOf(totalItems, visibleCount + pageSize)
                }
            }
    }

    return IncrementalListState(
        listState = listState,
        visibleCount = visibleCount,
    )
}
