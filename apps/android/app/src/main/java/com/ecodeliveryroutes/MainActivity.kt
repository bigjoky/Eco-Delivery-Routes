package com.ecodeliveryroutes

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.ecodeliveryroutes.navigation.AppNavHost
import com.ecodeliveryroutes.ui.theme.EcoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            EcoTheme {
                AppNavHost()
            }
        }
    }
}
