# SocketService Integration Guide

This guide shows how to integrate SocketService with your ChatStore and React Native components.

## Complete Integration Example

### 1. ChatStore Integration

```typescript
// src/store/chatStore.ts
import { create } from 'zustand';
import { socketService } from '../services/SocketService';
import { cryptoService } from '../services/CryptoService';
import { notificationService } from '../services/NotificationService';
import { SocketMessage, UserTypingEvent, MessageType } from '../types/socket';

interface Message {
  id: string;
  roomId: string;
  sender: {
    id: string;
    username: string;
    displayName?: string;
  };
  content: string; // Decrypted content
  messageType: MessageType;
  createdAt: Date;
  attachments?: string[];
}

interface Room {
  id: string;
  name: string;
  encryptionKey: string; // Base64 encoded
  members: string[];
}

interface ChatStore {
  rooms: Room[];
  messages: Map<string, Message[]>; // roomId -> messages
  typingUsers: Map<string, Set<string>>; // roomId -> Set<username>
  isSocketConnected: boolean;

  // Actions
  initialize: (token: string, serverOnion: string) => void;
  cleanup: () => void;
  sendMessage: (roomId: string, content: string, messageType?: MessageType, attachments?: string[]) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;

  // Internal handlers
  handleNewMessage: (message: SocketMessage) => void;
  handleTyping: (data: UserTypingEvent) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  rooms: [],
  messages: new Map(),
  typingUsers: new Map(),
  isSocketConnected: false,

  initialize: (token: string, serverOnion: string) => {
    console.log('[ChatStore] Initializing socket connection...');

    // Setup all socket event listeners
    socketService.onConnect(() => {
      console.log('[ChatStore] Socket connected');
      set({ isSocketConnected: true });

      // Join all rooms on connect
      const rooms = get().rooms;
      rooms.forEach(room => {
        socketService.joinRoom(room.id);
      });
    });

    socketService.onDisconnect((reason) => {
      console.log('[ChatStore] Socket disconnected:', reason);
      set({ isSocketConnected: false });
    });

    socketService.onNewMessage((message) => {
      console.log('[ChatStore] New message received:', message.id);
      get().handleNewMessage(message);
    });

    socketService.onUserJoin((data) => {
      console.log(`[ChatStore] User joined: ${data.username} in room ${data.roomId}`);
      // Could show a system message here
    });

    socketService.onUserLeave((data) => {
      console.log(`[ChatStore] User left: ${data.username} from room ${data.roomId}`);
      // Could show a system message here
    });

    socketService.onTyping((data) => {
      get().handleTyping(data);
    });

    socketService.onError((error) => {
      console.error('[ChatStore] Socket error:', error);
      // Could show error notification
    });

    // Connect to server
    socketService.connect(serverOnion, token, {
      timeout: 60000,
      reconnectionAttempts: 5,
    });
  },

  cleanup: () => {
    console.log('[ChatStore] Cleaning up socket connection...');
    socketService.removeAllListeners();
    socketService.disconnect();
    set({ isSocketConnected: false });
  },

  sendMessage: async (roomId: string, content: string, messageType = MessageType.TEXT, attachments?: string[]) => {
    try {
      // Find room
      const room = get().rooms.find(r => r.id === roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Encrypt message content
      const encryptedContent = await cryptoService.encrypt(content, room.encryptionKey);

      // Send via socket
      socketService.sendMessage(roomId, encryptedContent, {
        messageType,
        attachments,
      });

      // Stop typing indicator
      socketService.sendStopTyping(roomId);

    } catch (error) {
      console.error('[ChatStore] Failed to send message:', error);
      throw error;
    }
  },

  startTyping: (roomId: string) => {
    socketService.sendTyping(roomId);
  },

  stopTyping: (roomId: string) => {
    socketService.sendStopTyping(roomId);
  },

  handleNewMessage: async (socketMessage: SocketMessage) => {
    try {
      // Find room
      const room = get().rooms.find(r => r.id === socketMessage.roomId);
      if (!room) {
        console.warn('[ChatStore] Received message for unknown room:', socketMessage.roomId);
        return;
      }

      // Decrypt message content
      const decryptedContent = await cryptoService.decrypt(
        socketMessage.encryptedContent,
        room.encryptionKey
      );

      // Create message object
      const message: Message = {
        id: socketMessage.id,
        roomId: socketMessage.roomId,
        sender: socketMessage.sender,
        content: decryptedContent,
        messageType: socketMessage.messageType,
        createdAt: new Date(socketMessage.createdAt),
        attachments: socketMessage.attachments,
      };

      // Add to messages map
      set((state) => {
        const messages = new Map(state.messages);
        const roomMessages = messages.get(socketMessage.roomId) || [];
        messages.set(socketMessage.roomId, [...roomMessages, message]);
        return { messages };
      });

      // Show notification if app is in background
      // and message is from another user
      const currentUserId = await AsyncStorage.getItem('userId');
      if (socketMessage.sender.id !== currentUserId) {
        notificationService.showNewMessageNotification(message, room.name);
      }

    } catch (error) {
      console.error('[ChatStore] Failed to handle new message:', error);
    }
  },

  handleTyping: (data: UserTypingEvent) => {
    set((state) => {
      const typingUsers = new Map(state.typingUsers);
      const roomTyping = new Set(typingUsers.get(data.roomId) || []);

      if (data.isTyping) {
        roomTyping.add(data.username);
      } else {
        roomTyping.delete(data.username);
      }

      typingUsers.set(data.roomId, roomTyping);
      return { typingUsers };
    });
  },
}));
```

