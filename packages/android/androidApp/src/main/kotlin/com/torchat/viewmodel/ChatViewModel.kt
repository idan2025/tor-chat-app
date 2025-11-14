package com.torchat.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.torchat.shared.models.Message
import com.torchat.shared.models.Room
import com.torchat.shared.repository.ChatRepository
import com.torchat.shared.socket.SocketConnectionState
import com.torchat.shared.socket.SocketManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ChatViewModel(
    private val chatRepository: ChatRepository,
    private val socketManager: SocketManager? = null
) : ViewModel() {

    private val _rooms = MutableStateFlow<List<Room>>(emptyList())
    val rooms: StateFlow<List<Room>> = _rooms.asStateFlow()

    private val _currentRoomMessages = MutableStateFlow<List<Message>>(emptyList())
    val currentRoomMessages: StateFlow<List<Message>> = _currentRoomMessages.asStateFlow()

    private val _loadingState = MutableStateFlow(false)
    val loadingState: StateFlow<Boolean> = _loadingState.asStateFlow()

    private val _errorState = MutableStateFlow<String?>(null)
    val errorState: StateFlow<String?> = _errorState.asStateFlow()

    private val _connectionState = MutableStateFlow<SocketConnectionState>(SocketConnectionState.Disconnected)
    val connectionState: StateFlow<SocketConnectionState> = _connectionState.asStateFlow()

    private val _typingUsers = MutableStateFlow<List<String>>(emptyList())
    val typingUsers: StateFlow<List<String>> = _typingUsers.asStateFlow()

    private var currentRoomId: String? = null
    private var socketListenerJob: Job? = null
    private var typingTimeoutJob: Job? = null

    init {
        // Observe socket connection state
        socketManager?.let { socket ->
            viewModelScope.launch {
                socket.connectionState.collect { state ->
                    _connectionState.value = state
                }
            }

            // Observe new messages from socket
            viewModelScope.launch {
                socket.newMessages.collect { message ->
                    message?.let { addMessageToList(it) }
                }
            }

            // Observe typing indicators
            viewModelScope.launch {
                socket.userTyping.collect { event ->
                    event?.let {
                        if (it.roomId == currentRoomId) {
                            updateTypingUsers(it.username, it.isTyping)
                        }
                    }
                }
            }
        }
    }

    fun loadRooms() {
        viewModelScope.launch {
            _loadingState.value = true
            _errorState.value = null

            val result = chatRepository.getRooms()
            result.fold(
                onSuccess = { roomList ->
                    _rooms.value = roomList
                    _loadingState.value = false
                },
                onFailure = { error ->
                    _errorState.value = "Failed to load rooms: ${error.message}"
                    _loadingState.value = false
                }
            )
        }
    }

    fun loadMessages(roomId: String) {
        viewModelScope.launch {
            _loadingState.value = true
            _errorState.value = null
            currentRoomId = roomId

            val result = chatRepository.getMessages(roomId)
            result.fold(
                onSuccess = { messages ->
                    _currentRoomMessages.value = messages.sortedBy { it.timestamp }
                    _loadingState.value = false
                },
                onFailure = { error ->
                    _errorState.value = "Failed to load messages: ${error.message}"
                    _loadingState.value = false
                }
            )
        }
    }

    /**
     * Join a room via Socket.IO
     */
    fun joinRoom(roomId: String) {
        currentRoomId = roomId
        socketManager?.joinRoom(roomId)
    }

    /**
     * Send a message to the current room
     */
    fun sendMessage(roomId: String, content: String) {
        viewModelScope.launch {
            // Send via HTTP API first
            val result = chatRepository.sendMessage(roomId, content)
            result.fold(
                onSuccess = { message ->
                    // Message sent successfully, it will arrive via socket
                    // Optionally emit via socket for instant delivery
                    socketManager?.sendMessage(roomId, content)
                },
                onFailure = { error ->
                    _errorState.value = "Failed to send message: ${error.message}"
                }
            )
        }
    }

    /**
     * Emit typing indicator
     */
    fun emitTyping(roomId: String, isTyping: Boolean) {
        socketManager?.emitTyping(roomId, isTyping)

        // Clear typing indicator after 3 seconds
        if (isTyping) {
            typingTimeoutJob?.cancel()
            typingTimeoutJob = viewModelScope.launch {
                kotlinx.coroutines.delay(3000)
                socketManager?.emitTyping(roomId, false)
            }
        }
    }

    /**
     * Add a message to the current room's message list
     */
    private fun addMessageToList(message: Message) {
        if (message.roomId == currentRoomId) {
            val currentMessages = _currentRoomMessages.value.toMutableList()
            // Only add if not already in the list
            if (currentMessages.none { it.id == message.id }) {
                currentMessages.add(message)
                _currentRoomMessages.value = currentMessages.sortedBy { it.timestamp }
            }
        }
    }

    /**
     * Update typing users list
     */
    private fun updateTypingUsers(username: String, isTyping: Boolean) {
        val currentTyping = _typingUsers.value.toMutableList()
        if (isTyping) {
            if (!currentTyping.contains(username)) {
                currentTyping.add(username)
            }
        } else {
            currentTyping.remove(username)
        }
        _typingUsers.value = currentTyping
    }

    /**
     * Connect to Socket.IO server
     */
    suspend fun connectSocket() {
        val token = chatRepository.getAuthToken()
        if (token != null) {
            socketManager?.connect(token)
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    fun disconnectSocket() {
        socketManager?.disconnect()
    }

    fun clearError() {
        _errorState.value = null
    }

    override fun onCleared() {
        super.onCleared()
        socketListenerJob?.cancel()
        typingTimeoutJob?.cancel()
        disconnectSocket()
    }
}
