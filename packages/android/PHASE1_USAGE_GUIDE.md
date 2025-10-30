# Phase 1: Multi-Server Management - Usage Guide

Quick reference for integrating the multi-server management system.

---

## 🚀 Quick Start

### 1. Import the Store

```typescript
import { useServerStore } from './src/store/serverStore';
```

### 2. Use in Components

```typescript
function MyComponent() {
  const {
    servers,           // All saved servers
    activeServer,      // Currently selected server
    isLoading,         // Loading state
    loadServers,       // Load from storage
    addServer,         // Add new server
    switchServer,      // Change active server
  } = useServerStore();

  useEffect(() => {
    loadServers(); // Load servers on mount
  }, []);

  return (
    <View>
      <Text>Active: {activeServer?.name}</Text>
      <Text>Total Servers: {servers.length}</Text>
    </View>
  );
}
```

---

## 📋 Common Use Cases

### Add a New Server

```typescript
import { useServerStore } from './src/store/serverStore';
import Toast from 'react-native-toast-message';

function AddServerExample() {
  const { addServer } = useServerStore();

  const handleAdd = async () => {
    try {
      const server = await addServer(
        'My Server',
        'example123456789.onion'
      );
      Toast.show({
        type: 'success',
        text1: 'Server Added',
        text2: `${server.name} is ready`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    }
  };

  return <Button onPress={handleAdd} title="Add Server" />;
}
```

### Switch Active Server

```typescript
function SwitchServerExample() {
  const { servers, switchServer } = useServerStore();

  const handleSwitch = async (serverId: string) => {
    try {
      await switchServer(serverId);
      // Navigate to login or chat based on server.token
    } catch (error) {
      console.error('Failed to switch:', error);
    }
  };

  return (
    <FlatList
      data={servers}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handleSwitch(item.id)}>
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
```

### Update Connection Status

```typescript
function TorServiceExample() {
  const { updateServerStatus } = useServerStore();

  const onBootstrapProgress = async (progress: number) => {
    await updateServerStatus(
      serverId,
      ConnectionStatus.BOOTSTRAPPING,
      undefined,
      progress
    );
  };

  const onConnected = async () => {
    await updateServerStatus(
      serverId,
      ConnectionStatus.CONNECTED
    );
  };

  const onError = async (error: string) => {
    await updateServerStatus(
      serverId,
      ConnectionStatus.ERROR,
      error
    );
  };
}
```

### Update Server Authentication

```typescript
function LoginExample() {
  const { activeServer, updateServerAuth } = useServerStore();

  const handleLogin = async (username: string, password: string) => {
    // Login API call...
    const { token, user } = await loginAPI(username, password);

    // Save auth to server
    if (activeServer) {
      await updateServerAuth(activeServer.id, token, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      });
    }
  };
}
```

### Delete Server

```typescript
function DeleteServerExample() {
  const { deleteServer } = useServerStore();

  const handleDelete = async (serverId: string) => {
    Alert.alert(
      'Delete Server',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteServer(serverId);
          },
        },
      ]
    );
  };
}
```

---

## 🎨 Using Components

### ServerCard Component

```typescript
import ServerCard from './src/components/ServerCard';

<ServerCard
  server={myServer}
  onPress={(server) => console.log('Selected:', server.name)}
  onDelete={(server) => console.log('Delete:', server.id)}
  showDeleteButton={true}
/>
```

### Navigation to Screens

```typescript
// Navigate to Server List
navigation.navigate('ServerList');

// Navigate to Add Server
navigation.navigate('AddServer');
```

---

## 🔧 Helper Functions

### Validate .onion Address

```typescript
import { validateOnionAddress } from './src/types/Server';

const isValid = validateOnionAddress('example123456789.onion'); // true
const isInvalid = validateOnionAddress('invalid.com'); // false
```

### Get Server Display Name

```typescript
import { getServerDisplayName } from './src/types/Server';

const name = getServerDisplayName(server);
// Returns server.name or first part of .onion address
```

### Get Connection Status Color

```typescript
import { getConnectionStatusColor } from './src/types/Server';

const color = getConnectionStatusColor(ConnectionStatus.CONNECTED);
// Returns '#10b981' (green)
```

### Get Connection Status Text

```typescript
import { getConnectionStatusText } from './src/types/Server';

const text = getConnectionStatusText(
  ConnectionStatus.BOOTSTRAPPING,
  75
);
// Returns 'Bootstrapping 75%'
```

---

## 📦 Direct Storage Access

If you need to access storage directly (outside of React components):

```typescript
import { serverStorage } from './src/services/ServerStorage';

// Get all servers
const servers = await serverStorage.getAllServers();

// Get active server
const active = await serverStorage.getActiveServer();

// Save server
await serverStorage.saveServer(myServer);

// Delete server
await serverStorage.deleteServer(serverId);
```

