# SocketService Documentation

## Overview

The `SocketService` provides real-time bidirectional communication with the TOR Chat server using Socket.IO over the TOR network. This service handles:

- **Secure connections** through TOR SOCKS5 proxy
- **Real-time messaging** with encrypted content
- **Typing indicators** and presence updates
- **Room management** (join/leave)
- **Auto-reconnection** with exponential backoff
- **Event-driven architecture** with type-safe callbacks
- **Memory leak prevention** with proper cleanup

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
│                                                              │
│  ChatStore ──► SocketService ──► TorService (SOCKS5)       │
│      │              │                    │                   │
│      │              │                    ↓                   │
│      │              │              TOR Network               │
│      │              │                    │                   │
│      │              └────────────────────┼──────────────────►│
│      │                                   ↓                   │
│      └───────────────────────────► Server (.onion)          │
│         (receives events)                │                   │
│                                          ↓                   │
│                                   Socket.IO Server           │
└─────────────────────────────────────────────────────────────┘
```

## Installation

The SocketService is already included in the project. Import it:

```typescript
import { socketService } from './services/SocketService';
// or
import socketService from './services/SocketService';
```

## Basic Usage

### 1. Connect to Server

```typescript
import { socketService } from './services/SocketService';

// Ensure TOR is running first
await torService.start();

// Connect with JWT token
socketService.connect(
  'abc123xyz456.onion', // Server onion address
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // JWT token
  {
    // Optional configuration
    timeout: 60000, // 60 seconds
    reconnectionAttempts: 5,
  }
);
```

### 2. Listen for Events

```typescript
// Connection events
socketService.onConnect(() => {
  console.log('Connected to server!');
});

socketService.onDisconnect((reason) => {
  console.log('Disconnected:', reason);
});

// Message events
socketService.onNewMessage((message) => {
  console.log('New message:', message);
  // Decrypt and display message
  const decrypted = cryptoService.decrypt(message.encryptedContent, roomKey);
  chatStore.addMessage({ ...message, content: decrypted });
});

// User events
socketService.onUserJoin((data) => {
  console.log(`${data.username} joined room ${data.roomId}`);
});

socketService.onUserLeave((data) => {
  console.log(`${data.username} left room ${data.roomId}`);
});

socketService.onTyping((data) => {
  if (data.isTyping) {
    console.log(`${data.username} is typing...`);
  } else {
    console.log(`${data.username} stopped typing`);
  }
});

// Error events
socketService.onError((error) => {
  console.error('Socket error:', error);
  // Show error to user
  Toast.show({
    type: 'error',
    text1: 'Connection Error',
    text2: error.message,
  });
});
```

### 3. Send Events

```typescript
// Join a room
socketService.joinRoom('room-123');

// Send a message
const encryptedContent = cryptoService.encrypt('Hello world!', roomKey);
socketService.sendMessage('room-123', encryptedContent, {
  messageType: MessageType.TEXT,
});

// Send typing indicator
socketService.sendTyping('room-123');

// Stop typing
setTimeout(() => {
  socketService.sendStopTyping('room-123');
}, 3000);

// Leave a room
socketService.leaveRoom('room-123');
```

### 4. Cleanup

```typescript
// Remove specific listener
const messageHandler = (message) => {
  console.log(message);
};
socketService.onNewMessage(messageHandler);

// Later, remove it
socketService.offNewMessage(messageHandler);

// Remove all listeners (e.g., on logout)
socketService.removeAllListeners();

// Disconnect
socketService.disconnect();
```

## Integration with ChatStore

Example Zustand store integration:

```typescript
// chatStore.ts
import { create } from 'zustand';
import { socketService } from '../services/SocketService';
import { cryptoService } from '../services/CryptoService';

interface ChatStore {
  messages: Message[];
  typingUsers: Map<string, string[]>; // roomId -> usernames[]

  initialize: () => void;
  cleanup: () => void;
  sendMessage: (roomId: string, content: string) => void;
  handleNewMessage: (message: SocketMessage) => void;
  handleTyping: (data: UserTypingEvent) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  typingUsers: new Map(),

  initialize: () => {
    // Setup socket listeners
    socketService.onNewMessage((message) => {
      get().handleNewMessage(message);
    });

    socketService.onTyping((data) => {
      get().handleTyping(data);
    });

    socketService.onConnect(() => {
      console.log('Chat connected');
    });

    socketService.onError((error) => {
      console.error('Chat error:', error);
    });
  },

  cleanup: () => {
    socketService.removeAllListeners();
    socketService.disconnect();
  },

  sendMessage: async (roomId: string, content: string) => {
    // Get room encryption key
    const roomKey = await cryptoService.getRoomKey(roomId);

    // Encrypt message
    const encrypted = cryptoService.encrypt(content, roomKey);

    // Send via socket
    socketService.sendMessage(roomId, encrypted, {
      messageType: MessageType.TEXT,
    });
  },

