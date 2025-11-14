package com.torchat.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.torchat.shared.models.Message
import com.torchat.shared.socket.SocketConnectionState
import com.torchat.ui.components.MessageBubble
import com.torchat.viewmodel.ChatViewModel
import kotlinx.coroutines.launch

/**
 * Chat Room Screen
 *
 * Displays:
 * - Real-time message list
 * - Message input field
 * - Connection status
 * - Typing indicators
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatRoomScreen(
    roomId: String,
    roomName: String,
    currentUserId: String,
    viewModel: ChatViewModel,
    onBackPress: () -> Unit
) {
    val messages by viewModel.currentRoomMessages.collectAsState()
    val isLoading by viewModel.loadingState.collectAsState()
    val error by viewModel.errorState.collectAsState()
    val connectionState by viewModel.connectionState.collectAsState()
    val typingUsers by viewModel.typingUsers.collectAsState()

    var messageText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // Load messages and join room when screen appears
    LaunchedEffect(roomId) {
        viewModel.loadMessages(roomId)
        viewModel.joinRoom(roomId)
    }

    // Auto-scroll to bottom when new messages arrive
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            coroutineScope.launch {
                listState.animateScrollToItem(messages.size - 1)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = roomName,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        // Connection status or typing indicator
                        when (connectionState) {
                            is SocketConnectionState.Connecting -> {
                                Text(
                                    text = "Connecting...",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            is SocketConnectionState.Connected -> {
                                if (typingUsers.isNotEmpty()) {
                                    Text(
                                        text = "${typingUsers.joinToString(", ")} ${if (typingUsers.size == 1) "is" else "are"} typing...",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                } else {
                                    Text(
                                        text = "Online",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                            is SocketConnectionState.Error -> {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Error,
                                        contentDescription = "Error",
                                        modifier = Modifier.size(12.dp),
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                    Text(
                                        text = "Connection error",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                            is SocketConnectionState.Disconnected -> {
                                Text(
                                    text = "Offline",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackPress) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Room settings */ }) {
                        Icon(Icons.Default.MoreVert, "More options")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            MessageInputBar(
                messageText = messageText,
                onMessageTextChange = {
                    messageText = it
                    viewModel.emitTyping(roomId, it.isNotEmpty())
                },
                onSendMessage = {
                    if (messageText.isNotBlank()) {
                        viewModel.sendMessage(roomId, messageText.trim())
                        messageText = ""
                        viewModel.emitTyping(roomId, false)
                    }
                },
                enabled = connectionState is SocketConnectionState.Connected
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isLoading && messages.isEmpty() -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                error != null && messages.isEmpty() -> {
                    ErrorView(
                        message = error ?: "Unknown error",
                        onRetry = { viewModel.loadMessages(roomId) },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                messages.isEmpty() -> {
                    EmptyMessagesView(modifier = Modifier.align(Alignment.Center))
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(messages, key = { it.id }) { message ->
                            MessageBubble(
                                message = message,
                                isOwnMessage = message.userId == currentUserId,
                                onLongPress = { /* TODO: Message actions */ }
                            )
                        }
                    }
                }
            }

            // Error snackbar
            error?.let { errorMessage ->
                if (messages.isNotEmpty()) {
                    Snackbar(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(16.dp),
                        action = {
                            TextButton(onClick = { viewModel.clearError() }) {
                                Text("Dismiss")
                            }
                        }
                    ) {
                        Text(errorMessage)
                    }
                }
            }
        }
    }
}

/**
 * Message input bar component
 */
@Composable
fun MessageInputBar(
    messageText: String,
    onMessageTextChange: (String) -> Unit,
    onSendMessage: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 3.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = messageText,
                onValueChange = onMessageTextChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("Type a message...") },
                enabled = enabled,
                maxLines = 5,
                shape = MaterialTheme.shapes.large
            )

            FilledIconButton(
                onClick = onSendMessage,
                enabled = enabled && messageText.isNotBlank(),
                modifier = Modifier.size(56.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send message"
                )
            }
        }
    }
}

/**
 * Empty messages placeholder
 */
@Composable
fun EmptyMessagesView(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "No messages yet",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Send a message to start the conversation",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
        )
    }
}
