# ChatStore Documentation

## Overview

The `chatStore` is a Zustand-based state management solution for the TOR Chat Android app. It manages all chat-related state including rooms, messages, typing indicators, online users, and unread counts.

## Features

- **Optimistic Updates**: Messages appear immediately in the UI before server confirmation
- **Memory-Efficient Pagination**: Load messages on demand with infinite scroll support
- **E2E Encryption**: Automatic encryption/decryption via CryptoService
- **Real-time Updates**: Socket.IO integration for live updates
- **Error Recovery**: Automatic retry logic and error handling
- **Unread Count Management**: Track unread messages per room
- **Typing Indicators**: Real-time typing status
- **Online Status**: Track which users are currently online

## Installation

The ChatStore is already set up in the project. Simply import it:

```typescript
import { useChatStore } from '../store/chatStore';
```

## Basic Usage

### 1. Loading Rooms

```typescript
import { useChatStore } from '../store/chatStore';
import { useEffect } from 'react';

function RoomListScreen() {
  const { rooms, loadRooms, isLoading, error } = useChatStore();

  useEffect(() => {
    loadRooms();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <FlatList
      data={rooms}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RoomItem room={item} />
      )}
    />
  );
}
```

### 2. Selecting a Room

```typescript
import { useChatStore } from '../store/chatStore';

function RoomItem({ room }: { room: Room }) {
  const { selectRoom } = useChatStore();

  const handlePress = async () => {
    try {
      await selectRoom(room.id);
      navigation.navigate('Chat', { roomId: room.id });
    } catch (error) {
      console.error('Failed to select room:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>{room.name}</Text>
      {room.unreadCount > 0 && (
        <Badge count={room.unreadCount} />
      )}
    </TouchableOpacity>
  );
}
```

### 3. Sending Messages

```typescript
import { useChatStore } from '../store/chatStore';
import { MessageType } from '../types/Chat';

function ChatInput({ roomId }: { roomId: string }) {
  const [text, setText] = useState('');
  const { sendMessage, error } = useChatStore();

  const handleSend = async () => {
    if (!text.trim()) return;

    try {
      await sendMessage(roomId, text.trim(), MessageType.TEXT);
      setText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
      />
      <Button onPress={handleSend} title="Send" />
    </View>
  );
}
```

### 4. Displaying Messages

```typescript
import { useChatStore } from '../store/chatStore';
import { useEffect, useRef } from 'react';

function ChatScreen({ roomId }: { roomId: string }) {
  const {
    getMessagesForRoom,
    loadMessages,
    loadMoreMessages,
    pagination
  } = useChatStore();

  const messages = getMessagesForRoom(roomId);
  const paginationState = pagination.get(roomId);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages(roomId);
  }, [roomId]);

  const handleLoadMore = () => {
    if (paginationState?.hasMore && !paginationState.isLoadingMore) {
      loadMoreMessages(roomId);
    }
  };

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={() =>
        paginationState?.isLoadingMore ? <ActivityIndicator /> : null
      }
    />
  );
}
```

### 5. Sending Files/Images

```typescript
import { useChatStore } from '../store/chatStore';
import { MessageType } from '../types/Chat';
import DocumentPicker from 'react-native-document-picker';

function AttachmentButton({ roomId }: { roomId: string }) {
  const { sendMessage } = useChatStore();

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      // Upload file first (implementation depends on your upload API)
      const uploadedUrl = await uploadFile(result.uri);

      // Send message with attachment
      await sendMessage(
        roomId,
        result.name,
        MessageType.FILE,
        [uploadedUrl]
      );
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Failed to attach file');
      }
    }
  };

  return (
    <TouchableOpacity onPress={handlePickFile}>
      <Icon name="attach-file" />
    </TouchableOpacity>
  );
}
```

### 6. Creating a Room

```typescript
import { useChatStore } from '../store/chatStore';
import { RoomType } from '../types/Chat';

function CreateRoomScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<RoomType>(RoomType.PUBLIC);

  const { createRoom, isLoading } = useChatStore();

  const handleCreate = async () => {
    try {
      const room = await createRoom({
        name,
        description,
        type,
        maxMembers: 100,
      });

      navigation.navigate('Chat', { roomId: room.id });
    } catch (error) {
      Alert.alert('Error', 'Failed to create room');
    }
  };

  return (
    <View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Room name"
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        multiline
      />
      <Picker
        selectedValue={type}
        onValueChange={setType}
      >
        <Picker.Item label="Public" value={RoomType.PUBLIC} />
        <Picker.Item label="Private" value={RoomType.PRIVATE} />
      </Picker>
      <Button
        onPress={handleCreate}
        title="Create"
        disabled={isLoading || !name.trim()}
      />
    </View>
  );
}
```

### 7. Typing Indicators

