package com.hims.nativeapp.core

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

object DataInvalidationManager {
    private val _staleKeys = MutableStateFlow<Set<String>>(emptySet())
    val staleKeys: StateFlow<Set<String>> = _staleKeys.asStateFlow()

    private val _invalidations = MutableSharedFlow<Set<String>>(extraBufferCapacity = 128)
    val invalidations: SharedFlow<Set<String>> = _invalidations.asSharedFlow()

    suspend fun invalidate(vararg keys: String) {
        val normalized = normalize(keys)
        if (normalized.isEmpty()) {
            return
        }
        _staleKeys.update { current -> current + normalized }
        _invalidations.emit(normalized)
    }

    fun invalidateNow(vararg keys: String) {
        val normalized = normalize(keys)
        if (normalized.isEmpty()) {
            return
        }
        _staleKeys.update { current -> current + normalized }
        _invalidations.tryEmit(normalized)
    }

    fun isInvalid(key: String): Boolean = _staleKeys.value.contains(key.trim())

    fun anyInvalid(keys: Collection<String>): Boolean =
        keys.any { key -> _staleKeys.value.contains(key.trim()) }

    fun hasInvalidWithPrefix(prefix: String): Boolean {
        val normalizedPrefix = prefix.trim()
        if (normalizedPrefix.isEmpty()) {
            return false
        }
        return _staleKeys.value.any { key -> key.startsWith(normalizedPrefix) }
    }

    fun clearInvalid(vararg keys: String) {
        val normalized = normalize(keys)
        if (normalized.isEmpty()) {
            return
        }
        _staleKeys.update { current -> current - normalized }
    }

    fun clearInvalidByPrefix(prefix: String) {
        val normalizedPrefix = prefix.trim()
        if (normalizedPrefix.isEmpty()) {
            return
        }
        _staleKeys.update { current ->
            current.filterNotTo(mutableSetOf()) { key -> key.startsWith(normalizedPrefix) }
        }
    }

    fun observeInvalid(key: String): Flow<Boolean> {
        val normalized = key.trim()
        return staleKeys
            .map { keys -> keys.contains(normalized) }
            .distinctUntilChanged()
    }

    fun snapshot(): Set<String> = _staleKeys.value

    private fun normalize(keys: Array<out String>): Set<String> =
        keys
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .toSet()
}
