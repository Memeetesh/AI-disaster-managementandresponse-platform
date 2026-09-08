package com.drishti.citizen

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.drishti.citizen.core.ui.theme.DrishtiTheme
import com.drishti.citizen.feature.navigation.AppRoot
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DrishtiTheme {
                AppRoot()
            }
        }
    }
}
