package com.hims.nativeapp.ui.components

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp

@Composable
fun CopyActionButton(
    value: String,
    copiedMessage: String = "Reference copied",
    tint: Color = Color(0xFF6B7280),
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    Box(
        modifier =
            modifier
                .clickable {
                    clipboard.setText(AnnotatedString(value))
                    Toast.makeText(context, copiedMessage, Toast.LENGTH_SHORT).show()
                }.padding(4.dp),
    ) {
        Icon(
            imageVector = Icons.Outlined.ContentCopy,
            contentDescription = "Copy",
            tint = tint,
            modifier = Modifier.size(16.dp),
        )
    }
}
