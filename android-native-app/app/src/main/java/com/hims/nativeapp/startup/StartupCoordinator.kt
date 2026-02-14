package com.hims.nativeapp.startup

import com.hims.nativeapp.data.repository.BootstrapRefreshResult
import com.hims.nativeapp.data.repository.BootstrapRepository
import com.hims.nativeapp.data.repository.BootstrapSnapshot
import com.hims.nativeapp.data.network.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
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
        val cached = withContext(Dispatchers.IO) { bootstrapRepository.currentSnapshot() }
        val token = sessionStore.getToken()
        if (token.isNullOrBlank()) {
            if (cached != null) {
                setStateIfChanged(StartupState.OfflineReady(cached))
            } else {
                setStateIfChanged(StartupState.NeedsLogin)
            }
            return
        }

        if (cached != null) {
            setStateIfChanged(StartupState.Ready(cached))
        } else {
            setStateIfChanged(StartupState.Loading)
        }

        setRefreshingIfChanged(true)
        try {
            when (val result = withContext(Dispatchers.IO) { bootstrapRepository.refreshSWR(force = force) }) {
                is BootstrapRefreshResult.Updated -> {
                    setStateIfChanged(StartupState.Ready(result.snapshot))
                }

                is BootstrapRefreshResult.NotModified -> {
                    val latest = result.snapshot
                    if (latest != null) {
                        setStateIfChanged(StartupState.Ready(latest))
                    } else {
                        setStateIfChanged(StartupState.Failed(
                            "Startup data is unavailable. Pull to refresh when server is reachable.",
                        ))
                    }
                }

                BootstrapRefreshResult.Unauthorized -> {
                    val fallback = withContext(Dispatchers.IO) { bootstrapRepository.currentSnapshot() }
                    if (fallback != null) {
                        setStateIfChanged(StartupState.OfflineReady(fallback))
                    } else {
                        setStateIfChanged(StartupState.NeedsLogin)
                    }
                }

                is BootstrapRefreshResult.NetworkError -> {
                    val fallback = withContext(Dispatchers.IO) { bootstrapRepository.currentSnapshot() }
                    if (fallback != null) {
                        setStateIfChanged(StartupState.OfflineReady(fallback))
                    } else {
                        setStateIfChanged(StartupState.Failed(
                            if (result.retryable) {
                                "Cannot reach server right now. Pull to refresh to retry."
                            } else {
                                "Startup failed due to a server error. Pull to refresh."
                            },
                        ))
                    }
                }
            }
        } finally {
            setRefreshingIfChanged(false)
        }
    }

    private fun setStateIfChanged(newState: StartupState) {
        if (_state.value != newState) {
            _state.value = newState
        }
    }

    private fun setRefreshingIfChanged(value: Boolean) {
        if (_refreshing.value != value) {
            _refreshing.value = value
        }
    }
}
