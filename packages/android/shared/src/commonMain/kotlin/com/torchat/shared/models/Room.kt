package com.torchat.shared.models

import kotlinx.serialization.Serializable

@Serializable
data class Room(
    val id: String,
    val name: String,
    val description: String? = null,
    val isPrivate: Boolean = false,
    val createdBy: String? = null,
    val createdAt: String? = null,
    val memberCount: Int = 0,
    val unreadCount: Int = 0
)

@Serializable
data class CreateRoomRequest(
    val name: String,
    val description: String? = null,
    val isPrivate: Boolean = false
)

@Serializable
data class JoinRoomRequest(
    val roomId: String
)
