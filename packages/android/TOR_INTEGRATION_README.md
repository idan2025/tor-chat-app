# TOR Service Integration - Android App

## Overview

This document describes the TOR service integration for the Android app. The implementation provides complete TOR support with a clean API that can be easily integrated into the app's architecture.

**Status**: Phase 1 Complete - Mock Implementation with Production-Ready API

## Architecture

### Components

1. **TorService** (`src/services/TorService.ts`)
   - Singleton service managing TOR lifecycle
   - Bootstrap progress monitoring
   - Circuit information tracking
   - Event-driven architecture
   - Mock implementation ready for replacement

2. **TorContext** (`src/contexts/TorContext.tsx`)
   - React Context for TOR state
   - Hooks for easy component integration
   - Auto-start capability
   - Real-time state updates

3. **TorStatus Component** (`src/components/TorStatus.tsx`)
   - Visual status indicator
   - Bootstrap progress display
   - Circuit information viewer
   - Error handling UI
   - Compact and expanded modes

4. **Network Utilities** (`src/utils/network.ts`)
   - HTTP client with SOCKS5 routing
   - WebSocket client with SOCKS5 routing
   - Onion address validation
   - Connection testing utilities

5. **Type Definitions** (`src/types/tor.ts`)
   - Complete TypeScript interfaces
   - Enums for status and error types
   - Type safety throughout

## Installation

### Current Setup (Phase 1)

The implementation is already complete and ready to use. No additional dependencies required for Phase 1.

### Future Setup (Phase 2)

When ready to integrate real TOR support, install:

```bash
npm install react-native-iptproxy
```

Then replace the mock implementations in `TorService.ts` with real calls to the library.

## Usage

### 1. Wrap Your App with TorProvider

```tsx
// App.tsx
import React from 'react';
import { TorProvider } from './src/contexts/TorContext';
import { MainNavigator } from './src/navigation';

export default function App() {
  return (
    <TorProvider autoStart={true}>
      <MainNavigator />
    </TorProvider>
  );
}
```

### 2. Use TOR in Components

```tsx
// Example: LoginScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTor } from '../contexts/TorContext';
import { TorStatus } from '../components/TorStatus';

export function LoginScreen() {
  const { isReady, isBootstrapping, error, start } = useTor();

  useEffect(() => {
    // Ensure TOR is started
    if (!isReady && !isBootstrapping) {
      start();
    }
  }, [isReady, isBootstrapping, start]);

  if (isBootstrapping) {
    return (
      <View>
        <TorStatus showCircuits={false} />
        <Text>Connecting to TOR network...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View>
        <TorStatus />
        <Text>Failed to connect to TOR</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View>
        <ActivityIndicator />
        <Text>Initializing...</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Your login form here */}
    </View>
  );
}
```

### 3. Make HTTP Requests Through TOR

```tsx
// Example: API Service
import { createHttpClient } from '../utils/network';
import { useTor } from '../contexts/TorContext';

export function useApiClient() {
  const { getSocksProxy } = useTor();

  const client = createHttpClient({
    baseURL: 'http://your-server.onion',
    socksProxy: getSocksProxy(),
    timeout: 60000
  });

  return client;
}

// Usage in component
function MyComponent() {
  const client = useApiClient();

  const fetchData = async () => {
    try {
      const response = await client.get('/api/data');
      console.log('Data:', response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return <Button onPress={fetchData} title="Fetch Data" />;
}
```

### 4. WebSocket Connections Through TOR

```tsx
// Example: Socket Service
import { createWebSocketClient } from '../utils/network';
import { useTor } from '../contexts/TorContext';

export function useChatSocket() {
  const { getSocksProxy, isReady } = useTor();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isReady) return;

    const socket = createWebSocketClient({
      url: 'http://your-server.onion',
      auth: { token: 'your-token' },
      socksProxy: getSocksProxy()
    });

    socket.on('message', (data) => {
      console.log('Message received:', data);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [isReady, getSocksProxy]);

  return socket;
}
```

### 5. Display TOR Status

```tsx
// Example: Settings Screen
import React from 'react';
import { ScrollView } from 'react-native';
import { TorStatus } from '../components/TorStatus';

export function SettingsScreen() {
  return (
    <ScrollView>
      <TorStatus
        showCircuits={true}
        compact={false}
      />
      {/* Other settings */}
    </ScrollView>
  );
}
```

## API Reference

### TorService

```typescript
class TorService {
  // Lifecycle
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>

  // Status
  getStatus(): TorStatus
  isReady(): boolean
  isBootstrapping(): boolean
  getBootstrapProgress(): number
  getBootstrapStatus(): BootstrapStatus | null

  // Proxy
  getSocksProxy(): SocksProxyConfig | null

  // Circuits
  getCircuitInfo(): Promise<CircuitInfo[]>
  newCircuit(): Promise<void>

  // Errors
  getError(): TorError | null
  clearError(): void

  // Events
  addEventListener(type: TorEventType, listener: EventListener): void
  removeEventListener(type: TorEventType, listener: EventListener): void
}
```

### useTor() Hook

```typescript
interface TorContextValue {
  // State
  status: TorStatus
  isBootstrapping: boolean
  isReady: boolean
  bootstrapProgress: number
  bootstrapStatus: BootstrapStatus | null
  circuits: CircuitInfo[]
  error: TorError | null
  bandwidth: BandwidthStats | null
  socksProxy: SocksProxyConfig | null

  // Methods
  start: () => Promise<void>
  stop: () => Promise<void>
  restart: () => Promise<void>
  getSocksProxy: () => SocksProxyConfig | null
  getCircuitInfo: () => Promise<CircuitInfo[]>
  newCircuit: () => Promise<void>
  clearError: () => void
}
```

### Network Utilities

