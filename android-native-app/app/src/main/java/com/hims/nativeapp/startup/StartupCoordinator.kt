package com.hims.nativeapp.startup

import com.hims.nativeapp.data.repository.BootstrapRefreshResult
import com.hims.nativeapp.data.repository.BootstrapRepository
import com.hims.nativeapp.data.repository.BootstrapSnapshot
import com.hims.nativeapp.data.network.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicBoolean

sealed interface StartupState {
    data object Loading : StartupState
    data object NeedsLogin : StartupState
    data class Ready(val snapshot: BootstrapSnapshot) : StartupState
    data class OfflineReady(val snapshot: BootstrapSnapshot) : StartupState
    data class Failed(val message: String) : StartupState
}

class StartupCoordinator(
    private val sessionStore: SessionStore,
    private val bootstrapRepository: BootstrapRepository,
) {
    private val started = AtomicBoolean(false)
    private val startupMutex = Mutex()
    private val refreshMutex = Mutex()

    private val _state = MutableStateFlow<StartupState>(StartupState.Loading)
    val state: StateFlow<StartupState> = _state.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    suspend fun ensureStarted() {
        if (started.get()) return

        startupMutex.withLock {
            if (started.get()) return
            started.set(true)
            refresh(force = false)
        }
    }

    suspend fun refresh(force: Boolean) {
        refreshMutex.withLock {
            run(force = force)
        }
    }

    private suspend fun run(force: Boolean) {
        val cached = bootstrapRepository.currentSnapshot()
        val token = sessionStore.getToken()
        if (token.isNullOrBlank()) {
            if (cached != null) {
                _state.value = StartupState.OfflineReady(cached)
            } else {
                _state.value = StartupState.NeedsLogin
            }
            return
        }

        if (cached != null) {
            _state.value = StartupState.Ready(cached)
        } else {
            _state.value = StartupState.Loading
        }

        _refreshing.value = true
        try {
            when (val result = bootstrapRepository.refreshSWR(force = force)) {
                is BootstrapRefreshResult.Updated -> {
                    _state.value = StartupState.Ready(result.snapshot)
                }

                BootstrapRefreshResult.NotModified -> {
                    val latest = bootstrapRepository.currentSnapshot()
                    if (latest != null) {
                        _state.value = StartupState.Ready(latest)
                    } else {
                        _state.value = StartupState.Failed(
                            "Startup data is unavailable. Pull to refresh when server is reachable.",
                        )
                    }
                }

                BootstrapRefreshResult.Unauthorized -> {
                    val fallback = bootstrapRepository.currentSnapshot()
                    if (fallback != null) {
                        _state.value = StartupState.OfflineReady(fallback)
                    } else {
                        _state.value = StartupState.NeedsLogin
                    }
                }

                is BootstrapRefreshResult.NetworkError -> {
                    val fallback = bootstrapRepository.currentSnapshot()
                    if (fallback != null) {
                        _state.value = StartupState.OfflineReady(fallback)
                    } else {
                        _state.value = StartupState.Failed(
                            if (result.retryable) {
                                "Cannot reach server right now. Pull to refresh to retry."
                            } else {
                                "Startup failed due to a server error. Pull to refresh."
                            },
                        )
                    }
                }
            }
        } finally {
            _refreshing.value = false
        }
    }
}
