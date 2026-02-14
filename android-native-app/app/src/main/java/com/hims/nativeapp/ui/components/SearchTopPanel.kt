package com.hims.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal

@Composable
fun SearchTopPanel(
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    onFilterClick: () -> Unit,
    showFilterButton: Boolean = true,
    isFilterActive: Boolean = false,
    actionIcon: ImageVector? = null,
    actionContentDescription: String = "Action",
    onActionClick: (() -> Unit)? = null,
    isActionActive: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(BaseWhite)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            placeholder = { Text(placeholder, color = Color(0xFF6B7280), fontSize = 16.sp, maxLines = 1) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Outlined.Search,
                    contentDescription = null,
                    tint = Color(0xFF6B7280),
                )
            },
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 16.sp),
            shape = RoundedCornerShape(12.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = BaseWhite,
                    unfocusedContainerColor = BaseWhite,
                    focusedBorderColor = BorderSoft,
                    unfocusedBorderColor = BorderSoft,
                    focusedTextColor = TextCharcoal,
                    unfocusedTextColor = TextCharcoal,
                ),
        )

        if (actionIcon != null && onActionClick != null) {
            IconButton(
                onClick = onActionClick,
                modifier =
                    Modifier
                        .size(44.dp)
                        .background(BaseWhite, RoundedCornerShape(12.dp))
                        .border(
                            width = 1.dp,
                            color = if (isActionActive) PrimaryBlue else BorderSoft,
                            shape = RoundedCornerShape(12.dp),
                        ),
            ) {
                Icon(
                    imageVector = actionIcon,
                    contentDescription = actionContentDescription,
                    tint = if (isActionActive) PrimaryBlue else TextCharcoal,
                )
            }
        }

        if (showFilterButton) {
            IconButton(
                onClick = onFilterClick,
                modifier =
                    Modifier
                        .size(44.dp)
                        .background(BaseWhite, RoundedCornerShape(12.dp))
                        .border(
                            width = 1.dp,
                            color = if (isFilterActive) Color(0xFFF97316) else BorderSoft,
                            shape = RoundedCornerShape(12.dp),
                        ),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Tune,
                    contentDescription = "Filter",
                    tint = if (isFilterActive) Color(0xFFF97316) else TextCharcoal,
                )
            }
        }
    }
}
