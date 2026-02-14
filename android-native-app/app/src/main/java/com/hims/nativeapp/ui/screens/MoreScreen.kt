package com.hims.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Scale
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.ui.theme.AppBackground
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.TextCharcoal

private data class MoreMenuItem(
    val label: String,
    val description: String,
    val icon: ImageVector,
    val adminOnly: Boolean = false,
    val hideForStaff: Boolean = false,
    val onClick: () -> Unit,
)

@Composable
fun MoreMenuSheetContent(
    userName: String?,
    userRole: String?,
    isAdmin: Boolean,
    isStaff: Boolean,
    onOpenInventory: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenDeliveries: () -> Unit,
    onOpenWeighIns: () -> Unit,
    onOpenProduction: () -> Unit,
    onOpenDashboard: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val menuItems =
        listOf(
            MoreMenuItem(
                label = "Inventory",
                description = "Stocks, adjustments, and movements",
                icon = Icons.Outlined.Inventory2,
                hideForStaff = true,
                onClick = onOpenInventory,
            ),
            MoreMenuItem(
                label = "Products",
                description = "Manage products and status",
                icon = Icons.Outlined.ShoppingBag,
                hideForStaff = true,
                onClick = onOpenProducts,
            ),
            MoreMenuItem(
                label = "Delivery Menu",
                description = "View-only delivery records",
                icon = Icons.Outlined.LocalShipping,
                onClick = onOpenDeliveries,
            ),
            MoreMenuItem(
                label = "Weigh-In Menu",
                description = "View and manage weigh-in records",
                icon = Icons.Outlined.Scale,
                onClick = onOpenWeighIns,
            ),
            MoreMenuItem(
                label = "Dashboard",
                description = "Owner KPIs and alerts",
                icon = Icons.Outlined.Dashboard,
                adminOnly = true,
                hideForStaff = true,
                onClick = onOpenDashboard,
            ),
            MoreMenuItem(
                label = "Production",
                description = "Copra conversion runs and history",
                icon = Icons.Outlined.Settings,
                adminOnly = true,
                hideForStaff = true,
                onClick = onOpenProduction,
            ),
        ).sortedBy { it.label.lowercase() }
    val visibleMenuItems = menuItems.filter { (!it.adminOnly || isAdmin) && (!it.hideForStaff || !isStaff) }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ProfileCard(userName = userName, userRole = userRole)

        visibleMenuItems.forEach { item ->
            MenuRow(item)
        }

        Spacer(modifier = Modifier.height(2.dp))
        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors =
                ButtonDefaults.buttonColors(
                    containerColor = PrimaryBlue,
                    contentColor = BaseWhite,
                ),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text("Logout")
        }
    }
}

@Composable
private fun ProfileCard(
    userName: String?,
    userRole: String?,
) {
    val displayName = userName?.trim().orEmpty().ifBlank { "User" }
    val initials =
        displayName
            .split(" ")
            .filter { it.isNotBlank() }
            .take(2)
            .joinToString("") { it.first().uppercase() }
            .ifBlank { "U" }
    val roleBadge =
        userRole
            ?.trim()
            ?.replace('_', ' ')
            ?.replaceFirstChar { it.uppercaseChar() }
            .orEmpty()
            .ifBlank { "User" }

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(BaseWhite, RoundedCornerShape(12.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .background(Color(0xFFE8EEF9), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                color = PrimaryBlue,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Account",
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = displayName,
                color = Color(0xFF374151),
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier =
                        Modifier
                            .background(Color(0xFFE8EEF9), RoundedCornerShape(999.dp))
                            .padding(horizontal = 9.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = roleBadge,
                        color = PrimaryBlue,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.sp,
                    )
                }
                Text(
                    text = "Signed in",
                    color = Color(0xFF6B7280),
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
fun MoreScreen(
    userName: String?,
    userRole: String?,
    isAdmin: Boolean,
    isStaff: Boolean,
    onOpenInventory: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenDeliveries: () -> Unit,
    onOpenWeighIns: () -> Unit,
    onOpenProduction: () -> Unit,
    onOpenDashboard: () -> Unit,
    onLogout: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(AppBackground),
    ) {
        MoreMenuSheetContent(
            userName = userName,
            userRole = userRole,
            isAdmin = isAdmin,
            isStaff = isStaff,
            onOpenInventory = onOpenInventory,
            onOpenProducts = onOpenProducts,
            onOpenDeliveries = onOpenDeliveries,
            onOpenWeighIns = onOpenWeighIns,
            onOpenProduction = onOpenProduction,
            onOpenDashboard = onOpenDashboard,
            onLogout = onLogout,
        )
    }
}

@Composable
private fun MenuRow(item: MoreMenuItem) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(BaseWhite, RoundedCornerShape(12.dp))
                .border(1.dp, BorderSoft, RoundedCornerShape(12.dp))
                .clickable(onClick = item.onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .background(Color(0xFFE8EEF9), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = item.label,
                tint = PrimaryBlue,
                modifier = Modifier.size(19.dp),
            )
        }
        Column(
            modifier = Modifier.padding(start = 10.dp).weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = item.label,
                color = TextCharcoal,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            Text(
                text = item.description,
                color = Color(0xFF6B7280),
                fontSize = 12.sp,
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = Color(0xFF9CA3AF),
            modifier = Modifier.size(24.dp),
        )
    }
}
