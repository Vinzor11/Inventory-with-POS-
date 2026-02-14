package com.hims.nativeapp.ui.screens

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.network.ApiClient
import com.hims.nativeapp.data.network.SessionStore
import com.hims.nativeapp.data.repository.ProductsRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class ProductsPagingViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application)
    private val api = ApiClient.create(sessionStore)
    private val db = AppDatabase.getInstance(application)
    private val repository = ProductsRepository(api, db)

    val query = MutableStateFlow("")

    val products = query
        .debounce(300)
        .map { it.trim() }
        .distinctUntilChanged()
        .flatMapLatest { repository.paged(it) }
        .cachedIn(viewModelScope)
}
