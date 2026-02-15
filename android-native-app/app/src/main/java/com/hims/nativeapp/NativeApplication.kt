package com.hims.nativeapp

import android.app.Application
import android.os.StrictMode
import com.hims.nativeapp.sync.SyncScheduler

class NativeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    // OEM framework hooks can trigger harmless disk-read violations on touch/scroll.
                    // Keep network detection enabled for app-side violations with less noisy logs.
                    .detectNetwork()
                    .penaltyLog()
                    .build(),
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    // Disable noisy platform false-positives (InsetsSourceControl / SurfaceControl finalizers).
                    .penaltyLog()
                    .build(),
            )
        }
        SyncScheduler.schedulePeriodic(this)
    }
}
