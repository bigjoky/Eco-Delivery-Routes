package com.ecodeliveryroutes.features.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.network.ApiProvider
import com.ecodeliveryroutes.core.session.SessionStore
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onSuccess: () -> Unit) {
    val context = LocalContext.current
    val email = remember { mutableStateOf("admin@eco.local") }
    val password = remember { mutableStateOf("password123") }
    val message = remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Login")
        OutlinedTextField(
            value = email.value,
            onValueChange = { email.value = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password.value,
            onValueChange = { password.value = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = {
            scope.launch {
                val token = ApiProvider.client.login(email.value, password.value)
                SessionStore.updateToken(token)
                SessionStore.persist(context)
                message.value = if (SessionStore.isAuthenticated()) "Sesión activa" else "Error de autenticación"
                if (SessionStore.isAuthenticated()) onSuccess()
            }
        }) {
            Text("Entrar")
        }
        if (message.value.isNotBlank()) {
            Text(message.value)
        }
    }
}