```typescript
import { useChatStore } from '../store/chatStore';
import { useEffect, useState } from 'react';
import { socketService } from '../services/SocketService';

function ChatInput({ roomId }: { roomId: string }) {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleTextChange = (value: string) => {
    setText(value);

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketService.sendTyping(roomId, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.sendTyping(roomId, false);
    }, 3000);
  };

  return (
    <TextInput
      value={text}
      onChangeText={handleTextChange}
      placeholder="Type a message..."
    />
  );
}

// Display typing users
function TypingIndicator({ roomId }: { roomId: string }) {
  const { typingUsers } = useChatStore();
  const typingInRoom = typingUsers.get(roomId) || [];

  if (typingInRoom.length === 0) return null;

  const names = typingInRoom.map(u => u.username).join(', ');
  const text = typingInRoom.length === 1
    ? `${names} is typing...`
    : `${names} are typing...`;

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>{text}</Text>
      <ActivityIndicator size="small" />
    </View>
  );
}
```

### 8. Unread Count Management

```typescript
import { useChatStore } from '../store/chatStore';
import { useEffect } from 'react';

function RoomListItem({ room }: { room: Room }) {
  const { unreadCounts, markRoomAsRead } = useChatStore();
  const unreadCount = unreadCounts.get(room.id) || 0;

  return (
    <TouchableOpacity
      onPress={() => {
        markRoomAsRead(room.id);
        navigation.navigate('Chat', { roomId: room.id });
      }}
    >
      <Text>{room.name}</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

### 9. Online Status

```typescript
import { useChatStore } from '../store/chatStore';

function UserAvatar({ userId }: { userId: string }) {
  const { onlineUsers } = useChatStore();
  const isOnline = onlineUsers.has(userId);

  return (
    <View style={styles.avatarContainer}>
      <Image source={{ uri: avatar }} style={styles.avatar} />
      {isOnline && (
        <View style={styles.onlineIndicator} />
      )}
    </View>
  );
}
```

### 10. Real-time Message Handling

The ChatStore automatically handles incoming Socket.IO events. To set up the Socket integration:

```typescript
// In SocketService.ts
import { useChatStore } from '../store/chatStore';

export class SocketService {
  private setupEventHandlers(): void {
    this.socket.on('message', (data: SocketMessageEvent) => {
      useChatStore.getState().handleNewMessage(data);
    });

    this.socket.on('user_typing', (data: SocketTypingEvent) => {
      useChatStore.getState().handleTyping(data);
    });

    this.socket.on('user_status', (data: SocketUserStatusEvent) => {
      useChatStore.getState().handleUserStatus(data);
    });

    this.socket.on('user_joined', (data: SocketUserRoomEvent) => {
      useChatStore.getState().handleUserJoin(data);
    });

    this.socket.on('user_left', (data: SocketUserRoomEvent) => {
      useChatStore.getState().handleUserLeave(data);
    });
  }
}
```

## State Structure

```typescript
{
  // Core state
  rooms: Room[];                          // All rooms user is member of
  currentRoom: Room | null;               // Currently selected room
  currentRoomId: string | null;           // Currently selected room ID
  messages: Map<string, Message[]>;       // Messages per room (roomId -> messages)
  members: Map<string, RoomMember[]>;     // Members per room (roomId -> members)
  roomKeys: Map<string, string>;          // Encryption keys (roomId -> key)
  typingUsers: Map<string, TypingUser[]>; // Typing users (roomId -> users)
  onlineUsers: Set<string>;               // Currently online user IDs
  unreadCounts: Map<string, number>;      // Unread counts (roomId -> count)
  isLoading: boolean;                     // Global loading state
  error: string | null;                   // Global error message

  // Pagination state
  pagination: Map<string, RoomPaginationState>; // Pagination per room
}
```

## API Methods

### Room Management

- `loadRooms()`: Load all rooms for current user
- `setCurrentRoom(roomId)`: Set current room (quick switch)
- `selectRoom(roomId)`: Select room and load full data
- `createRoom(params)`: Create a new room
- `joinRoom(roomId)`: Join an existing room
- `leaveRoom(roomId)`: Leave a room
- `deleteRoom(roomId)`: Delete a room (creator/admin only)
- `getRoomById(roomId)`: Get a room by ID

### Message Management

- `loadMessages(roomId, limit)`: Load initial messages for a room
- `loadMoreMessages(roomId, limit)`: Load older messages (pagination)
- `sendMessage(roomId, content, type, attachments)`: Send a message
- `addMessage(message)`: Add a message to cache (used internally)
- `updateMessage(messageId, updates)`: Update a message
- `updateMessageStatus(messageId, status)`: Update message send status
- `deleteMessage(messageId, roomId)`: Delete a message
- `getMessagesForRoom(roomId)`: Get messages for a room

### Real-time Event Handlers

- `handleNewMessage(message)`: Handle incoming message
- `handleUserJoin(data)`: Handle user joining room
- `handleUserLeave(data)`: Handle user leaving room
- `handleTyping(data)`: Handle typing indicator
- `handleStopTyping(data)`: Handle stop typing
- `handleUserStatus(data)`: Handle online/offline status

### Unread Counts

- `markRoomAsRead(roomId)`: Clear unread count for room
- `incrementUnread(roomId)`: Increment unread count
- `getUnreadCount(roomId)`: Get unread count for room

### Other

- `loadMembers(roomId)`: Load room members
- `addTypingUser(data)`: Add typing user
- `removeTypingUser(roomId, userId)`: Remove typing user
- `setError(error)`: Set error message
- `clearError()`: Clear error message
- `clearCurrentRoom()`: Clear current room selection
- `reset()`: Reset store to initial state (on logout)

## Best Practices

### 1. Memory Management

Load messages on demand using pagination:

```typescript
// Good: Load messages when entering room
useEffect(() => {
  if (roomId) {
    loadMessages(roomId, 50); // Load last 50 messages
  }
}, [roomId]);

