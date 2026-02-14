package com.hims.nativeapp.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors =
    lightColorScheme(
        primary = PrimaryBlue,
        secondary = SafetyOrange,
        background = AppBackground,
        surface = BaseWhite,
        onPrimary = BaseWhite,
        onSecondary = BaseWhite,
        onBackground = TextCharcoal,
        onSurface = TextCharcoal,
    )

private val DarkColors =
    darkColorScheme(
        primary = PrimaryBlue,
        secondary = SafetyOrange,
    )

@Composable
fun HimsNativeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
