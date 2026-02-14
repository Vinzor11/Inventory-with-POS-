package com.hims.nativeapp.ui.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hims.nativeapp.core.DataChangeBus
import com.hims.nativeapp.core.DataTopic
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class InventoryViewModel : ViewModel() {
    private val _refreshSignals = MutableSharedFlow<Unit>(extraBufferCapacity = 8)
    val refreshSignals: SharedFlow<Unit> = _refreshSignals.asSharedFlow()

    init {
        viewModelScope.launch {
            DataChangeBus.events.collectLatest { event ->
                if (event.topic == DataTopic.STOCK || event.topic == DataTopic.INVENTORY) {
                    _refreshSignals.tryEmit(Unit)
                }
            }
        }
    }
}
