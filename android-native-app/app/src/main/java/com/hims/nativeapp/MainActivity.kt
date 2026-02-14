package com.hims.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.hims.nativeapp.ui.theme.HimsNativeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            HimsNativeTheme(darkTheme = false) {
                HimsNativeApp()
            }
        }
    }
}
