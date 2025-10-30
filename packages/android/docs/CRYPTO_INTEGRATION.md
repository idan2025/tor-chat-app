# CryptoService Integration Guide

## Quick Start

This guide shows you how to integrate the CryptoService into your Android app stores and components.

---

## Table of Contents

1. [Store Integration](#store-integration)
2. [Component Integration](#component-integration)
3. [WebSocket Integration](#websocket-integration)
4. [File Upload/Download](#file-uploaddownload)
5. [Best Practices](#best-practices)

---

## Store Integration

### 1. Auth Store Integration

Update your `authStore.ts` to handle user keypairs:

```typescript
// packages/android/src/store/authStore.ts
import { cryptoService } from '../services/CryptoService';

export const useAuthStore = create<AuthState>((set, get) => ({
  // ... existing state ...

  /**
   * Register with E2E encryption setup
   */
  register: async (params: RegisterParams) => {
    set({ isLoading: true, error: null });
    try {
      // Initialize crypto service
      await cryptoService.initialize();

      // Generate user keypair
      const keypair = await cryptoService.generateKeypair();

      // Store keypair locally
      await cryptoService.storeUserKeypair(keypair);

      // Hash password
      const passwordHash = await cryptoService.hashPassword(params.password);

      // Register with server (send public key only)
      const response = await apiService.post('/auth/register', {
        username: params.username,
        email: params.email,
        displayName: params.displayName,
        passwordHash,
        publicKey: keypair.publicKey, // Only public key goes to server
      });

      // ... rest of registration logic ...
    } catch (error) {
      // ... error handling ...
    }
  },

  /**
   * Login and load keypair
   */
  login: async (params: LoginParams) => {
    set({ isLoading: true, error: null });
    try {
      // Initialize crypto service
      await cryptoService.initialize();

      // Login request
      const response = await apiService.post('/auth/login', {
        username: params.username,
        password: params.password,
      });

      // Verify keypair exists
      const hasKeypair = await cryptoService.hasUserKeypair();
      if (!hasKeypair) {
        // Generate and upload new keypair if missing
        const keypair = await cryptoService.generateKeypair();
        await cryptoService.storeUserKeypair(keypair);
        await apiService.put('/auth/update-public-key', {
          publicKey: keypair.publicKey,
        });
      }

      // ... rest of login logic ...
    } catch (error) {
      // ... error handling ...
    }
  },

  /**
   * Logout and optionally clear crypto data
   */
  logout: async (clearCryptoData: boolean = false) => {
    try {
      // ... existing logout logic ...

      // Optionally clear crypto data
      if (clearCryptoData) {
        await cryptoService.clearAllCryptoData();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
}));
```

### 2. Chat Store Integration

Create or update your `chatStore.ts` to handle encrypted messages:

```typescript
// packages/android/src/store/chatStore.ts
import { create } from 'zustand';
import { cryptoService } from '../services/CryptoService';
import { apiService } from '../services/ApiService';

interface Message {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  encrypted?: boolean;
  decryptionFailed?: boolean;
}

interface ChatState {
  messages: Message[];
  rooms: Room[];
  activeRoomId: string | null;

  // Actions
  sendMessage: (roomId: string, content: string) => Promise<void>;
  receiveMessage: (message: Message) => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  createRoom: (name: string, memberIds: string[]) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  rooms: [],
  activeRoomId: null,

  /**
   * Send encrypted message
   */
  sendMessage: async (roomId: string, content: string) => {
    try {
      // Get room key
      const roomKey = await cryptoService.getRoomKey(roomId);

      if (!roomKey) {
        throw new Error('Cannot send message - room not joined');
      }

      // Encrypt message
      const encryptedContent = await cryptoService.encryptMessage(
        content,
        roomKey
      );

      // Send to server
      const response = await apiService.post('/messages', {
        roomId,
        content: encryptedContent,
        type: 'text',
      });

      // Add to local state (already encrypted on server)
      const decryptedMessage = {
        ...response.message,
        content, // Store decrypted content locally
        encrypted: false,
      };

      set((state) => ({
        messages: [...state.messages, decryptedMessage],
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  /**
   * Receive and decrypt message
   */
  receiveMessage: async (message: Message) => {
    try {
      // Get room key
      const roomKey = await cryptoService.getRoomKey(message.roomId);

      if (!roomKey) {
        // Store encrypted message with warning
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              content: '[Encrypted - No Key Available]',
              encrypted: true,
            },
          ],
        }));
        return;
      }

      // Decrypt message
      const decryptedContent = await cryptoService.decryptMessage(
        message.content,
        roomKey
      );

      // Add decrypted message to state
      set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            content: decryptedContent,
            encrypted: false,
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to decrypt message:', error);

      // Add message with decryption error
      set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            content: '[Decryption Failed]',
            encrypted: true,
            decryptionFailed: true,
          },
        ],
      }));
    }
  },

  /**
   * Load and decrypt message history
   */
  loadMessages: async (roomId: string) => {
    try {
      // Fetch encrypted messages from server
      const response = await apiService.get(`/rooms/${roomId}/messages`);
      const encryptedMessages = response.messages;

      // Get room key
      const roomKey = await cryptoService.getRoomKey(roomId);

      if (!roomKey) {
        console.warn('No room key - cannot decrypt messages');
        set({ messages: encryptedMessages });
        return;
      }

      // Decrypt all messages
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg) => {
          try {
            const decryptedContent = await cryptoService.decryptMessage(
              msg.content,
              roomKey
            );
            return {
              ...msg,
              content: decryptedContent,
              encrypted: false,
            };
          } catch (error) {
            console.error(`Failed to decrypt message ${msg.id}:`, error);
            return {
              ...msg,
              content: '[Decryption Failed]',
              encrypted: true,
              decryptionFailed: true,
            };
          }
        })
      );

      set({ messages: decryptedMessages });
    } catch (error) {
      console.error('Failed to load messages:', error);
      throw error;
    }
  },

  /**
   * Create encrypted room
   */
  createRoom: async (name: string, memberIds: string[]) => {
    try {
      // Generate room key
      const roomKey = await cryptoService.generateRoomKey();

      // Create room on server
      const response = await apiService.post('/rooms', {
        name,
        isEncrypted: true,
      });
      const roomId = response.room.id;

      // Store room key locally
      await cryptoService.storeRoomKey(roomId, roomKey);

      // Get own keypair
      const ownKeypair = await cryptoService.getUserKeypair();

      // Encrypt room key for each member
      const encryptedKeys = await Promise.all(
        memberIds.map(async (userId) => {
          const memberData = await apiService.get(`/users/${userId}`);
          const encryptedKey = await cryptoService.encryptForUser(
            roomKey,
            memberData.publicKey,
            ownKeypair.privateKey
          );
          return { userId, encryptedKey };
        })
      );

      // Share encrypted keys
      await apiService.post(`/rooms/${roomId}/share-keys`, {
        encryptedKeys,
      });

      // Add room to state
      set((state) => ({
        rooms: [...state.rooms, response.room],
      }));

      return response.room;
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  },

  /**
   * Join encrypted room
   */
  joinRoom: async (roomId: string) => {
    try {
      // Send join request
      await apiService.post(`/rooms/${roomId}/join`);

      // Room key will be received via WebSocket
      // See WebSocket integration below
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  },
}));
```

---

## Component Integration

### Message Input Component

```typescript
// packages/android/src/components/MessageInput.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { useChatStore } from '../store/chatStore';

export const MessageInput: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [message, setMessage] = useState('');
  const sendMessage = useChatStore((state) => state.sendMessage);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      // This will automatically encrypt the message
      await sendMessage(roomId, message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error to user
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
        multiline
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!message.trim() || sending}
        style={styles.sendButton}
      >
        <Text>{sending ? 'Sending...' : 'Send'}</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### Message List Component

```typescript
// packages/android/src/components/MessageList.tsx
import React, { useEffect } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useChatStore } from '../store/chatStore';

export const MessageList: React.FC<{ roomId: string }> = ({ roomId }) => {
  const messages = useChatStore((state) =>
    state.messages.filter((m) => m.roomId === roomId)
  );
  const loadMessages = useChatStore((state) => state.loadMessages);

  useEffect(() => {
    loadMessages(roomId);
  }, [roomId]);

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.messageContainer}>
          <Text style={styles.sender}>{item.senderName}</Text>
          <Text style={styles.content}>
            {item.content}
            {item.encrypted && ' 🔒'}
            {item.decryptionFailed && ' ⚠️'}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleTimeString()}
          </Text>
        </View>
      )}
    />
  );
};
```

---

## WebSocket Integration

### Socket Service with Crypto

```typescript
// packages/android/src/services/SocketService.ts
import { io, Socket } from 'socket.io-client';
import { cryptoService } from './CryptoService';
import { useChatStore } from '../store/chatStore';