// Bad: Loading all messages at once
// This can cause memory issues with large rooms
```

### 2. Optimistic Updates

Messages appear immediately in the UI:

```typescript
// The sendMessage function adds the message to UI immediately
// and marks it as 'sending', then updates to 'sent' or 'failed'
await sendMessage(roomId, content);
```

### 3. Error Handling

Always handle errors when calling async methods:

```typescript
try {
  await sendMessage(roomId, content);
} catch (error) {
  // Show error to user
  Alert.alert('Error', 'Failed to send message');
  // Error is also stored in chatStore.error
}
```

### 4. Cleanup

Reset the store on logout:

```typescript
const handleLogout = () => {
  chatStore.getState().reset();
  authStore.getState().logout();
};
```

### 5. Selective Re-renders

Use selector pattern to avoid unnecessary re-renders:

```typescript
// Good: Only re-render when messages change
const messages = useChatStore((state) => state.messages.get(roomId));

// Less optimal: Component re-renders on any state change
const { messages } = useChatStore();
```

## Integration with Services

### ApiService

All HTTP requests go through `apiService`:

```typescript
// ChatStore uses apiService internally
const response = await apiService.get<MessagesResponse>('/rooms/123/messages');
```

### SocketService

Real-time updates are handled via `socketService`:

```typescript
// SocketService emits events that ChatStore handles
socketService.on('message', (data) => {
  chatStore.getState().handleNewMessage(data);
});
```

### CryptoService

Messages are automatically encrypted/decrypted:

```typescript
// Encryption happens in sendMessage
const encryptedContent = await cryptoService.encryptMessage(content, roomKey);

// Decryption happens in handleNewMessage and loadMessages
const decryptedContent = await cryptoService.decryptMessage(encrypted, roomKey);
```

## Troubleshooting

### Messages Not Appearing

1. Check if Socket.IO is connected
2. Verify room encryption key is available
3. Check for decryption errors in console
4. Ensure `loadMessages()` was called for the room

### Optimistic Updates Not Working

1. Verify activeServer is set in serverStore
2. Check if user info is available
3. Look for errors in `sendMessage()`

### Pagination Not Loading

1. Check if `hasMore` is true for the room
2. Verify pagination state exists
3. Look for API errors in network logs

### Typing Indicators Not Showing

1. Ensure Socket.IO events are being received
2. Check if `handleTyping()` is being called
3. Verify timeout logic (5 seconds auto-clear)

## Performance Tips

1. **Lazy Load Messages**: Only load messages when entering a room
2. **Virtualized Lists**: Use `FlatList` with `windowSize` for large message lists
3. **Memoization**: Use `React.memo()` for message components
4. **Debounce Typing**: Throttle typing indicator events
5. **Cache Management**: Clear old message caches periodically

## Security Considerations

1. **E2E Encryption**: All messages are encrypted with room keys
2. **Key Storage**: Room keys are stored in memory only
3. **No Plaintext**: Never store decrypted content persistently
4. **Secure Sockets**: All Socket.IO traffic goes through TOR
5. **Token Management**: Tokens are handled by ApiService

## Examples Repository

Complete example implementations are available in:
- `/home/idan/Projects/tor-chat-app/packages/android/src/screens/`
- See `ChatScreen.tsx`, `RoomListScreen.tsx`, etc.

## Support

For issues or questions:
1. Check console logs for errors
2. Review network requests in React Native Debugger
3. Verify backend API is responding correctly
4. Check Socket.IO connection status

## Version

**Current Version**: 1.0.0
**Last Updated**: October 31, 2025
**Author**: TOR Chat Development Team