  handleNewMessage: (message: SocketMessage) => {
    // Decrypt message
    const roomKey = cryptoService.getRoomKey(message.roomId);
    const decrypted = cryptoService.decrypt(message.encryptedContent, roomKey);

    // Add to store
    set((state) => ({
      messages: [...state.messages, {
        ...message,
        content: decrypted,
      }],
    }));
  },

  handleTyping: (data: UserTypingEvent) => {
    set((state) => {
      const typing = new Map(state.typingUsers);
      const users = typing.get(data.roomId) || [];

      if (data.isTyping) {
        // Add user to typing list
        if (!users.includes(data.username)) {
          typing.set(data.roomId, [...users, data.username]);
        }
      } else {
        // Remove user from typing list
        typing.set(data.roomId, users.filter(u => u !== data.username));
      }

      return { typingUsers: typing };
    });
  },
}));
```

## React Native Component Example

```typescript
// ChatScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text } from 'react-native';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/SocketService';

export default function ChatScreen({ route }) {
  const { roomId } = route.params;
  const [text, setText] = useState('');
  const messages = useChatStore((state) => state.messages);
  const sendMessage = useChatStore((state) => state.sendMessage);

  useEffect(() => {
    // Join room on mount
    socketService.joinRoom(roomId);

    // Leave room on unmount
    return () => {
      socketService.leaveRoom(roomId);
    };
  }, [roomId]);

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(roomId, text);
      setText('');
    }
  };

  const handleTyping = (newText: string) => {
    setText(newText);

    // Send typing indicator
    if (newText.length > 0) {
      socketService.sendTyping(roomId);
    } else {
      socketService.sendStopTyping(roomId);
    }
  };

  return (
    <View>
      <FlatList
        data={messages.filter(m => m.roomId === roomId)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text>{item.sender.username}: {item.content}</Text>
        )}
      />

      <TextInput
        value={text}
        onChangeText={handleTyping}
        onSubmitEditing={handleSend}
        placeholder="Type a message..."
      />
    </View>
  );
}
```

## API Reference

### Connection Methods

#### `connect(serverOnion: string, token: string, options?: SocketConfig): void`

Connect to Socket.IO server through TOR.

**Parameters:**
- `serverOnion` - Server onion address (e.g., "abc123.onion")
- `token` - JWT authentication token
- `options` - Optional configuration (timeout, reconnection settings)

**Example:**
```typescript
socketService.connect('myserver.onion', 'jwt-token-here', {
  timeout: 60000,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});
