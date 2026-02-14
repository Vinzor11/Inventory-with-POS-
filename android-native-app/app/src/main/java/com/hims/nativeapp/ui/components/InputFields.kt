package com.hims.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal
import java.util.Locale

@Composable
fun CompactNumberField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    allowDecimal: Boolean = true,
) {
    BasicTextField(
        value = value,
        onValueChange = { raw ->
            onValueChange(sanitizeNumericInput(raw, allowDecimal))
        },
        enabled = enabled,
        singleLine = true,
        keyboardOptions =
            KeyboardOptions(
                keyboardType = if (allowDecimal) KeyboardType.Decimal else KeyboardType.Number,
            ),
        textStyle =
            TextStyle(
                color = TextCharcoal,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            ),
        cursorBrush = SolidColor(PrimaryBlue),
        modifier = modifier,
        decorationBox = { innerTextField ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(34.dp)
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                        .border(1.dp, BorderSoft, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                innerTextField()
            }
        },
    )
}

@Composable
fun PinCodeField(
    pin: String,
    onPinChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    length: Int = 4,
) {
    val focusRequester = remember { FocusRequester() }
    BasicTextField(
        value = pin,
        onValueChange = { raw ->
            onPinChange(raw.filter(Char::isDigit).take(length))
        },
        enabled = enabled,
        singleLine = true,
        keyboardOptions =
            KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
            ),
        textStyle = TextStyle(color = Color.Transparent, fontSize = 1.sp),
        cursorBrush = SolidColor(Color.Transparent),
        modifier =
            modifier
                .fillMaxWidth()
                .focusRequester(focusRequester),
        decorationBox = { innerTextField ->
            Column(
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(length) { index ->
                        val filled = index < pin.length
                        Box(
                            modifier =
                                Modifier
                                    .width(44.dp)
                                    .height(50.dp)
                                    .background(BaseWhite, RoundedCornerShape(10.dp))
                                    .border(
                                        width = 1.dp,
                                        color = if (filled) PrimaryBlue else BorderSoft,
                                        shape = RoundedCornerShape(10.dp),
                                    )
                                    .clickable(enabled = enabled) { focusRequester.requestFocus() },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = if (filled) "\u2022" else "",
                                color = TextCharcoal,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
                Box(
                    modifier =
                        Modifier
                            .size(1.dp)
                            .alpha(0f),
                ) {
                    innerTextField()
                }
            }
        },
    )
}

fun formatCompactNumber(value: Double): String {
    val rounded = kotlin.math.round(value)
    return if (kotlin.math.abs(value - rounded) < 0.000_000_1) {
        rounded.toLong().toString()
    } else {
        String.format(Locale.US, "%.2f", value).trimEnd('0').trimEnd('.')
    }
}

private fun sanitizeNumericInput(
    raw: String,
    allowDecimal: Boolean,
): String {
    val filtered =
        raw.filter { ch ->
            ch.isDigit() || (allowDecimal && ch == '.')
        }
    if (!allowDecimal) {
        return filtered
    }
    val firstDot = filtered.indexOf('.')
    if (firstDot < 0) {
        return filtered
    }
    val head = filtered.substring(0, firstDot + 1)
    val tail = filtered.substring(firstDot + 1).replace(".", "")
    return head + tail
}

