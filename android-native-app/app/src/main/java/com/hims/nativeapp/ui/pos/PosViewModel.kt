package com.hims.nativeapp.ui.pos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hims.nativeapp.core.DataChangeBus
import com.hims.nativeapp.core.DataTopic
import com.hims.nativeapp.data.repository.StockService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job

class PosViewModel(
    private val stockService: StockService,
) : ViewModel() {
    private val _trackedVariant = MutableStateFlow<Int?>(null)
    private val _onHand = MutableStateFlow<Double?>(null)
    val onHand: StateFlow<Double?> = _onHand.asStateFlow()
    private var trackJob: Job? = null

    init {
        viewModelScope.launch {
            DataChangeBus.events.collectLatest { event ->
                if (event.topic == DataTopic.STOCK && event.entityId != null && event.entityId == _trackedVariant.value) {
                    // UI is backed by Room flow already; this acts as fast follow for explicit trigger.
                    trackVariant(event.entityId)
                }
            }
        }
    }

    fun trackVariant(variantId: Int) {
        _trackedVariant.value = variantId
        trackJob?.cancel()
        trackJob = viewModelScope.launch {
            stockService.observeOnHand(variantId).collectLatest { qty ->
                _onHand.value = qty
            }
        }
    }
}
