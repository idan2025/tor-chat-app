package com.torchat.shared.models

sealed class TorStatus {
    data object Disconnected : TorStatus()
    data class Connecting(val progress: Int) : TorStatus()
    data object Connected : TorStatus()
    data class Error(val message: String) : TorStatus()
}

data class TorConfig(
    val socksPort: Int = 9050,
    val controlPort: Int = 9051,
    val useBridges: Boolean = false,
    val bridges: List<String> = emptyList()
)
