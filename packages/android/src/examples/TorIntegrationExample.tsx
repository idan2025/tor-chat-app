/**
 * TOR Integration Example
 *
 * This file demonstrates how to integrate the TOR service into your
 * React Native Android app. It shows complete examples of:
 * - Setting up TorProvider
 * - Using the useTor hook
 * - Making HTTP requests through TOR
 * - Creating WebSocket connections
 * - Displaying TOR status
 * - Handling errors
 *
 * Copy and adapt these examples to your actual screens and components.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTor } from '../contexts/TorContext';
import { TorStatus } from '../components/TorStatus';
import {
  createHttpClient,
  createWebSocketClient,
  validateOnionAddress,
  testConnection
} from '../utils/network';
import { Socket } from 'socket.io-client';

// ============================================================================
// Example 1: App Root with TorProvider
// ============================================================================

/**
 * Wrap your entire app with TorProvider to enable TOR throughout
 */
export function AppWithTor() {
  return (
    <TorProvider autoStart={true}>
      <ExampleNavigator />
    </TorProvider>
  );
}

// Mock navigator - replace with your actual navigation
function ExampleNavigator() {
  const [screen, setScreen] = useState<'loading' | 'main'>('loading');
  const { isReady, isBootstrapping } = useTor();

  useEffect(() => {
    if (isReady) {
      setScreen('main');
    }
  }, [isReady]);

  if (screen === 'loading' || isBootstrapping) {
    return <LoadingWithTorScreen />;
  }

  return <MainScreen />;
}

// ============================================================================
// Example 2: Loading Screen with TOR Bootstrap
// ============================================================================

/**
 * Show TOR bootstrap progress while loading
 */
