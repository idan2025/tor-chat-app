package com.torchat.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.torchat.shared.models.Message
import com.torchat.ui.theme.MessageBubbleReceived
import com.torchat.ui.theme.MessageBubbleSent
import java.text.SimpleDateFormat
import java.util.*

/**
 * Message bubble component for chat messages
 *
 * Displays:
 * - Different styling for sent vs received messages
 * - User avatar
 * - Username
 * - Message content
 * - Timestamp
 * - Long-press actions (placeholder)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubble(
    message: Message,
    isOwnMessage: Boolean,
    modifier: Modifier = Modifier,
    onLongPress: (Message) -> Unit = {}
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = if (isOwnMessage) Arrangement.End else Arrangement.Start
    ) {
        // Avatar for received messages (left side)
        if (!isOwnMessage) {
            UserAvatar(
                username = message.username,
                modifier = Modifier
                    .padding(end = 8.dp)
                    .align(Alignment.Bottom)
            )
        }

        // Message bubble
        Column(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = if (isOwnMessage) 16.dp else 4.dp,
                        topEnd = if (isOwnMessage) 4.dp else 16.dp,
                        bottomStart = 16.dp,
                        bottomEnd = 16.dp
                    )
                )
                .background(
                    if (isOwnMessage) MessageBubbleSent else MessageBubbleReceived
                )
                .combinedClickable(
                    onClick = { },
                    onLongClick = { onLongPress(message) }
                )
                .padding(12.dp),
            horizontalAlignment = if (isOwnMessage) Alignment.End else Alignment.Start
        ) {
            // Username (for received messages)
            if (!isOwnMessage) {
                Text(
                    text = message.username,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Message content
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Timestamp
            Text(
                text = formatTimestamp(message.timestamp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )

            // Encryption indicator
            if (message.encrypted) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Person, // Using Person as placeholder for lock icon
                        contentDescription = "Encrypted",
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                    )
                    Text(
                        text = "Encrypted",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                    )
                }
            }
        }

        // Avatar for sent messages (right side)
        if (isOwnMessage) {
            UserAvatar(
                username = message.username,
                modifier = Modifier
                    .padding(start = 8.dp)
                    .align(Alignment.Bottom)
            )
        }
    }
}

/**
 * User avatar component
 */
@Composable
fun UserAvatar(
    username: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.size(32.dp),
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.primaryContainer
    ) {
        Box(
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = username.take(1).uppercase(),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

/**
 * Format timestamp for display
 */
private fun formatTimestamp(timestamp: Long): String {
    val date = Date(timestamp)
    val now = Date()

    val calendar = Calendar.getInstance().apply { time = now }
    val messageCalendar = Calendar.getInstance().apply { time = date }

    return when {
        // Same day - show time only
        calendar.get(Calendar.DAY_OF_YEAR) == messageCalendar.get(Calendar.DAY_OF_YEAR) &&
        calendar.get(Calendar.YEAR) == messageCalendar.get(Calendar.YEAR) -> {
            SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
        }
        // Yesterday
        calendar.get(Calendar.DAY_OF_YEAR) - messageCalendar.get(Calendar.DAY_OF_YEAR) == 1 &&
        calendar.get(Calendar.YEAR) == messageCalendar.get(Calendar.YEAR) -> {
            "Yesterday ${SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)}"
        }
        // This year - show date and time without year
        calendar.get(Calendar.YEAR) == messageCalendar.get(Calendar.YEAR) -> {
            SimpleDateFormat("MMM dd HH:mm", Locale.getDefault()).format(date)
        }
        // Different year - show full date
        else -> {
            SimpleDateFormat("MMM dd yyyy HH:mm", Locale.getDefault()).format(date)
        }
    }
}