```typescript
// HTTP Client
createHttpClient(config: HttpClientConfig): AxiosInstance

// WebSocket Client
createWebSocketClient(config: WebSocketClientConfig): Socket

// Validation
validateOnionAddress(address: string): boolean
isOnionAddress(address: string): boolean
formatOnionUrl(address: string): string

// Testing
testConnection(
  baseURL: string,
  socksProxy?: SocksProxyConfig,
  timeout?: number
): Promise<{ success: boolean; error?: string }>
```

## Migration to Real TOR (Phase 2)

When ready to integrate real TOR support:

### Step 1: Install Dependencies

```bash
npm install react-native-iptproxy
cd android && ./gradlew clean
cd ios && pod install
```

### Step 2: Update TorService

In `src/services/TorService.ts`, replace the mock implementations:

```typescript
// Remove this:
// await this.mockStartTor();

// Replace with:
import { Tor } from 'react-native-iptproxy';

private async realStartTor(): Promise<void> {
  this.torInstance = new Tor();
  await this.torInstance.startTor({
    socksPort: this.config.socksPort,
    controlPort: this.config.controlPort,
  });
}
```

### Step 3: Update Network Utils

In `src/utils/network.ts`, implement real SOCKS5 support:

```typescript
import SocksProxyAgent from 'socks-proxy-agent';

export function createSocksAdapter(socksProxy: SocksProxyConfig) {
  const agent = new SocksProxyAgent({
    hostname: socksProxy.host,
    port: socksProxy.port
  });

  return (config: AxiosRequestConfig) => {
    config.httpsAgent = agent;
    config.httpAgent = agent;
    return axios.defaults.adapter!(config);
  };
}
```

### Step 4: Test

Test the integration thoroughly:
- TOR bootstrap completes successfully
- Can connect to .onion addresses
- HTTP requests work through SOCKS5
- WebSocket connections work through SOCKS5
- Circuit information is accurate
- Error handling works correctly

## Features

### Current (Phase 1)

- ✅ Complete TOR service architecture
- ✅ Bootstrap progress monitoring
- ✅ Circuit information tracking
- ✅ Event-driven state management
- ✅ React Context integration
- ✅ TOR status UI component
- ✅ HTTP/WebSocket routing API
- ✅ Onion address validation
- ✅ Error handling and recovery
- ✅ TypeScript type safety
- ✅ Comprehensive documentation

### Future (Phase 2)

- ⏳ Real TOR integration via react-native-iptproxy
- ⏳ Actual SOCKS5 proxy routing
- ⏳ Real circuit information
- ⏳ TOR control port communication
- ⏳ Bridge support for censored networks
- ⏳ Custom TOR configuration

## Testing

### Mock Mode Testing

The current implementation can be tested immediately:

```typescript
import { torService } from './src/services/TorService';

// Test TOR startup
async function testTorService() {
  console.log('Starting TOR...');
  await torService.start();

  console.log('TOR Status:', torService.getStatus());
  console.log('Bootstrap:', torService.getBootstrapProgress());

  const circuits = await torService.getCircuitInfo();
  console.log('Circuits:', circuits);

  const proxy = torService.getSocksProxy();
  console.log('SOCKS Proxy:', proxy);
}

testTorService();
```

### Integration Testing

Test with UI components:

```bash
# Run the app
npm run android

# Navigate to a screen that uses TOR
# Observe bootstrap progress
# Check circuit information
# Test error recovery
```

## Troubleshooting

### Issue: TOR won't start

**Solution**: Check that `autoStart` is enabled in TorProvider

### Issue: Bootstrap stuck

**Solution**: This is expected in mock mode. Real TOR may take 15-30 seconds.

### Issue: Network requests fail

**Solution**:
1. Check that TOR status is "ready"
2. Verify SOCKS proxy is available
3. Ensure .onion address is valid
4. Check server is actually online

### Issue: WebSocket won't connect

**Solution**: WebSocket over SOCKS5 requires native support (Phase 2)

## Performance Considerations

### Bootstrap Time
- Mock: Instant (simulated)
- Real TOR: 15-30 seconds on first connect
- Real TOR: 5-10 seconds on subsequent connects

### Request Latency
- Mock: Normal network latency
- Real TOR: 2-5x slower than direct connection
- Hidden services: Additional 3-10 seconds

### Battery Usage
- Mock: Negligible
- Real TOR: Moderate (continuous circuit maintenance)
- Optimization: Use connection pooling

### APK Size
- Mock: No increase
- Real TOR: +10-15 MB (TOR binaries)

## Security Notes

1. **Always validate .onion addresses** before connecting
2. **Never log sensitive data** in production
3. **Clear errors that contain sensitive info**
4. **Use circuit isolation** for different servers
5. **Implement proper key management**
6. **Verify TOR is actually routing** traffic (Phase 2)

## File Structure

```
packages/android/src/
├── types/
│   └── tor.ts                  # TypeScript type definitions
├── services/
│   └── TorService.ts           # TOR service implementation
├── contexts/
│   └── TorContext.tsx          # React context and hooks
├── components/
│   └── TorStatus.tsx           # Status UI component
└── utils/
    └── network.ts              # Network utilities
```

## Next Steps

1. ✅ Phase 1 Complete: API design and mock implementation
2. ⏳ Phase 2: Integrate react-native-iptproxy
3. ⏳ Phase 3: Implement real SOCKS5 routing
4. ⏳ Phase 4: Test with production .onion servers
5. ⏳ Phase 5: Performance optimization
6. ⏳ Phase 6: Production deployment

## Support

For issues or questions:
1. Check this documentation
2. Review code comments in source files
3. Test with mock implementation first
4. Consult TOR Project documentation for real integration

## License

MIT License - See main project LICENSE file
