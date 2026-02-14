package com.hims.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.shadow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Scale
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hims.nativeapp.ui.AppTab
import com.hims.nativeapp.ui.theme.BaseWhite
import com.hims.nativeapp.ui.theme.BorderSoft
import com.hims.nativeapp.ui.theme.PrimaryBlue
import com.hims.nativeapp.ui.theme.SafetyOrange

private data class BottomItem(
    val tab: AppTab,
    val label: String,
)

@Composable
fun BottomNavBar(
    selectedTab: AppTab,
    onSelect: (AppTab) -> Unit,
    deliveryPendingCount: Int = 0,
    weighUnpaidCount: Int = 0,
) {
    val effectiveSelectedTab =
        when (selectedTab) {
            AppTab.INVENTORY,
            AppTab.DELIVERY_MENU,
            AppTab.PRODUCT_MENU,
            AppTab.WEIGH_MENU,
            AppTab.PRODUCTION_MENU,
            AppTab.DASHBOARD,
            -> AppTab.MORE
            else -> selectedTab
        }

    val items =
        listOf(
            BottomItem(AppTab.POS, "POS"),
            BottomItem(AppTab.DELIVERY, "Delivery"),
            BottomItem(AppTab.SALES, "Sales"),
            BottomItem(AppTab.WEIGH, "Weigh"),
            BottomItem(AppTab.MORE, "More"),
        )

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(BaseWhite),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .padding(horizontal = 6.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            items.forEach { item ->
                val selected = item.tab == effectiveSelectedTab
                val tint = if (selected && item.tab != AppTab.SALES) PrimaryBlue else Color(0xFF1F2937)
                val badgeCount =
                    when (item.tab) {
                        AppTab.DELIVERY -> deliveryPendingCount.coerceAtLeast(0)
                        AppTab.WEIGH -> weighUnpaidCount.coerceAtLeast(0)
                        else -> 0
                    }

                if (item.tab == AppTab.SALES) {
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .offset(y = (-12).dp)
                                .clickable { onSelect(item.tab) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(50.dp)
                                    .shadow(2.dp, RoundedCornerShape(15.dp))
                                    .background(
                                        if (selected) SafetyOrange else BaseWhite,
                                        RoundedCornerShape(15.dp),
                                    ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .matchParentSize()
                                    .border(
                                            width = 1.dp,
                                            color = if (selected) SafetyOrange else BorderSoft,
                                            shape = RoundedCornerShape(15.dp),
                                        ),
                            )
                            Text(
                                text = "\u20B1",
                                color = if (selected) BaseWhite else SafetyOrange,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.label,
                            fontSize = 11.sp,
                            color = if (selected) PrimaryBlue else Color(0xFF1F2937),
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    }
                } else {
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .clickable { onSelect(item.tab) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                modifier = Modifier.size(22.dp),
                                tint = tint,
                                imageVector = when (item.tab) {
                                    AppTab.POS -> Icons.Outlined.ShoppingCart
                                    AppTab.DELIVERY -> Icons.Outlined.LocalShipping
                                    AppTab.WEIGH -> Icons.Outlined.Scale
                                    AppTab.MORE -> Icons.Outlined.Menu
                                    AppTab.SALES -> Icons.Outlined.Receipt
                                    AppTab.INVENTORY -> Icons.Outlined.Menu
                                    AppTab.DELIVERY_MENU -> Icons.Outlined.Menu
                                    AppTab.PRODUCT_MENU -> Icons.Outlined.Menu
                                    AppTab.WEIGH_MENU -> Icons.Outlined.Menu
                                    AppTab.PRODUCTION_MENU -> Icons.Outlined.Menu
                                    AppTab.DASHBOARD -> Icons.Outlined.Menu
                                },
                                contentDescription = item.label,
                            )
                            if (badgeCount > 0) {
                                Box(
                                    modifier =
                                        Modifier
                                            .align(Alignment.TopEnd)
                                            .offset(x = 9.dp, y = (-6).dp)
                                            .background(SafetyOrange, RoundedCornerShape(10.dp))
                                            .padding(horizontal = 5.dp, vertical = 1.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = if (badgeCount > 99) "99+" else badgeCount.toString(),
                                        color = BaseWhite,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.label,
                            fontSize = 11.sp,
                            color = tint,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    }
                }
            }
        }
    }
}
