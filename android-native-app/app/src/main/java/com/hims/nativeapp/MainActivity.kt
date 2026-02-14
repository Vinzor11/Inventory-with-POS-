package com.hims.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.hims.nativeapp.sync.SyncScheduler
import com.hims.nativeapp.ui.theme.HimsNativeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SyncScheduler.enqueueImmediate(this)

        setContent {
            HimsNativeTheme(darkTheme = false) {
                HimsNativeApp()
            }
        }
    }
}
