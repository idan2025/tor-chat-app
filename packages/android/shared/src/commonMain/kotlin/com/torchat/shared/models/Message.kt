package com.torchat.shared.models

import kotlinx.serialization.Serializable

@Serializable
data class Message(
    val id: String,
    val roomId: String,
    val userId: String,
    val username: String,
    val content: String,
    val timestamp: Long,
    val encrypted: Boolean = false,
    val type: MessageType = MessageType.TEXT
)

@Serializable
enum class MessageType {
    TEXT,
    IMAGE,
    FILE,
    SYSTEM
}

@Serializable
data class SendMessageRequest(
    val roomId: String,
    val content: String,
    val type: MessageType = MessageType.TEXT
)
