package com.torchat.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.torchat.shared.models.AuthResponse
import com.torchat.shared.models.TorStatus
import com.torchat.shared.models.User
import com.torchat.shared.repository.ChatRepository
import com.torchat.shared.tor.TorManager
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class AuthViewModel(
    private val torManager: TorManager,
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    val torStatus: StateFlow<TorStatus> = torManager.status

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    init {
        // Check if user is already authenticated
        viewModelScope.launch {
            val token = chatRepository.getAuthToken()
            _isAuthenticated.value = token != null
        }

        // Start TOR automatically
        startTor()
    }

    fun startTor() {
        viewModelScope.launch {
            try {
                torManager.start()
            } catch (e: Exception) {
                _authState.value = AuthState.Error("Failed to connect to TOR: ${e.message}")
            }
        }
    }

    fun login(username: String, password: String, serverUrl: String) {
        if (username.isBlank() || password.isBlank()) {
            _authState.value = AuthState.Error("Username and password cannot be empty")
            return
        }

        viewModelScope.launch {
            _authState.value = AuthState.Loading

            // Set server URL first
            chatRepository.setServerUrl(serverUrl)

            val result = chatRepository.login(username, password)
            result.fold(
                onSuccess = { response ->
                    if (response.success) {
                        _isAuthenticated.value = true
                        _currentUser.value = response.user
                        _authState.value = AuthState.Success(response)
                    } else {
                        _authState.value = AuthState.Error(response.message ?: "Login failed")
                    }
                },
                onFailure = { error ->
                    _authState.value = AuthState.Error("Login failed: ${error.message}")
                }
            )
        }
    }

    fun register(username: String, password: String, serverUrl: String) {
        if (username.isBlank() || password.isBlank()) {
            _authState.value = AuthState.Error("Username and password cannot be empty")
            return
        }

        viewModelScope.launch {
            _authState.value = AuthState.Loading

            // Set server URL first
            chatRepository.setServerUrl(serverUrl)

            val result = chatRepository.register(username, password)
            result.fold(
                onSuccess = { response ->
                    if (response.success) {
                        _isAuthenticated.value = true
                        _currentUser.value = response.user
                        _authState.value = AuthState.Success(response)
                    } else {
                        _authState.value = AuthState.Error(response.message ?: "Registration failed")
                    }
                },
                onFailure = { error ->
                    _authState.value = AuthState.Error("Registration failed: ${error.message}")
                }
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            chatRepository.clearAuth()
            _isAuthenticated.value = false
            _currentUser.value = null
            _authState.value = AuthState.Idle
        }
    }

    fun clearError() {
        _authState.value = AuthState.Idle
    }
}

sealed class AuthState {
    data object Idle : AuthState()
    data object Loading : AuthState()
    data class Success(val response: AuthResponse) : AuthState()
    data class Error(val message: String) : AuthState()
}
