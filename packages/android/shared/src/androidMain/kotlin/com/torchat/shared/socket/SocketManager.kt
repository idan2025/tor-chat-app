package com.torchat.shared.socket

import android.util.Log
import com.torchat.shared.models.Message
import com.torchat.shared.tor.TorManager
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.URI

/**
 * Socket.IO Manager for real-time chat communication over TOR
 *
 * Handles:
 * - WebSocket connections through TOR SOCKS proxy
 * - Real-time message events
 * - Connection state management
 * - Auto-reconnection
 */
class SocketManager(
    private val torManager: TorManager,
    private val serverUrl: String = "http://localhost:3000"
) {
    private var socket: Socket? = null
    private val json = Json { ignoreUnknownKeys = true }

    private val _connectionState = MutableStateFlow<SocketConnectionState>(SocketConnectionState.Disconnected)
    val connectionState: StateFlow<SocketConnectionState> = _connectionState.asStateFlow()

    private val _newMessages = MutableStateFlow<Message?>(null)
    val newMessages: StateFlow<Message?> = _newMessages.asStateFlow()

    private val _userTyping = MutableStateFlow<UserTypingEvent?>(null)
    val userTyping: StateFlow<UserTypingEvent?> = _userTyping.asStateFlow()

    private val _userOnline = MutableStateFlow<UserOnlineEvent?>(null)
    val userOnline: StateFlow<UserOnlineEvent?> = _userOnline.asStateFlow()

    companion object {
        private const val TAG = "SocketManager"

        // Socket events
        private const val EVENT_NEW_MESSAGE = "newMessage"
        private const val EVENT_USER_TYPING = "userTyping"
        private const val EVENT_USER_ONLINE = "userOnline"
        private const val EVENT_JOIN_ROOM = "joinRoom"
        private const val EVENT_SEND_MESSAGE = "sendMessage"
        private const val EVENT_TYPING = "typing"
    }

    /**
     * Connect to Socket.IO server through TOR proxy
     */
    fun connect(authToken: String) {
        try {
            Log.d(TAG, "Connecting to Socket.IO at $serverUrl")
            _connectionState.value = SocketConnectionState.Connecting

            // Get TOR SOCKS proxy configuration
            val (proxyHost, proxyPort) = torManager.getSocksProxy()

            // Configure OkHttp client with SOCKS proxy
            val okHttpClient = OkHttpClient.Builder()
                .proxy(Proxy(Proxy.Type.SOCKS, InetSocketAddress(proxyHost, proxyPort)))
                .build()

            // Socket.IO options
            val options = IO.Options().apply {
                callFactory = okHttpClient
                webSocketFactory = okHttpClient
                auth = mapOf("token" to authToken)
                reconnection = true
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                reconnectionAttempts = 5
                transports = arrayOf("websocket")
            }

            // Create socket instance
            socket = IO.socket(URI.create(serverUrl), options)

            // Setup event listeners
            setupEventListeners()

            // Connect
            socket?.connect()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to Socket.IO", e)
            _connectionState.value = SocketConnectionState.Error(e.message ?: "Connection failed")
        }
    }

    /**
     * Setup Socket.IO event listeners
     */
    private fun setupEventListeners() {
        socket?.apply {
            // Connection events
            on(Socket.EVENT_CONNECT, onConnect)
            on(Socket.EVENT_DISCONNECT, onDisconnect)
            on(Socket.EVENT_CONNECT_ERROR, onConnectError)

            // Chat events
            on(EVENT_NEW_MESSAGE, onNewMessage)
            on(EVENT_USER_TYPING, onUserTyping)
            on(EVENT_USER_ONLINE, onUserOnline)
        }
    }

    private val onConnect = Emitter.Listener {
        Log.i(TAG, "Socket.IO connected")
        _connectionState.value = SocketConnectionState.Connected
    }

    private val onDisconnect = Emitter.Listener {
        Log.w(TAG, "Socket.IO disconnected")
        _connectionState.value = SocketConnectionState.Disconnected
    }

    private val onConnectError = Emitter.Listener { args ->
        val error = args.firstOrNull()
        Log.e(TAG, "Socket.IO connection error: $error")
        _connectionState.value = SocketConnectionState.Error(error?.toString() ?: "Connection error")
    }

    private val onNewMessage = Emitter.Listener { args ->
        try {
            val data = args.firstOrNull() as? JSONObject
            if (data != null) {
                val message = Message(
                    id = data.getString("id"),
                    roomId = data.getString("roomId"),
                    userId = data.getString("userId"),
                    username = data.getString("username"),
                    content = data.getString("content"),
                    timestamp = data.getLong("timestamp"),
                    encrypted = data.optBoolean("encrypted", false)
                )
                Log.d(TAG, "New message received: ${message.content}")
                _newMessages.value = message
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse new message", e)
        }
    }

    private val onUserTyping = Emitter.Listener { args ->
        try {
            val data = args.firstOrNull() as? JSONObject
            if (data != null) {
                val event = UserTypingEvent(
                    userId = data.getString("userId"),
                    username = data.getString("username"),
                    roomId = data.getString("roomId"),
                    isTyping = data.getBoolean("isTyping")
                )
                _userTyping.value = event
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse typing event", e)
        }
    }

    private val onUserOnline = Emitter.Listener { args ->
        try {
            val data = args.firstOrNull() as? JSONObject
            if (data != null) {
                val event = UserOnlineEvent(
                    userId = data.getString("userId"),
                    username = data.getString("username"),
                    online = data.getBoolean("online")
                )
                _userOnline.value = event
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse online event", e)
        }
    }

    /**
     * Join a chat room
     */
    fun joinRoom(roomId: String) {
        try {
            val data = JSONObject().apply {
                put("roomId", roomId)
            }
            socket?.emit(EVENT_JOIN_ROOM, data)
            Log.d(TAG, "Joined room: $roomId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to join room", e)
        }
    }

    /**
     * Send a message to the current room
     */
    fun sendMessage(roomId: String, content: String) {
        try {
            val data = JSONObject().apply {
                put("roomId", roomId)
                put("content", content)
            }
            socket?.emit(EVENT_SEND_MESSAGE, data)
            Log.d(TAG, "Message sent to room $roomId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
        }
    }

    /**
     * Emit typing indicator
     */
    fun emitTyping(roomId: String, isTyping: Boolean) {
        try {
            val data = JSONObject().apply {
                put("roomId", roomId)
                put("isTyping", isTyping)
            }
            socket?.emit(EVENT_TYPING, data)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit typing event", e)
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    fun disconnect() {
        try {
            Log.d(TAG, "Disconnecting from Socket.IO")
            socket?.disconnect()
            socket?.off()
            socket = null
            _connectionState.value = SocketConnectionState.Disconnected
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket", e)
        }
    }

    /**
     * Check if socket is connected
     */
    fun isConnected(): Boolean = socket?.connected() == true
}

/**
 * Socket connection states
 */
sealed class SocketConnectionState {
    object Disconnected : SocketConnectionState()
    object Connecting : SocketConnectionState()
    object Connected : SocketConnectionState()
    data class Error(val message: String) : SocketConnectionState()
}

/**
 * User typing event
 */
data class UserTypingEvent(
    val userId: String,
    val username: String,
    val roomId: String,
    val isTyping: Boolean
)

/**
 * User online event
 */
data class UserOnlineEvent(
    val userId: String,
    val username: String,
    val online: Boolean
)
