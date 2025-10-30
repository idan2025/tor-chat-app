# Android App Complete Redesign - Implementation Plan

> **Status**: Design Phase - Ready for Implementation
> **Current Version**: 0.1.2 (Basic prototype)
> **Target Version**: 1.0.0 (Full-featured app)
> **Timeline**: 6-8 weeks
> **Date**: October 30, 2025

---

## Executive Summary

Complete redesign of the TOR Chat Android app with integrated TOR support, multi-server management, full chat features, admin panel, and push notifications.

**Current State:**
- ❌ Basic prototype with Login/Register only
- ❌ Chat screen is placeholder ("Coming Soon")
- ❌ No TOR integration (hardcoded localhost)
- ❌ No multi-server support
- ❌ No admin features
- ❌ No notifications
- ❌ No native code

**Target State:**
- ✅ Integrated TOR support (no Orbot dependency)
- ✅ Multi-server management (save multiple .onion addresses)
- ✅ Full-featured chat UI (rooms, messages, files, reactions)
- ✅ Complete admin panel for mobile
- ✅ Push notifications for messages and room invites
- ✅ Native TOR library integration
- ✅ Offline message queue
- ✅ E2E encryption matching webapp

---

## Table of Contents

1. [Current Architecture Assessment](#1-current-architecture-assessment)
2. [TOR Integration Strategy](#2-tor-integration-strategy)
3. [Multi-Server Management](#3-multi-server-management)
4. [Authentication & Server Selection](#4-authentication--server-selection)
5. [Chat UI Implementation](#5-chat-ui-implementation)
6. [Admin Panel for Mobile](#6-admin-panel-for-mobile)
7. [Push Notifications](#7-push-notifications)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Technical Architecture](#9-technical-architecture)
10. [Dependencies & Libraries](#10-dependencies--libraries)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. Current Architecture Assessment

### 1.1 Existing Structure

```
packages/android/
├── package.json              # React Native 0.73, basic deps
├── App.tsx                   # Navigation setup
├── index.js                  # Entry point
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx   # ✅ Working
│   │   ├── RegisterScreen.tsx # ✅ Working
│   │   ├── ChatScreen.tsx    # ❌ Placeholder only
│   │   └── LoadingScreen.tsx # ✅ Working
│   └── store/
│       └── authStore.ts      # ✅ Basic Zustand store
└── android/                  # ❌ MISSING - No native code yet!
```

### 1.2 Issues Identified

**Critical Issues:**
1. ❌ **No native Android folder** - React Native project not initialized
2. ❌ **Hardcoded localhost API** - Uses `10.0.2.2:3000` instead of .onion
3. ❌ **No TOR support** - Can't connect to hidden services
4. ❌ **Chat screen empty** - No actual chat functionality
5. ❌ **No build configuration** - No gradle files

**Missing Features:**
- Multi-server support
- TOR connectivity
- Socket.IO integration
- E2E encryption
- File sharing
- Admin features
- Notifications
- Offline support

### 1.3 Dependencies Assessment

**Current (Minimal):**
```json
{
  "react-native": "0.73.0",
  "socket.io-client": "^4.7.2",
  "react-native-sodium": "^0.3.9",
  "@react-navigation/native": "^7.1.19"
}
```

**Missing (Required):**
- TOR library (react-native-tor or custom native module)
- Push notifications (react-native-push-notification)
- File picker (react-native-document-picker)
- Image picker (react-native-image-picker)
- Permissions (react-native-permissions)
- KeyStore/SecureStorage
- Background task support

---

## 2. TOR Integration Strategy

### 2.1 TOR Library Options

#### Option A: IPtProxy (Recommended) ✅

**Library:** `react-native-iptproxy`

**Pros:**
- Official Tor integration for mobile
- No Orbot dependency
- Works on Android and iOS
- Maintained by Guardian Project
- Bundles Tor binary

**Cons:**
- Larger APK size (~10MB)
- Initial connection slow (15-30s)

**Implementation:**

```bash
npm install react-native-iptproxy
```

```typescript
// packages/android/src/services/TorService.ts
import { Tor } from 'react-native-iptproxy';

export class TorService {
  private tor: any = null;
  private socksPort: number = 9050;

  async start(): Promise<boolean> {
    try {
      this.tor = new Tor();
      await this.tor.startTor({
        socksPort: this.socksPort,
        controlPort: 9051,
      });

      // Wait for bootstrap
      await this.waitForBootstrap();

      return true;
    } catch (error) {
      console.error('Failed to start Tor:', error);
      return false;
    }
  }

  async stop(): Promise<void> {
    if (this.tor) {
      await this.tor.stopTor();
    }
  }

  getSocksProxy(): string {
    return `socks5://127.0.0.1:${this.socksPort}`;
  }

  async waitForBootstrap(): Promise<void> {
    // Poll bootstrap status until 100%
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const status = await this.tor.getBootstrapStatus();
        if (status >= 100) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  getCircuitInfo(): Promise<any> {
    return this.tor.getCircuits();
  }
}

export const torService = new TorService();
```

#### Option B: Tor-Android Native Module (Alternative)

**Library:** Custom native module using `tor-android`

**Pros:**
- More control
- Can customize Tor configuration
- Latest Tor features

**Cons:**
- Requires native Android development
- More maintenance

### 2.2 Network Configuration

**HTTP Client with Tor Support:**

```typescript
// packages/android/src/services/ApiService.ts
import axios from 'axios';
import { torService } from './TorService';

class ApiService {
  private axiosInstance: any;

  async initialize(serverOnion: string) {
    const socksProxy = torService.getSocksProxy();

    this.axiosInstance = axios.create({
      baseURL: `http://${serverOnion}`,
      timeout: 60000, // TOR is slow
      proxy: false, // Disable default proxy
      // Custom adapter for SOCKS5 proxy
      adapter: this.createSocksAdapter(socksProxy),
    });
  }

  private createSocksAdapter(proxyUrl: string) {
    // Use react-native-http-bridge or similar
    // to route through SOCKS5 proxy
    return require('axios-socks-proxy-adapter')({
      proxy: proxyUrl,
    });
  }

  async get(path: string) {
    return this.axiosInstance.get(path);
  }

  async post(path: string, data: any) {
    return this.axiosInstance.post(path, data);
  }
}

export const apiService = new ApiService();
```

**Socket.IO with Tor:**

```typescript
// packages/android/src/services/SocketService.ts
import io from 'socket.io-client';
import { torService } from './TorService';

class SocketService {
  private socket: any = null;

  connect(serverOnion: string, token: string) {
    const socksProxy = torService.getSocksProxy();

    this.socket = io(`http://${serverOnion}`, {
      auth: { token },
      transports: ['websocket'],
      timeout: 60000,
      // Route through SOCKS5 proxy
      agent: this.createSocksAgent(socksProxy),
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server via Tor');
    });

    this.socket.on('newMessage', (message) => {
      // Handle new message
      // Trigger notification
    });

    this.socket.on('roomInvite', (invite) => {
      // Handle room invitation
      // Trigger notification
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export const socketService = new SocketService();
```

---

## 3. Multi-Server Management

### 3.1 Server Storage

**Data Model:**

```typescript
// packages/android/src/types/Server.ts
export interface Server {
  id: string;
  name: string;
  onionAddress: string; // xxx.onion
  isActive: boolean;
  lastConnected: Date;
  thumbnail?: string;
  userCount?: number;

  // Authentication
  token?: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    isAdmin: boolean;
  };

  // Connection status
  isConnected: boolean;
  connectionError?: string;
  torCircuitStatus?: string;
}
```

**Storage Service:**

```typescript
// packages/android/src/services/ServerStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Server } from '../types/Server';

const SERVERS_KEY = '@tor-chat:servers';
const ACTIVE_SERVER_KEY = '@tor-chat:active-server';

export class ServerStorage {
  async saveServer(server: Server): Promise<void> {
    const servers = await this.getAllServers();
    const existing = servers.findIndex(s => s.id === server.id);

    if (existing >= 0) {
      servers[existing] = server;
    } else {
      servers.push(server);
    }

    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  }

  async getAllServers(): Promise<Server[]> {
    const data = await AsyncStorage.getItem(SERVERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  async deleteServer(serverId: string): Promise<void> {
    const servers = await this.getAllServers();
    const filtered = servers.filter(s => s.id !== serverId);
    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(filtered));
  }

  async setActiveServer(serverId: string): Promise<void> {
    await AsyncStorage.setItem(ACTIVE_SERVER_KEY, serverId);
  }

  async getActiveServer(): Promise<Server | null> {
    const serverId = await AsyncStorage.getItem(ACTIVE_SERVER_KEY);
    if (!serverId) return null;

    const servers = await this.getAllServers();
    return servers.find(s => s.id === serverId) || null;
  }
}

export const serverStorage = new ServerStorage();
```

### 3.2 Server Management UI

**Server List Screen:**

```typescript
// packages/android/src/screens/ServerListScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { serverStorage } from '../services/ServerStorage';
import { Server } from '../types/Server';

export default function ServerListScreen({ navigation }: any) {
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    const allServers = await serverStorage.getAllServers();
    const active = await serverStorage.getActiveServer();
    setServers(allServers);
    setActiveServerId(active?.id || null);
  };

  const handleSelectServer = async (server: Server) => {
    await serverStorage.setActiveServer(server.id);
    navigation.navigate('Chat');
  };

  const handleAddServer = () => {
    navigation.navigate('AddServer');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Servers</Text>

      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.serverCard,
              item.id === activeServerId && styles.activeServer,
            ]}
            onPress={() => handleSelectServer(item)}
          >
            <View style={styles.serverIcon}>
              <Text style={styles.serverIconText}>
                {item.name[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.serverInfo}>
              <Text style={styles.serverName}>{item.name}</Text>
              <Text style={styles.serverOnion} numberOfLines={1}>
                {item.onionAddress}
              </Text>
              {item.isConnected && (
                <Text style={styles.serverStatus}>● Connected</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
        <Text style={styles.addButtonText}>+ Add Server</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  serverCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  activeServer: {
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  serverIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serverIconText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  serverOnion: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  serverStatus: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

**Add Server Screen:**

```typescript
// packages/android/src/screens/AddServerScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { serverStorage } from '../services/ServerStorage';
import { torService } from '../services/TorService';
import { apiService } from '../services/ApiService';

export default function AddServerScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [onionAddress, setOnionAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleAddServer = async () => {
    if (!onionAddress.endsWith('.onion')) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Address',
        text2: 'Must be a .onion address',
      });
      return;
    }

    setIsValidating(true);

    try {
      // Ensure Tor is running
      await torService.start();

      // Test connection to server
      await apiService.initialize(onionAddress);
      const response = await apiService.get('/health');

      if (response.status === 200) {
        // Save server
        const server = {
          id: Date.now().toString(),
          name: name || onionAddress.split('.')[0],
          onionAddress,
          isActive: false,
          lastConnected: new Date(),
          isConnected: false,
        };

        await serverStorage.saveServer(server);

        Toast.show({
          type: 'success',
          text1: 'Server Added',
          text2: `${server.name} is ready to use`,
        });

        navigation.goBack();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: 'Could not reach server via Tor',
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Server</Text>

      <TextInput
        style={styles.input}
        placeholder="Server Name (optional)"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder=".onion Address"
        placeholderTextColor="#999"
        value={onionAddress}
        onChangeText={setOnionAddress}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleAddServer}
        disabled={isValidating || !onionAddress}
      >
        {isValidating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Add Server</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

---

## 4. Authentication & Server Selection

### 4.1 Login Flow with Server Selection

**Updated Login Screen:**

```typescript
// packages/android/src/screens/LoginScreen.tsx (updated)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Picker,
} from 'react-native';
import { serverStorage } from '../services/ServerStorage';
import { useAuthStore } from '../store/authStore';
import { Server } from '../types/Server';

export default function LoginScreen({ navigation }: any) {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    const allServers = await serverStorage.getAllServers();
    setServers(allServers);
    if (allServers.length > 0) {
      setSelectedServer(allServers[0]);
    }
  };

  const handleLogin = async () => {
    if (!selectedServer) {
      Toast.show({
        type: 'error',
        text1: 'No Server Selected',
        text2: 'Please add a server first',
      });
      return;
    }

    try {
      await login(selectedServer, username, password);
      navigation.navigate('Chat');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.response?.data?.error || 'Please check your credentials',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TOR Chat</Text>

      {/* Server Selector */}
      <View style={styles.serverSelector}>
        <Text style={styles.label}>Server:</Text>
        <Picker
          selectedValue={selectedServer?.id}
          style={styles.picker}
          onValueChange={(itemValue) => {
            const server = servers.find(s => s.id === itemValue);
            setSelectedServer(server || null);
          }}
        >
          {servers.map(server => (
            <Picker.Item
              key={server.id}
              label={server.name}
              value={server.id}
            />
          ))}
        </Picker>
        <TouchableOpacity onPress={() => navigation.navigate('ServerList')}>
          <Text style={styles.link}>Manage Servers</Text>
        </TouchableOpacity>
      </View>

      {/* Login Form */}
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 5. Chat UI Implementation

### 5.1 Required Screens

1. **RoomListScreen** - List all rooms (public/private)
2. **ChatScreen** - Individual room chat
3. **RoomSettingsScreen** - Manage room (admin)
4. **UserProfileScreen** - View/edit profile
5. **FileViewerScreen** - View images/files

### 5.2 Chat Features Matrix

| Feature | Web App | Android App | Implementation |
|---------|---------|-------------|----------------|
| Text Messages | ✅ | ✅ | Socket.IO + E2E encryption |
| File Sharing | ✅ | ✅ | Document picker + upload API |
| Image Sharing | ✅ | ✅ | Image picker + upload API |
| Message Reactions | ✅ | ✅ | Socket events |
| Typing Indicators | ✅ | ✅ | Socket events |
| Online Status | ✅ | ✅ | Socket presence |
| Room Creation | ✅ | ✅ | API + UI |
| Room Deletion | ✅ | ✅ | API (creator/admin only) |
| User Invite | ✅ | ✅ | API + Socket notification |
| User Kick/Ban | ✅ | ✅ | API (admin only) |
| Search Messages | ✅ | ✅ | Local search |
| Link Previews | ✅ | ✅ | Metadata fetching |
| YouTube Embeds | ✅ | ✅ | WebView or native player |

### 5.3 Chat Screen Implementation

```typescript
// packages/android/src/screens/ChatScreen.tsx (complete)
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useChatStore } from '../store/chatStore';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';

export default function ChatScreen({ route, navigation }: any) {
  const { roomId } = route.params;
  const { messages, currentRoom, sendMessage, loadMessages } = useChatStore();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages(roomId);
  }, [roomId]);

  const handleSend = async () => {
    if (text.trim()) {
      await sendMessage(roomId, text);
      setText('');
      flatListRef.current?.scrollToEnd();
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
        <Text style={styles.roomName}>{currentRoom?.name}</Text>
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Typing Indicator */}
      <TypingIndicator />

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
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendIcon}>→</Text>
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
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    fontSize: 24,
    color: '#fff',
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
  sendIcon: {
    fontSize: 24,
    color: '#fff',
  },
});
```

---

## 6. Admin Panel for Mobile

### 6.1 Admin Features

**Admin Menu:**
- User Management (list, toggle admin, delete)
- Room Management (list, delete any room)
- Server Statistics (users, rooms, messages)
- Server Settings (if ENABLE_LOGGING, etc.)

**Admin Screen:**

```typescript
// packages/android/src/screens/AdminScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/ApiService';

export default function AdminScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.isAdmin) {
      loadStats();
    }
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiService.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access Denied</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalRooms || 0}</Text>
          <Text style={styles.statLabel}>Total Rooms</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalMessages || 0}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.onlineUsers || 0}</Text>
          <Text style={styles.statLabel}>Online Now</Text>
        </View>
      </View>

      {/* Management Buttons */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.navigate('AdminUsers')}
      >
        <Text style={styles.menuButtonText}>👥 Manage Users</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.navigate('AdminRooms')}
      >
        <Text style={styles.menuButtonText}>💬 Manage Rooms</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.navigate('AdminSettings')}
      >
        <Text style={styles.menuButtonText}>⚙️ Server Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  menuButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
  },
  menuButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
  },
});
```

---

## 7. Push Notifications

### 7.1 Notification Strategy

**Challenge:** Can't use Firebase/Google services with Tor for privacy

**Solution:** Local notifications triggered by Socket.IO events

**Library:** `react-native-push-notification`

```bash
npm install react-native-push-notification
npm install @react-native-community/push-notification-ios
```

### 7.2 Notification Service

```typescript
// packages/android/src/services/NotificationService.ts
import PushNotification from 'react-native-push-notification';
import { AppState } from 'react-native';

class NotificationService {
  constructor() {
    PushNotification.configure({
      onNotification: (notification) => {
        console.log('Notification:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    PushNotification.createChannel(
      {
        channelId: 'tor-chat-messages',
        channelName: 'Messages',
        channelDescription: 'New message notifications',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Channel created: ${created}`)
    );
  }

  showNewMessageNotification(message: any, roomName: string) {
    // Only show if app is in background
    if (AppState.currentState !== 'active') {
      PushNotification.localNotification({
        channelId: 'tor-chat-messages',
        title: roomName,
        message: `${message.sender.displayName}: ${message.content}`,
        userInfo: {
          type: 'new_message',
          roomId: message.roomId,
          messageId: message.id,
        },
        playSound: true,
        soundName: 'default',
      });
    }
  }

  showRoomInviteNotification(invite: any) {
    if (AppState.currentState !== 'active') {
      PushNotification.localNotification({
        channelId: 'tor-chat-messages',
        title: 'New Room Invite',
        message: `You've been invited to ${invite.roomName}`,
        userInfo: {
          type: 'room_invite',
          roomId: invite.roomId,
        },
        playSound: true,
        soundName: 'default',
      });
    }
  }

  cancelAll() {
    PushNotification.cancelAllLocalNotifications();
  }
}

export const notificationService = new NotificationService();
```

### 7.3 Socket Integration

```typescript
// packages/android/src/services/SocketService.ts (updated)
import { notificationService } from './NotificationService';

class SocketService {
  private setupListeners() {
    this.socket.on('newMessage', (message) => {
      // Update local state
      chatStore.addMessage(message);

      // Show notification
      const room = chatStore.getRoomById(message.roomId);
      if (room) {
        notificationService.showNewMessageNotification(message, room.name);
      }
    });

    this.socket.on('roomInvite', (invite) => {
      // Update local state
      chatStore.addRoomInvite(invite);

      // Show notification
      notificationService.showRoomInviteNotification(invite);
    });
  }
}
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Native Android setup, TOR integration, multi-server

- [ ] Initialize React Native Android project properly
- [ ] Set up Gradle build configuration
- [ ] Integrate IPtProxy or Tor-Android
- [ ] Implement TorService with bootstrap
- [ ] Create ServerStorage with AsyncStorage
- [ ] Build Server List UI
- [ ] Build Add Server UI
- [ ] Test Tor connectivity to .onion

**Deliverables:**
- Working Android build
- Tor connection established
- Can add and store multiple servers
- Can test connectivity to each server

### Phase 2: Authentication & Navigation (Week 3)

**Goal:** Login/Register with server selection, navigation structure

- [ ] Update Login screen with server selector
- [ ] Update Register screen with server selector
- [ ] Implement AuthStore with server context
- [ ] Set up React Navigation structure
- [ ] Create main tab navigation (Rooms, Profile, Admin)
- [ ] Implement secure token storage
- [ ] Test login flow with real .onion server

**Deliverables:**
- Complete auth flow with server selection
- Navigation structure
- Persistent sessions

### Phase 3: Chat Core (Week 4-5)

**Goal:** Full chat functionality

- [ ] Implement ChatStore (Zustand)
- [ ] Socket.IO integration with Tor
- [ ] E2E encryption (libsodium)
- [ ] Room List screen
- [ ] Chat Screen with messages
- [ ] MessageBubble component
- [ ] Text input with send
- [ ] Typing indicators
- [ ] Online status
- [ ] Message timestamps

**Deliverables:**
- Working chat interface
- Real-time messaging
- E2E encrypted messages

### Phase 4: Rich Features (Week 6)

**Goal:** Files, images, reactions

- [ ] File picker integration
- [ ] Image picker integration
- [ ] File upload to server
- [ ] Image viewer
- [ ] File download
- [ ] Message reactions
- [ ] Link previews
- [ ] YouTube embeds

**Deliverables:**
- Full media support
- Rich message features

### Phase 5: Admin Panel (Week 7)

**Goal:** Complete admin functionality

- [ ] Admin home screen with stats
- [ ] User management screen
- [ ] Room management screen
- [ ] Admin actions (delete user, delete room, toggle admin)
- [ ] Server settings (if admin)

**Deliverables:**
- Full admin panel
- All admin features from webapp

### Phase 6: Notifications & Polish (Week 8)

**Goal:** Notifications, testing, polish

- [ ] Push notification setup
- [ ] Socket event → notification
- [ ] Notification tapping → navigate to room
- [ ] Background service for notifications
- [ ] App icon and splash screen
- [ ] UI polish and animations
- [ ] Error handling
- [ ] Offline support
- [ ] Testing on real devices

**Deliverables:**
- Push notifications working
- Polished, production-ready app

---

## 9. Technical Architecture

### 9.1 App Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                         │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (Screens & Components)                            │
│  ├── Auth Screens (Login, Register, Server Selection)       │
│  ├── Chat Screens (Room List, Chat, Room Settings)          │
│  ├── Admin Screens (Dashboard, Users, Rooms)                │
│  └── Profile Screens (Profile, Settings)                    │
├─────────────────────────────────────────────────────────────┤
│  State Management (Zustand)                                 │
│  ├── AuthStore (user, token, login, logout)                 │
│  ├── ChatStore (rooms, messages, send, receive)             │
│  ├── ServerStore (servers, active server, switch)           │
│  └── AdminStore (stats, users, rooms)                       │
├─────────────────────────────────────────────────────────────┤
│  Services Layer                                             │
│  ├── TorService (start, stop, bootstrap, circuits)          │
│  ├── ApiService (HTTP requests via Tor)                     │
│  ├── SocketService (WebSocket via Tor)                      │
│  ├── CryptoService (E2E encryption/decryption)              │
│  ├── NotificationService (local notifications)              │
│  └── ServerStorage (AsyncStorage for servers)               │
├─────────────────────────────────────────────────────────────┤
│  Native Modules                                             │
│  ├── IPtProxy (Tor integration)                             │
│  ├── React Native Sodium (crypto)                           │
│  └── Push Notification (local notifications)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    TOR Network (SOCKS5)
                            ↓
               Backend Server (.onion address)
```

### 9.2 Data Flow

**Message Send:**
```
User types → ChatScreen → ChatStore.sendMessage()
   ↓
CryptoService.encrypt(message, roomKey)
   ↓
SocketService.emit('send_message', encryptedMessage)
   ↓
TorService (SOCKS5 proxy)
   ↓
Backend Server (.onion)
   ↓
Broadcast to room members
```

**Message Receive:**
```
Backend Server → Socket.IO event
   ↓
TorService (receive via SOCKS5)
   ↓
SocketService.on('newMessage', encryptedMessage)
   ↓
CryptoService.decrypt(encryptedMessage, roomKey)
   ↓
ChatStore.addMessage(decryptedMessage)
   ↓
NotificationService.show() (if background)
   ↓
UI updates (re-render)
```

---

## 10. Dependencies & Libraries

### 10.1 Required npm Packages

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",

    // Navigation
    "@react-navigation/native": "^7.1.19",
    "@react-navigation/native-stack": "^7.6.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "react-native-screens": "^4.4.0",
    "react-native-safe-area-context": "^4.8.2",

    // State & Storage
    "zustand": "^4.5.7",
    "@react-native-async-storage/async-storage": "^1.21.0",

    // Networking
    "socket.io-client": "^4.7.2",
    "axios": "^1.6.2",

    // TOR Integration
    "react-native-iptproxy": "^1.0.0", // Or custom native module

    // Crypto
    "react-native-sodium": "^0.3.9",

    // UI & Media
    "react-native-toast-message": "^2.2.0",
    "react-native-document-picker": "^9.1.0",
    "react-native-image-picker": "^7.1.0",
    "react-native-fast-image": "^8.6.3",
    "react-native-video": "^6.0.0",

    // Notifications
    "react-native-push-notification": "^8.1.1",
    "@react-native-community/push-notification-ios": "^1.11.0",

    // Permissions
    "react-native-permissions": "^4.0.0",

    // Utils
    "date-fns": "^3.6.0",
    "react-native-vector-icons": "^10.0.3"
  }
}
```

### 10.2 Native Dependencies (build.gradle)

```gradle
// android/app/build.gradle
dependencies {
    implementation 'com.facebook.react:react-native:+'

    // Tor integration (if using custom module)
    implementation 'info.guardianproject:tor-android:0.4.8.9'
    implementation 'info.guardianproject:jtorctl:0.4.5.7'

    // Image loading
    implementation 'com.github.bumptech.glide:glide:4.16.0'

    // Crypto
    implementation 'com.goterl:lazysodium-android:5.1.4@aar'
    implementation 'net.java.dev.jna:jna:5.13.0@aar'
}
```

---

## 11. Testing Strategy

### 11.1 Testing Phases

**Phase 1: Unit Testing**
- TorService connection/bootstrap
- CryptoService encrypt/decrypt
- ServerStorage CRUD operations
- Message serialization

**Phase 2: Integration Testing**
- Login flow end-to-end
- Message send/receive cycle
- File upload/download
- Notification triggers

**Phase 3: Device Testing**
- Test on Android 8+ devices
- Test on emulator (x86, ARM)
- Test Tor connectivity on real network
- Test different .onion servers
- Test multi-server switching

**Phase 4: Security Testing**
- Verify E2E encryption
- Check for data leaks
- Test circuit isolation
- Verify no plaintext storage

### 11.2 Test Cases

1. **TOR Connectivity**
   - [ ] Tor starts successfully
   - [ ] Bootstrap reaches 100%
   - [ ] Can connect to .onion address
   - [ ] Circuit information available
   - [ ] Handle connection failures

2. **Server Management**
   - [ ] Add server with valid .onion
   - [ ] Reject invalid .onion
   - [ ] Switch between servers
   - [ ] Delete server
   - [ ] Persist servers across restarts

3. **Authentication**
   - [ ] Login with correct credentials
   - [ ] Reject incorrect credentials
   - [ ] Register new account
   - [ ] Token persists after restart
   - [ ] Logout clears session

4. **Chat Functionality**
   - [ ] Load room list
   - [ ] Open room and load messages
   - [ ] Send text message
   - [ ] Receive text message in real-time
   - [ ] Messages decrypt correctly
   - [ ] Typing indicators work
   - [ ] Online status updates

5. **Media Sharing**
   - [ ] Pick and send image
   - [ ] Pick and send document
   - [ ] Download received file
   - [ ] View image in fullscreen
   - [ ] Handle large files

6. **Admin Features**
   - [ ] Admin panel visible only to admins
   - [ ] View server statistics
   - [ ] Manage users (delete, toggle admin)
   - [ ] Manage rooms (view, delete)

7. **Notifications**
   - [ ] Receive notification when message arrives (app in background)
   - [ ] Receive notification on room invite
   - [ ] Tap notification navigates to room
   - [ ] No notification when app is active

---

## Implementation Notes

### Critical Considerations

1. **APK Size**: With Tor binary, APK will be ~40-50MB
2. **Battery Usage**: Tor circuits consume battery, optimize polling
3. **Initial Load**: First Tor bootstrap takes 15-30 seconds
4. **Latency**: Expect 5-15 second delays for Tor requests
5. **Data Usage**: Tor uses more data than direct connections

### Security Best Practices

1. **Never store plaintext passwords**
2. **Always verify .onion addresses**
3. **Use circuit isolation per server**
4. **Clear sensitive data on logout**
5. **Implement proper key management**
6. **Validate all server responses**

### Performance Optimizations

1. **Cache room lists locally**
2. **Lazy load messages (paginated)**
3. **Compress images before upload**
4. **Use fast-image for image caching**
5. **Debounce typing indicators**
6. **Connection pooling for Tor**

---

## Next Steps

1. **Review this plan** with the team
2. **Set up Android development environment**
3. **Initialize React Native Android project**
4. **Begin Phase 1: Foundation**
5. **Parallel work streams**:
   - Developer 1: TOR integration
   - Developer 2: UI screens
   - Developer 3: State management & services
   - DevOps: Build configuration & CI/CD

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Status**: Ready for Implementation
**Estimated Timeline**: 6-8 weeks
**Team Size**: 3-4 developers + 1 devops