---

## 🔄 State Management Flow

```
Component
  ↓
useServerStore (Zustand)
  ↓
ServerStorage (Service Layer)
  ↓
AsyncStorage (Persistence)
```

All state changes automatically sync to AsyncStorage and trigger UI updates.

---

## 🧪 Testing Helpers

### Mock Server for Testing

```typescript
import { ConnectionStatus } from './src/types/Server';

const mockServer = {
  id: '1',
  name: 'Test Server',
  onionAddress: 'test123456789.onion',
  isActive: true,
  lastConnected: new Date(),
  connectionStatus: ConnectionStatus.CONNECTED,
};
```

### Clear All Data (for testing)

```typescript
import { serverStorage } from './src/services/ServerStorage';

await serverStorage.clearAllServers();
```

---

## 🎯 Integration Checklist

Before moving to Phase 2, ensure:

- [ ] ServerListScreen added to navigation
- [ ] AddServerScreen added to navigation
- [ ] LoadingScreen calls `loadServers()` on app start
- [ ] LoginScreen uses `activeServer` for API calls
- [ ] RegisterScreen uses `activeServer` for API calls
- [ ] AuthStore calls `updateServerAuth()` after login
- [ ] App handles case when no servers exist

---

## 📝 Example: Complete Integration

```typescript
// App.tsx - Navigation Setup
import ServerListScreen from './src/screens/ServerListScreen';
import AddServerScreen from './src/screens/AddServerScreen';

<Stack.Navigator>
  <Stack.Screen name="Loading" component={LoadingScreen} />
  <Stack.Screen name="ServerList" component={ServerListScreen} />
  <Stack.Screen name="AddServer" component={AddServerScreen} />
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="Chat" component={ChatScreen} />
</Stack.Navigator>
```

```typescript
// LoadingScreen.tsx - Check for Servers
import { useServerStore } from './store/serverStore';

function LoadingScreen({ navigation }) {
  const { loadServers, servers, activeServer } = useServerStore();

  useEffect(() => {
    async function init() {
      await loadServers();

      if (servers.length === 0) {
        // No servers, go to add server
        navigation.replace('AddServer');
      } else if (activeServer?.token) {
        // Has active server with auth
        navigation.replace('Chat');
      } else {
        // Has servers, need to login
        navigation.replace('Login');
      }
    }

    init();
  }, []);

  return <ActivityIndicator />;
}
```

```typescript
// LoginScreen.tsx - Use Active Server
import { useServerStore } from './store/serverStore';
import { useAuthStore } from './store/authStore';

function LoginScreen({ navigation }) {
  const { activeServer, updateServerAuth } = useServerStore();
  const { login } = useAuthStore();

  const handleLogin = async (username, password) => {
    if (!activeServer) {
      // No server selected, go to server list
      navigation.navigate('ServerList');
      return;
    }

    // Login with active server
    const result = await login(activeServer, username, password);

    // Save auth to server
    await updateServerAuth(
      activeServer.id,
      result.token,
      result.user
    );

    navigation.navigate('Chat');
  };
}
```

---

## 🚨 Error Handling

All functions throw errors that should be caught:

```typescript
try {
  await addServer(name, address);
} catch (error) {
  // Handle error
  if (error.message === 'Invalid .onion address format') {
    // Show validation error
  } else if (error.message === 'Server with this address already exists') {
    // Show duplicate error
  } else {
    // Generic error
  }
}
```

---

## 💡 Best Practices

1. **Always load servers on app start**
   ```typescript
   useEffect(() => {
     loadServers();
   }, []);
   ```

2. **Check for active server before actions**
   ```typescript
   if (!activeServer) {
     Toast.show({ type: 'error', text1: 'No server selected' });
     return;
   }
   ```

3. **Update connection status in real-time**
   ```typescript
   // Update as TOR bootstraps
   onBootstrap((progress) => {
     updateServerStatus(id, ConnectionStatus.BOOTSTRAPPING, undefined, progress);
   });
   ```

4. **Save auth tokens after login**
   ```typescript
   await updateServerAuth(serverId, token, user);
   ```

5. **Handle navigation based on server state**
   ```typescript
   if (server.token) {
     navigation.navigate('Chat');
   } else {
     navigation.navigate('Login');
   }
   ```

---

## 📚 TypeScript Types

All types are fully typed. Import from:

```typescript
import { Server, ConnectionStatus, User } from './src/types/Server';
```

TypeScript will provide autocomplete and type checking for all functions and properties.

---

**Ready to use!** For questions, see `/packages/android/src/` source files.