class SocketService {
  private socket: Socket | null = null;

  connect(serverUrl: string, token: string) {
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    // Listen for new encrypted messages
    this.socket.on('message', async (encryptedMessage) => {
      const chatStore = useChatStore.getState();
      await chatStore.receiveMessage(encryptedMessage);
    });

    // Listen for room key shares
    this.socket.on('room-key', async (data) => {
      try {
        const { roomId, encryptedRoomKey, senderPublicKey } = data;

        // Decrypt room key
        const ownKeypair = await cryptoService.getUserKeypair();
        const roomKey = await cryptoService.decryptFromUser(
          encryptedRoomKey,
          senderPublicKey,
          ownKeypair.privateKey
        );

        // Store room key
        await cryptoService.storeRoomKey(roomId, roomKey);

        console.log('Received and stored room key for:', roomId);

        // Optionally load messages now that we have the key
        const chatStore = useChatStore.getState();
        await chatStore.loadMessages(roomId);
      } catch (error) {
        console.error('Failed to handle room key:', error);
      }
    });

    // Listen for key rotation events
    this.socket.on('key-rotation', async (data) => {
      try {
        const { roomId, encryptedNewKey, senderPublicKey, version } = data;

        // Decrypt new room key
        const ownKeypair = await cryptoService.getUserKeypair();
        const newRoomKey = await cryptoService.decryptFromUser(
          encryptedNewKey,
          senderPublicKey,
          ownKeypair.privateKey
        );

        // Update room key
        await cryptoService.storeRoomKey(roomId, newRoomKey);

        console.log(`Room key rotated for ${roomId} (v${version})`);
      } catch (error) {
        console.error('Failed to handle key rotation:', error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
```

---

## File Upload/Download

### File Upload with Encryption

```typescript
// packages/android/src/services/FileService.ts
import { cryptoService } from './CryptoService';
import { apiService } from './ApiService';
import RNFS from 'react-native-fs';

export async function uploadEncryptedFile(
  roomId: string,
  fileUri: string,
  filename: string,
  mimetype: string
) {
  try {
    // Read file as base64
    const fileBase64 = await RNFS.readFile(fileUri, 'base64');

    // Get room key
    const roomKey = await cryptoService.getRoomKey(roomId);
    if (!roomKey) {
      throw new Error('No room key available');
    }

    // Encrypt file data
    const encryptedData = await cryptoService.encryptMessage(
      fileBase64,
      roomKey
    );

    // Upload encrypted file
    const response = await apiService.post('/files/upload', {
      roomId,
      filename,
      mimetype,
      data: encryptedData,
    });

    return response.file;
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
}

export async function downloadEncryptedFile(
  fileId: string,
  roomId: string,
  saveUri: string
) {
  try {
    // Download encrypted file
    const response = await apiService.get(`/files/${fileId}`);
    const { data, filename, mimetype } = response;

    // Get room key
    const roomKey = await cryptoService.getRoomKey(roomId);
    if (!roomKey) {
      throw new Error('No room key available');
    }

    // Decrypt file data
    const decryptedBase64 = await cryptoService.decryptMessage(data, roomKey);

    // Save to file system
    await RNFS.writeFile(saveUri, decryptedBase64, 'base64');

    return {
      uri: saveUri,
      filename,
      mimetype,
    };
  } catch (error) {
    console.error('File download failed:', error);
    throw error;
  }
}
```

---

## Best Practices

### 1. Initialize Early

Initialize the crypto service as early as possible in your app:

```typescript
// packages/android/App.tsx
import { useEffect } from 'react';
import { cryptoService } from './src/services/CryptoService';

export default function App() {
  useEffect(() => {
    // Initialize crypto service on app start
    cryptoService.initialize().catch((error) => {
      console.error('Failed to initialize crypto:', error);
    });
  }, []);

  return <Navigation />;
}
```

### 2. Error Handling

Always handle crypto errors gracefully:

```typescript
try {
  const decrypted = await cryptoService.decryptMessage(encrypted, key);
} catch (error) {
  // Don't crash - show user-friendly message
  return '[Message cannot be decrypted]';
}
```

### 3. Key Management

Never expose private keys:

```typescript
// ❌ BAD - Never send private key
await apiService.post('/update-keys', {
  publicKey: keypair.publicKey,
  privateKey: keypair.privateKey, // NEVER DO THIS
});

// ✅ GOOD - Only send public key
await apiService.post('/update-keys', {
  publicKey: keypair.publicKey,
});
```

### 4. Performance

Cache room keys in memory for better performance:

```typescript
// The CryptoService already caches room keys
// But you can also cache at the store level
const roomKeyCache = new Map<string, string>();

async function getCachedRoomKey(roomId: string): Promise<string | null> {
  if (roomKeyCache.has(roomId)) {
    return roomKeyCache.get(roomId)!;
  }

  const key = await cryptoService.getRoomKey(roomId);
  if (key) {
    roomKeyCache.set(roomId, key);
  }
  return key;
}
```

### 5. Security Checks

Verify crypto service is ready before sensitive operations:

```typescript
async function sendSensitiveData() {
  const status = cryptoService.getStatus();

  if (!status.initialized) {
    throw new Error('Crypto service not ready');
  }

  const hasKeypair = await cryptoService.hasUserKeypair();
  if (!hasKeypair) {
    throw new Error('User keypair not found');
  }

  // Proceed with encryption
}
```

### 6. Cleanup

Clear crypto data on logout (optional):

```typescript
async function logout() {
  // Clear auth state
  await AsyncStorage.removeItem('token');

  // Optionally clear crypto data
  const userChoice = await confirmDialog(
    'Clear encryption keys?',
    'This will make past messages unreadable.'
  );

  if (userChoice) {
    await cryptoService.clearAllCryptoData();
  }
}
```

---

## Troubleshooting Integration

### Messages Not Decrypting

1. Check if room key exists:
```typescript
const roomKey = await cryptoService.getRoomKey(roomId);
if (!roomKey) {
  console.log('No room key - user may not have joined room');
}
```

2. Verify keypair exists:
```typescript
const hasKeypair = await cryptoService.hasUserKeypair();
if (!hasKeypair) {
  console.log('No keypair - user may need to re-register');
}
```

3. Check if crypto service is initialized:
```typescript
const status = cryptoService.getStatus();
console.log('Crypto status:', status);
```

### Performance Issues

1. Batch decrypt messages:
```typescript
const decrypted = await Promise.all(
  messages.map(msg => cryptoService.decryptMessage(msg.content, roomKey))
);
```

2. Use pagination to limit messages loaded:
```typescript
const messages = await apiService.get(`/messages?limit=50&offset=0`);
```

---

## Testing

Test crypto integration:

```typescript
// packages/android/__tests__/crypto-integration.test.ts
import { cryptoService } from '../src/services/CryptoService';
import { useChatStore } from '../src/store/chatStore';

describe('Crypto Integration', () => {
  beforeAll(async () => {
    await cryptoService.initialize();
  });

  it('should encrypt and decrypt messages', async () => {
    const roomKey = await cryptoService.generateRoomKey();
    const roomId = 'test-room';
    await cryptoService.storeRoomKey(roomId, roomKey);

    const original = 'Hello, world!';
    const encrypted = await cryptoService.encryptMessage(original, roomKey);
    const decrypted = await cryptoService.decryptMessage(encrypted, roomKey);

    expect(decrypted).toBe(original);
  });
});
```

---

## Next Steps

1. Implement room key rotation for enhanced security
2. Add public key verification (QR codes, fingerprints)
3. Implement forward secrecy with ephemeral keys
4. Add backup/restore functionality for keys
5. Implement multi-device support with key synchronization

---

## Support

For issues or questions:
- Check the [CryptoService Documentation](./CRYPTO_SERVICE.md)
- Review the [Examples](../src/examples/CryptoServiceExamples.ts)
- Report bugs via GitHub Issues
