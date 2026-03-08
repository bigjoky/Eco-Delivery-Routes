package com.ecodeliveryroutes.features.dashboard

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class DashboardOverviewScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun rendersOverviewAndNavigatesToRoute() {
        var openedRoute = false

        composeRule.setContent {
            DashboardOverviewScreen(onOpenDriverRoute = { openedRoute = true })
        }

        composeRule.onNodeWithTag("dashboard_overview_root").assertIsDisplayed()
        composeRule.onNodeWithTag("dashboard_overview_title").assertIsDisplayed()
        composeRule.onNodeWithText("Everything at a glance").assertIsDisplayed()
        composeRule.onNodeWithTag("dashboard_open_route").performClick()

        composeRule.runOnIdle {
            assertTrue(openedRoute)
        }
    }
}