function LoadingWithTorScreen() {
  const {
    isBootstrapping,
    isReady,
    bootstrapProgress,
    bootstrapStatus,
    error,
    start,
    restart
  } = useTor();

  useEffect(() => {
    // Start TOR if not already started
    if (!isReady && !isBootstrapping) {
      start();
    }
  }, [isReady, isBootstrapping, start]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TOR Chat</Text>

      <TorStatus compact={false} showCircuits={false} />

      {isBootstrapping && (
        <View style={styles.section}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={styles.statusText}>
            {bootstrapStatus?.summary || 'Connecting to TOR network...'}
          </Text>
          <Text style={styles.progressText}>
            {bootstrapProgress}% complete
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.section}>
          <Text style={styles.errorText}>
            Failed to connect to TOR
          </Text>
          <TouchableOpacity style={styles.button} onPress={restart}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isReady && (
        <View style={styles.section}>
          <Text style={styles.successText}>
            ✓ Connected to TOR network
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Example 3: HTTP Requests Through TOR
// ============================================================================

/**
 * Make HTTP API requests through TOR
 */
function HttpRequestExample() {
  const { getSocksProxy, isReady } = useTor();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isReady) {
      Alert.alert('Error', 'TOR is not ready yet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create HTTP client with SOCKS proxy
      const client = createHttpClient({
        baseURL: 'http://your-server.onion',
        socksProxy: getSocksProxy(),
        timeout: 60000
      });

      // Make request
      const response = await client.get('/api/data');
      setData(response.data);

    } catch (err: any) {
      console.error('Request failed:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>HTTP Request Example</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={fetchData}
        disabled={!isReady || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Loading...' : 'Fetch Data'}
        </Text>
      </TouchableOpacity>

      {data && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

// ============================================================================
// Example 4: WebSocket Connection Through TOR
// ============================================================================

/**
 * Create WebSocket connection through TOR
 */
function WebSocketExample() {
  const { getSocksProxy, isReady } = useTor();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    if (!isReady) return;

    // Create WebSocket client
    const newSocket = createWebSocketClient({
      url: 'http://your-server.onion',
      auth: { token: 'your-auth-token' },
      socksProxy: getSocksProxy()
    });

    // Listen for messages
    newSocket.on('message', (data: any) => {
      setMessages(prev => [...prev, JSON.stringify(data)]);
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected!');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, [isReady, getSocksProxy]);

  const sendMessage = () => {
    if (socket && inputMessage.trim()) {
      socket.emit('message', { text: inputMessage });
      setInputMessage('');
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WebSocket Example</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={inputMessage}
          onChangeText={setInputMessage}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={!socket}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.messageList}>
        {messages.map((msg, index) => (
          <Text key={index} style={styles.messageText}>
            {msg}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Example 5: Server Connection Test
// ============================================================================

/**
 * Test connection to a .onion server
 */
function ServerTestExample() {
  const { getSocksProxy, isReady } = useTor();
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const testServer = async () => {
    // Validate onion address
    if (!validateOnionAddress(serverUrl)) {
      Alert.alert('Invalid Address', 'Please enter a valid .onion address');
      return;
    }

    if (!isReady) {
      Alert.alert('Error', 'TOR is not ready yet');
      return;
    }

    setTesting(true);
    setResult(null);

    const testResult = await testConnection(
      `http://${serverUrl}`,
      getSocksProxy(),
      30000
    );

    setResult(testResult);
    setTesting(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Server Connection Test</Text>

      <TextInput
        style={styles.input}
        placeholder="example.onion"
        placeholderTextColor="#999"
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={testServer}
        disabled={!isReady || testing || !serverUrl}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Text>
      </TouchableOpacity>

      {result && (
        <View
          style={[
            styles.resultBox,
            { backgroundColor: result.success ? '#1a3a2a' : '#3a1f1f' }
          ]}
        >
          <Text
            style={[
              styles.resultText,
              { color: result.success ? '#10b981' : '#ef4444' }
            ]}
          >
            {result.success
              ? '✓ Connection successful!'
              : `✗ Connection failed: ${result.error}`
            }
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Example 6: Main Screen with All Examples
// ============================================================================

/**
 * Main screen demonstrating all TOR features
 */
function MainScreen() {
  const { isReady, circuits, newCircuit } = useTor();
  const [activeExample, setActiveExample] = useState<string | null>(null);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>TOR Integration Examples</Text>

      {/* TOR Status */}
      <TorStatus showCircuits={true} compact={false} />

      {/* Circuit Controls */}
      {isReady && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Active Circuits: {circuits.length}
          </Text>
          <TouchableOpacity style={styles.button} onPress={newCircuit}>
            <Text style={styles.buttonText}>Request New Circuit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Example Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Examples</Text>

        <TouchableOpacity
          style={styles.exampleButton}
          onPress={() => setActiveExample('http')}
        >
          <Text style={styles.buttonText}>HTTP Request Example</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exampleButton}
          onPress={() => setActiveExample('websocket')}
        >
          <Text style={styles.buttonText}>WebSocket Example</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exampleButton}
          onPress={() => setActiveExample('test')}
        >
          <Text style={styles.buttonText}>Server Test Example</Text>
        </TouchableOpacity>
      </View>

      {/* Active Example */}
      {activeExample === 'http' && <HttpRequestExample />}
      {activeExample === 'websocket' && <WebSocketExample />}
      {activeExample === 'test' && <ServerTestExample />}
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center'
  },
  section: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#2d2d44',
    borderRadius: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
  },
  statusText: {
    color: '#e5e5e5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12
  },
  progressText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8
  },
  successText: {
    color: '#10b981',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8
  },
  exampleButton: {
    backgroundColor: '#4a3a5a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8
  },
  sendButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 14,
    marginLeft: 8
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 8
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  resultBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginTop: 12
  },
  resultText: {
    color: '#e5e5e5',
    fontSize: 12,
    fontFamily: 'monospace'
  },
  messageList: {
    maxHeight: 200,
    marginTop: 12
  },
  messageText: {
    color: '#e5e5e5',
    fontSize: 12,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 4
  }
});

// ============================================================================
// Export Examples
// ============================================================================

export {
  AppWithTor,
  LoadingWithTorScreen,
  HttpRequestExample,
  WebSocketExample,
  ServerTestExample,
  MainScreen
};

export default MainScreen;
