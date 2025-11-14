package com.torchat.shared.models

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val username: String,
    val publicKey: String? = null,
    val isAdmin: Boolean = false,
    val createdAt: String? = null
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class RegisterRequest(
    val username: String,
    val password: String
)

@Serializable
data class AuthResponse(
    val success: Boolean,
    val message: String? = null,
    val user: User? = null,
    val token: String? = null
)
