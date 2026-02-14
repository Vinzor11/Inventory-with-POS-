package com.hims.nativeapp.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.ListenableWorker
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.hims.nativeapp.data.local.AppDatabase
import com.hims.nativeapp.data.network.ApiClient
import com.hims.nativeapp.data.network.SessionStore
import com.hims.nativeapp.data.repository.BootstrapRefreshResult
import com.hims.nativeapp.data.repository.BootstrapRepository
import com.hims.nativeapp.data.repository.OutboxFlushResult
import com.hims.nativeapp.data.repository.OutboxRepository
import com.hims.nativeapp.domain.EmitImpact
import java.util.concurrent.TimeUnit

private const val KEY_REFRESH_BOOTSTRAP = "refresh_bootstrap"

class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): ListenableWorker.Result {
        val shouldRefreshBootstrap = inputData.getBoolean(KEY_REFRESH_BOOTSTRAP, true)
        val sessionStore = SessionStore(applicationContext)
        val api = ApiClient.create(sessionStore)
        val db = AppDatabase.getInstance(applicationContext)
        val outboxRepository = OutboxRepository(api, db)
        val bootstrapRepository = BootstrapRepository(api, db)

        return when (val outbox = outboxRepository.flushPending()) {
            OutboxFlushResult.NeedsLogin -> ListenableWorker.Result.failure()
            OutboxFlushResult.RetryLater -> ListenableWorker.Result.retry()
            is OutboxFlushResult.Success -> {
                outbox.actions.forEach { action ->
                    EmitImpact.emit(action = action, reason = "synced")
                }
                if (!shouldRefreshBootstrap) {
                    return ListenableWorker.Result.success()
                }

                when (val bootstrap = bootstrapRepository.refreshSWR(force = false)) {
                    is BootstrapRefreshResult.Updated -> ListenableWorker.Result.success()
                    is BootstrapRefreshResult.NotModified -> ListenableWorker.Result.success()
                    BootstrapRefreshResult.Unauthorized -> ListenableWorker.Result.failure()
                    is BootstrapRefreshResult.NetworkError -> {
                        if (bootstrap.retryable) {
                            ListenableWorker.Result.retry()
                        } else {
                            ListenableWorker.Result.success()
                        }
                    }
                }
            }
        }
    }
}

object SyncScheduler {
    private const val PERIODIC_WORK = "hims_sync_periodic"
    private const val IMMEDIATE_WORK = "hims_sync_immediate"

    fun schedulePeriodic(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setInputData(
                Data.Builder()
                    .putBoolean(KEY_REFRESH_BOOTSTRAP, true)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun enqueueImmediate(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setInputData(
                Data.Builder()
                    .putBoolean(KEY_REFRESH_BOOTSTRAP, false)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 20, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_WORK,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
