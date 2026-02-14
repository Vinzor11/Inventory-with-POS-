package com.hims.nativeapp.ui.transactions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hims.nativeapp.core.DataChangeBus
import com.hims.nativeapp.core.DataTopic
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class TransactionsViewModel : ViewModel() {
    private val _pagingRefresh = MutableSharedFlow<Unit>(extraBufferCapacity = 8)
    val pagingRefresh: SharedFlow<Unit> = _pagingRefresh.asSharedFlow()

    init {
        viewModelScope.launch {
            DataChangeBus.events.collectLatest { event ->
                if (event.topic == DataTopic.TRANSACTIONS) {
                    _pagingRefresh.tryEmit(Unit)
                }
            }
        }
    }
}