```

#### `disconnect(): void`

Disconnect from server and cleanup resources.

#### `isConnected(): boolean`

Check if socket is currently connected.

**Returns:** `true` if connected, `false` otherwise

#### `getConnectionState(): SocketConnectionState`

Get current connection state.

**Returns:** One of:
- `DISCONNECTED`
- `CONNECTING`
- `CONNECTED`
- `RECONNECTING`
- `ERROR`

### Emit Methods (Client → Server)

#### `joinRoom(roomId: string): void`

Join a chat room.

#### `leaveRoom(roomId: string): void`

Leave a chat room.

#### `sendMessage(roomId: string, encryptedContent: string, metadata?: SendMessageOptions): void`

Send a message to a room.

**Parameters:**
- `roomId` - Room ID
- `encryptedContent` - Encrypted message content
- `metadata` - Optional metadata (messageType, attachments, etc.)

**Example:**
```typescript
socketService.sendMessage('room-123', encryptedContent, {
  messageType: MessageType.IMAGE,
  attachments: ['file-url-1', 'file-url-2'],
});
```

#### `sendTyping(roomId: string): void`

Send typing indicator.

#### `sendStopTyping(roomId: string): void`

Send stop typing indicator.

### Event Listeners (Server → Client)

#### `onConnect(callback: () => void): void`

Listen for connection event.

#### `onDisconnect(callback: (reason: string) => void): void`

Listen for disconnect event.

#### `onNewMessage(callback: (message: SocketMessage) => void): void`

Listen for new messages.

#### `onUserJoin(callback: (data: UserJoinedEvent) => void): void`

Listen for user join events.

#### `onUserLeave(callback: (data: UserLeftEvent) => void): void`

Listen for user leave events.

#### `onUserStatus(callback: (data: UserStatusEvent) => void): void`

Listen for user status changes (online/offline).

#### `onTyping(callback: (data: UserTypingEvent) => void): void`

Listen for typing indicators.

#### `onRoomInvite(callback: (data: RoomInviteEvent) => void): void`

Listen for room invitations.

#### `onError(callback: (error: SocketErrorEvent) => void): void`

Listen for errors.

#### `onConnectionStateChange(callback: (state: SocketConnectionState) => void): void`

Listen for connection state changes.

### Remove Listeners

All event listeners have corresponding `off*` methods:

- `offConnect(callback)`
- `offDisconnect(callback)`
- `offNewMessage(callback)`
- `offUserJoin(callback)`
- `offUserLeave(callback)`
- `offUserStatus(callback)`
- `offTyping(callback)`
- `offRoomInvite(callback)`
- `offError(callback)`
- `offConnectionStateChange(callback)`

#### `removeAllListeners(): void`

Remove all event listeners (cleanup).

## Configuration Options

```typescript
interface SocketConfig {
  serverOnion: string;           // Required: Server onion address
  token: string;                 // Required: JWT token
  timeout?: number;              // Default: 60000 (60 seconds)
  reconnection?: boolean;        // Default: true
  reconnectionAttempts?: number; // Default: 5
  reconnectionDelay?: number;    // Default: 2000 (2 seconds)
  reconnectionDelayMax?: number; // Default: 10000 (10 seconds)
  reconnectionDelayMultiplier?: number; // Default: 1.5
}
```

## Error Handling

Errors are emitted through the `onError` event:

```typescript
socketService.onError((error) => {
  console.error('Socket error:', error);

  switch (error.code) {
    case 'TOR_NOT_READY':
      // TOR is not connected
      Toast.show({
        type: 'error',
        text1: 'TOR Not Ready',
        text2: 'Please ensure TOR is running',
      });
      break;

    case 'CONNECTION_FAILED':
      // Failed to establish connection
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: 'Could not connect to server',
      });
      break;

    case 'MAX_RECONNECT_ATTEMPTS':
      // Exceeded maximum reconnection attempts
      Toast.show({
        type: 'error',
        text1: 'Connection Lost',
        text2: 'Please try again later',
      });
      break;

    case 'NOT_CONNECTED':
      // Attempted to emit event while disconnected
      console.warn('Socket not connected');
      break;

    default:
      Toast.show({
        type: 'error',
        text1: 'Socket Error',
        text2: error.message,
      });
  }
});
```

## Auto-Reconnection

The SocketService implements automatic reconnection with exponential backoff:

1. **Initial attempt**: Reconnect after 2 seconds
2. **Second attempt**: Reconnect after 3 seconds (2 × 1.5)
3. **Third attempt**: Reconnect after 4.5 seconds
4. **Fourth attempt**: Reconnect after 6.75 seconds
5. **Fifth attempt**: Reconnect after 10 seconds (max delay)

After 5 failed attempts, reconnection stops and an error is emitted.

Monitor reconnection state:

```typescript
socketService.onConnectionStateChange((state) => {
  switch (state) {
    case SocketConnectionState.CONNECTING:
      console.log('Connecting...');
      break;
    case SocketConnectionState.CONNECTED:
      console.log('Connected!');
      break;
    case SocketConnectionState.RECONNECTING:
      console.log('Reconnecting...');
      break;
    case SocketConnectionState.DISCONNECTED:
      console.log('Disconnected');
      break;
    case SocketConnectionState.ERROR:
      console.log('Connection error');
      break;
  }
});
```

## TOR Integration

The SocketService relies on TorService for SOCKS5 proxy routing:

```typescript
// Ensure TOR is running before connecting
if (!torService.isReady()) {
  await torService.start();

  // Wait for TOR to be ready
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (torService.isReady()) {
        clearInterval(checkInterval);
        resolve(true);
      }
    }, 1000);
  });
}

// Now connect socket
socketService.connect(serverOnion, token);
```

## Memory Management

Prevent memory leaks by properly cleaning up listeners:

```typescript
// In React Native component
useEffect(() => {
  const messageHandler = (message) => {
    console.log(message);
  };

  socketService.onNewMessage(messageHandler);

  // Cleanup on unmount
  return () => {
    socketService.offNewMessage(messageHandler);
  };
}, []);

// On logout
socketService.removeAllListeners();
socketService.disconnect();
```

## Best Practices

1. **Always ensure TOR is ready** before connecting
2. **Handle connection state changes** to update UI
3. **Implement error handling** for network issues
4. **Clean up listeners** on component unmount
5. **Join/leave rooms** appropriately to reduce server load
6. **Debounce typing indicators** to avoid excessive events
7. **Encrypt all message content** before sending
8. **Validate received data** before processing

## Testing

```typescript
// Mock for testing
jest.mock('./services/SocketService', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(() => true),
    sendMessage: jest.fn(),
    onNewMessage: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));
```

## Troubleshooting

### Connection fails with "TOR_NOT_READY"

**Solution:** Ensure TorService is started before connecting:

```typescript
await torService.start();
await socketService.connect(serverOnion, token);
```

### Connection timeout

**Solution:** Increase timeout for slow TOR connections:

```typescript
socketService.connect(serverOnion, token, {
  timeout: 120000, // 2 minutes
});
```

### Reconnection not working

**Solution:** Check reconnection is enabled:

```typescript
socketService.connect(serverOnion, token, {
  reconnection: true,
  reconnectionAttempts: 10,
});
```

### Events not firing

**Solution:** Ensure listeners are registered before events occur:

```typescript
// Register listeners first
socketService.onNewMessage(handler);

// Then connect
socketService.connect(serverOnion, token);
```

## License

MIT
