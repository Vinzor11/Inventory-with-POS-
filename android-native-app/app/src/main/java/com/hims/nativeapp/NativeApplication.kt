package com.hims.nativeapp

import android.app.Application
import com.hims.nativeapp.sync.SyncScheduler

class NativeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SyncScheduler.schedulePeriodic(this)
    }
}