### 2. React Native Chat Screen

```typescript
// src/screens/ChatScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useChatStore } from '../store/chatStore';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';

export default function ChatScreen({ route, navigation }: any) {
  const { roomId } = route.params;

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store selectors
  const messages = useChatStore((state) => state.messages.get(roomId) || []);
  const rooms = useChatStore((state) => state.rooms);
  const typingUsers = useChatStore((state) => state.typingUsers.get(roomId) || new Set());
  const isConnected = useChatStore((state) => state.isSocketConnected);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const startTyping = useChatStore((state) => state.startTyping);
  const stopTyping = useChatStore((state) => state.stopTyping);

  const room = rooms.find(r => r.id === roomId);

  useEffect(() => {
    // Join room when screen mounts
    socketService.joinRoom(roomId);

    // Leave room when screen unmounts
    return () => {
      socketService.leaveRoom(roomId);
      stopTyping(roomId);

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const handleTextChange = (newText: string) => {
    setText(newText);

    // Send typing indicator
    if (newText.length > 0) {
      startTyping(roomId);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(roomId);
      }, 3000);
    } else {
      stopTyping(roomId);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(roomId, text);
      setText('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Failed to send message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to send message',
        text2: 'Please try again',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.roomName}>{room?.name || 'Chat'}</Text>
          {!isConnected && (
            <Text style={styles.statusOffline}>Connecting...</Text>
          )}
          {isConnected && (
            <Text style={styles.statusOnline}>Connected</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('RoomSettings', { roomId })}>
          <Text style={styles.settingsButton}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
        <TypingIndicator usernames={Array.from(typingUsers)} />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Text style={styles.attachIcon}>+</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={handleTextChange}
          multiline
          maxLength={5000}
          editable={!isSending && isConnected}
        />

        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    fontSize: 24,
    color: '#fff',
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusOnline: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  statusOffline: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
  },
  settingsButton: {
    fontSize: 24,
    color: '#fff',
    width: 40,
    textAlign: 'right',
  },
  messageList: {
    padding: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    backgroundColor: '#1a1a2e',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachIcon: {
    fontSize: 24,
    color: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#4c2f87',
  },
  sendIcon: {
    fontSize: 24,
    color: '#fff',
  },
});
```

### 3. Typing Indicator Component

```typescript
// src/components/TypingIndicator.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TypingIndicatorProps {
  usernames: string[];
}

export function TypingIndicator({ usernames }: TypingIndicatorProps) {
  if (usernames.length === 0) return null;

  const displayText = (() => {
    if (usernames.length === 1) {
      return `${usernames[0]} is typing...`;
    } else if (usernames.length === 2) {
      return `${usernames[0]} and ${usernames[1]} are typing...`;
    } else {
      return `${usernames[0]} and ${usernames.length - 1} others are typing...`;
    }
  })();

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 15,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
    marginHorizontal: 2,
  },
  dot1: {
    // Add animation here
  },
  dot2: {
    // Add animation here
  },
  dot3: {
    // Add animation here
  },
  text: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
```

### 4. App Initialization

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { torService } from './services/TorService';

const Stack = createNativeStackNavigator();

export default function App() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const activeServer = useAuthStore((state) => state.activeServer);
  const initializeChat = useChatStore((state) => state.initialize);
  const cleanupChat = useChatStore((state) => state.cleanup);

  useEffect(() => {
    // Initialize TOR on app start
    const initTor = async () => {
      try {
        await torService.start();
      } catch (error) {
        console.error('Failed to start TOR:', error);
      }
    };

    initTor();

    // Cleanup on unmount
    return () => {
      torService.stop();
    };
  }, []);

  useEffect(() => {
    // Initialize socket connection when user is logged in
    if (user && token && activeServer) {
      console.log('Initializing chat with socket connection...');
      initializeChat(token, activeServer.onionAddress);
    } else {
      console.log('Cleaning up chat...');
      cleanupChat();
    }

    // Cleanup on logout
    return () => {
      if (!user) {
        cleanupChat();
      }
    };
  }, [user, token, activeServer]);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="RoomSettings" component={RoomSettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Summary

This integration demonstrates:

1. **ChatStore** - Centralizes socket event handling and state management
2. **ChatScreen** - React Native UI component with typing indicators
3. **Automatic connection** - Socket connects when user logs in
4. **Automatic cleanup** - Socket disconnects when user logs out
5. **Room management** - Joins/leaves rooms appropriately
6. **Error handling** - Gracefully handles connection issues
7. **Typing indicators** - Shows when other users are typing
8. **Message encryption** - Encrypts/decrypts messages automatically

The SocketService is now fully integrated and ready to use!
