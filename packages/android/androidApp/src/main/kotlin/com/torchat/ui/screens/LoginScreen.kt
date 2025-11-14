package com.torchat.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.torchat.shared.models.TorStatus
import com.torchat.ui.theme.ConnectingOrange
import com.torchat.ui.theme.OnlineGreen
import com.torchat.ui.theme.OfflineRed
import com.torchat.viewmodel.AuthState
import com.torchat.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf("http://localhost:3000") }
    var showPassword by remember { mutableStateOf(false) }
    var isRegisterMode by remember { mutableStateOf(false) }

    val authState by viewModel.authState.collectAsState()
    val torStatus by viewModel.torStatus.collectAsState()

    // Navigate on success
    LaunchedEffect(authState) {
        if (authState is AuthState.Success) {
            onLoginSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TOR Chat") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // TOR Status Indicator
                TorStatusCard(torStatus)

                Spacer(modifier = Modifier.height(32.dp))

                // App Title
                Text(
                    text = if (isRegisterMode) "Create Account" else "Welcome Back",
                    style = MaterialTheme.typography.headlineLarge,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Secure, private, anonymous chat",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Server URL
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("Server URL") },
                    leadingIcon = { Icon(Icons.Default.Link, "Server") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Username
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    leadingIcon = { Icon(Icons.Default.Person, "Username") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Password
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, "Password") },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                "Toggle password visibility"
                            )
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            if (isRegisterMode) {
                                viewModel.register(username, password, serverUrl)
                            } else {
                                viewModel.login(username, password, serverUrl)
                            }
                        }
                    )
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Login/Register Button
                Button(
                    onClick = {
                        if (isRegisterMode) {
                            viewModel.register(username, password, serverUrl)
                        } else {
                            viewModel.login(username, password, serverUrl)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    enabled = username.isNotBlank() && password.isNotBlank() && torStatus is TorStatus.Connected && authState !is AuthState.Loading
                ) {
                    if (authState is AuthState.Loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text(if (isRegisterMode) "Register" else "Login")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Toggle Register/Login
                TextButton(
                    onClick = {
                        isRegisterMode = !isRegisterMode
                        viewModel.clearError()
                    }
                ) {
                    Text(
                        if (isRegisterMode) "Already have an account? Login" else "Don't have an account? Register"
                    )
                }

                // Error Message
                AnimatedVisibility(visible = authState is AuthState.Error) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            text = (authState as? AuthState.Error)?.message ?: "",
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TorStatusCard(torStatus: TorStatus) {
    val (statusText, statusColor, statusIcon) = when (torStatus) {
        is TorStatus.Disconnected -> Triple("TOR Disconnected", OfflineRed, Icons.Default.CloudOff)
        is TorStatus.Connecting -> Triple("Connecting to TOR... ${torStatus.progress}%", ConnectingOrange, Icons.Default.CloudQueue)
        is TorStatus.Connected -> Triple("Connected to TOR", OnlineGreen, Icons.Default.Cloud)
        is TorStatus.Error -> Triple("TOR Error: ${torStatus.message}", OfflineRed, Icons.Default.Error)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = statusIcon,
                contentDescription = "TOR Status",
                tint = statusColor,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = statusText,
                style = MaterialTheme.typography.bodyMedium,
                color = statusColor,
                textAlign = TextAlign.Center
            )
        }
    }
}
