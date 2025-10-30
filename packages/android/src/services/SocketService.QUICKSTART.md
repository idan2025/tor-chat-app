# SocketService Quick Start Guide

## 5-Minute Integration

### Step 1: Import

```typescript
import { socketService } from './services/SocketService';
import { torService } from './services/TorService';
```

### Step 2: Connect

```typescript
// Ensure TOR is running
await torService.start();

// Connect to server
socketService.connect(
  'myserver.onion',
  'your-jwt-token-here'
);
```

### Step 3: Listen for Events

```typescript
// Connection events
socketService.onConnect(() => {
  console.log('Connected!');
});

socketService.onDisconnect(() => {
  console.log('Disconnected');
});

// Message events
socketService.onNewMessage((message) => {
  console.log('New message:', message);
});
```

### Step 4: Send Events

```typescript
// Join room
socketService.joinRoom('room-123');

// Send message
socketService.sendMessage('room-123', 'encrypted-content');

// Send typing
socketService.sendTyping('room-123');
```

### Step 5: Cleanup

```typescript
// On component unmount or logout
socketService.removeAllListeners();
socketService.disconnect();
```

## Common Patterns

### React Native useEffect

```typescript
useEffect(() => {
  // Setup listeners
  const messageHandler = (msg) => console.log(msg);
  socketService.onNewMessage(messageHandler);

  // Join room
  socketService.joinRoom(roomId);

  // Cleanup
  return () => {
    socketService.offNewMessage(messageHandler);
    socketService.leaveRoom(roomId);
  };
}, [roomId]);
```

### ChatStore Integration

```typescript
export const useChatStore = create((set) => ({
  messages: [],

  initialize: (token, server) => {
    socketService.onNewMessage((msg) => {
      set((state) => ({
        messages: [...state.messages, msg]
      }));
    });
    socketService.connect(server, token);
  },

  cleanup: () => {
    socketService.removeAllListeners();
    socketService.disconnect();
  },
}));
```

### Error Handling

```typescript
socketService.onError((error) => {
  Toast.show({
    type: 'error',
    text1: error.message,
  });
});

socketService.onConnectionStateChange((state) => {
  if (state === SocketConnectionState.ERROR) {
    // Handle connection error
  }
});
```

## API Cheat Sheet

### Connection
- `connect(server, token, options?)` - Connect to server
- `disconnect()` - Disconnect from server
- `isConnected()` - Check if connected
- `getConnectionState()` - Get current state

### Emit (Client → Server)
- `joinRoom(roomId)` - Join a room
- `leaveRoom(roomId)` - Leave a room
- `sendMessage(roomId, content, metadata?)` - Send message
- `sendTyping(roomId)` - Send typing indicator
- `sendStopTyping(roomId)` - Stop typing

### Listen (Server → Client)
- `onConnect(callback)` - Connection established
- `onDisconnect(callback)` - Connection lost
- `onNewMessage(callback)` - New message
- `onUserJoin(callback)` - User joined
- `onUserLeave(callback)` - User left
- `onTyping(callback)` - Typing indicator
- `onError(callback)` - Error occurred

### Cleanup
- `offConnect(callback)` - Remove connect listener
- `offNewMessage(callback)` - Remove message listener
- `removeAllListeners()` - Remove all listeners

## Common Issues

### "TOR_NOT_READY" Error
**Fix:** Start TOR before connecting
```typescript
await torService.start();
socketService.connect(...);
```

### "NOT_CONNECTED" Error
**Fix:** Check connection state before emitting
```typescript
if (socketService.isConnected()) {
  socketService.sendMessage(...);
}
```

### Memory Leaks
**Fix:** Always clean up listeners
```typescript
// In useEffect cleanup
return () => {
  socketService.offNewMessage(handler);
};
```

### Events Not Firing
**Fix:** Register listeners before connecting
```typescript
// Register first
socketService.onNewMessage(handler);

// Then connect
socketService.connect(...);
```

## That's It!

You're ready to use SocketService. For more details, see:
- `SocketService.README.md` - Full API documentation
- `SocketService.INTEGRATION.md` - Complete integration examples
