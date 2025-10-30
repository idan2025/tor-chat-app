/**
 * Network Utilities
 *
 * Utilities for routing HTTP and WebSocket connections through TOR's
 * SOCKS5 proxy. Provides adapters for axios and Socket.IO to enable
 * anonymous connections to .onion hidden services.
 *
 * NOTE: SOCKS5 proxy support in React Native requires native modules
 * or platform-specific configuration. This implementation provides
 * the API structure with placeholders for actual SOCKS5 integration.
 *
 * Integration Strategy:
 * - Phase 1: Mock implementation with proper API design
 * - Phase 2: Integrate with react-native-tcp-socket or similar for SOCKS5
 * - Phase 3: Native module for optimized SOCKS5 support
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { SocksProxyConfig } from '../types/tor';

/**
 * HTTP Client Configuration
 */
export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  socksProxy?: SocksProxyConfig;
}

/**
 * WebSocket Client Configuration
 */
export interface WebSocketClientConfig {
  url: string;
  auth?: any;
  socksProxy?: SocksProxyConfig;
  transports?: string[];
  timeout?: number;
}

/**
 * Create SOCKS5 Adapter for Axios
 *
 * Creates an axios adapter that routes requests through a SOCKS5 proxy.
 * This enables HTTP requests to .onion addresses through TOR.
 *
 * TODO: Implement actual SOCKS5 proxy support using:
 * - Option 1: socks-proxy-agent (Node.js only)
 * - Option 2: react-native-tcp-socket with SOCKS5 implementation
 * - Option 3: Native module for SOCKS5 support
 *
 * @param socksProxy SOCKS5 proxy configuration
 * @returns Axios adapter function
 */
export function createSocksAdapter(socksProxy: SocksProxyConfig) {
  console.log('[Network] Creating SOCKS5 adapter for axios');
  console.log('[Network] SOCKS5 proxy:', socksProxy);

  // TODO: Replace with actual SOCKS5 implementation
  // For now, return a pass-through adapter with warning

  return (config: AxiosRequestConfig) => {
    console.warn(
      '[Network] SOCKS5 adapter is currently a mock implementation. ' +
      'Real SOCKS5 support requires native module integration.'
    );

    // Use default adapter as fallback
    // In production, this would route through SOCKS5 proxy
    const defaultAdapter = axios.defaults.adapter;
    if (typeof defaultAdapter === 'function') {
      return defaultAdapter(config);
    }

    return Promise.reject(new Error('No adapter available'));
  };
}

/**
 * Create HTTP Client
 *
 * Creates an axios instance configured to route requests through TOR
 * if a SOCKS proxy is provided.
 *
 * @param config HTTP client configuration
 * @returns Configured axios instance
 *
 * @example
 * ```typescript
 * const socksProxy = torService.getSocksProxy();
 * const client = createHttpClient({
 *   baseURL: 'http://example.onion',
 *   socksProxy,
 *   timeout: 60000
 * });
 *
 * const response = await client.get('/api/health');
 * ```
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const axiosConfig: AxiosRequestConfig = {
    baseURL: config.baseURL,
    timeout: config.timeout || 60000, // TOR connections are slow
    headers: {
      'Content-Type': 'application/json',
      ...config.headers
    }
  };

  // Add SOCKS5 adapter if proxy is configured
  if (config.socksProxy) {
    console.log('[Network] Configuring HTTP client with SOCKS5 proxy');
    axiosConfig.adapter = createSocksAdapter(config.socksProxy);
  }

  const client = axios.create(axiosConfig);

  // Add request interceptor for logging
  client.interceptors.request.use(
    (request) => {
      console.log('[Network] HTTP Request:', {
        method: request.method?.toUpperCase(),
        url: request.url,
        baseURL: request.baseURL,
        proxy: config.socksProxy ? 'SOCKS5' : 'Direct'
      });
      return request;
    },
    (error) => {
      console.error('[Network] HTTP Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for logging
  client.interceptors.response.use(
    (response) => {
      console.log('[Network] HTTP Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url
      });
      return response;
    },
    (error) => {
      console.error('[Network] HTTP Response Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url
      });
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Create SOCKS5 Agent for Socket.IO
 *
 * Creates an agent/transport configuration for Socket.IO to route
 * WebSocket connections through TOR's SOCKS5 proxy.
 *
 * TODO: Implement actual SOCKS5 support for WebSockets using:
 * - Option 1: Custom WebSocket transport with SOCKS5 proxy
 * - Option 2: react-native-tcp-socket for raw socket control
 * - Option 3: Native module for WebSocket over SOCKS5
 *
 * @param socksProxy SOCKS5 proxy configuration
 * @returns Agent configuration for Socket.IO
 */
export function createSocksAgent(socksProxy: SocksProxyConfig): any {
  console.log('[Network] Creating SOCKS5 agent for Socket.IO');
  console.log('[Network] SOCKS5 proxy:', socksProxy);

  // TODO: Replace with actual SOCKS5 implementation
  console.warn(
    '[Network] SOCKS5 agent is currently a mock implementation. ' +
    'Real SOCKS5 support for WebSockets requires native module integration.'
  );

  // Return placeholder configuration
  return {
    proxy: socksProxy,
    // In production, this would configure WebSocket to use SOCKS5
  };
}

/**
 * Create WebSocket Client
 *
 * Creates a Socket.IO client configured to route connections through TOR
 * if a SOCKS proxy is provided.
 *
 * @param config WebSocket client configuration
 * @returns Configured Socket.IO client
 *
 * @example
 * ```typescript
 * const socksProxy = torService.getSocksProxy();
 * const socket = createWebSocketClient({
 *   url: 'http://example.onion',
 *   auth: { token: 'your-token' },
 *   socksProxy
 * });
 *
 * socket.on('connect', () => {
 *   console.log('Connected to server via TOR');
 * });
 * ```
 */
export function createWebSocketClient(config: WebSocketClientConfig): Socket {
  const socketOptions: Partial<ManagerOptions & SocketOptions> = {
    auth: config.auth,
    transports: config.transports || ['websocket'],
    timeout: config.timeout || 60000,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 5
  };

  // Add SOCKS5 agent if proxy is configured
  if (config.socksProxy) {
    console.log('[Network] Configuring WebSocket client with SOCKS5 proxy');
    const agent = createSocksAgent(config.socksProxy);
    // @ts-ignore - agent property is not in types but supported
    socketOptions.agent = agent;
  }

  const socket = io(config.url, socketOptions);

  // Add event listeners for debugging
  socket.on('connect', () => {
    console.log('[Network] WebSocket connected:', {
      id: socket.id,
      url: config.url,
      proxy: config.socksProxy ? 'SOCKS5' : 'Direct'
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Network] WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Network] WebSocket connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Network] WebSocket reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Network] WebSocket reconnection attempt:', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('[Network] WebSocket reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('[Network] WebSocket reconnection failed');
  });

  return socket;
}

/**
 * Validate .onion Address
 *
 * Validates that a string is a properly formatted .onion address.
 * Supports both v2 (16 characters) and v3 (56 characters) addresses.
 *
 * @param address Address to validate
 * @returns True if valid .onion address
 *
 * @example
 * ```typescript
 * validateOnionAddress('example.onion') // false - too short
 * validateOnionAddress('abcdefghijklmnop.onion') // true - valid v2
 * validateOnionAddress('abcdefg...56chars...xyz.onion') // true - valid v3
 * ```
 */
export function validateOnionAddress(address: string): boolean {
  // Remove protocol if present
  const cleanAddress = address.replace(/^https?:\/\//, '');

  // v2 onion address: 16 characters + .onion
  const v2Regex = /^[a-z2-7]{16}\.onion$/i;

  // v3 onion address: 56 characters + .onion
  const v3Regex = /^[a-z2-7]{56}\.onion$/i;

  return v2Regex.test(cleanAddress) || v3Regex.test(cleanAddress);
}

/**
 * Format Onion URL
 *
 * Formats an .onion address to a full URL with protocol.
 * TOR hidden services use HTTP (not HTTPS).
 *
 * @param address Onion address (with or without protocol)
 * @returns Full URL with http:// protocol
 *
 * @example
 * ```typescript
 * formatOnionUrl('example.onion')
 * // Returns: 'http://example.onion'
 *
 * formatOnionUrl('https://example.onion')
 * // Returns: 'http://example.onion'
 * ```
 */
export function formatOnionUrl(address: string): string {
  // Remove any existing protocol
  const cleanAddress = address.replace(/^https?:\/\//, '');

  // Add HTTP protocol (TOR uses HTTP)
  return `http://${cleanAddress}`;
}

/**
 * Check if Address is Onion
 *
 * Quick check if an address ends with .onion
 *
 * @param address Address to check
 * @returns True if address ends with .onion
 */
export function isOnionAddress(address: string): boolean {
  const cleanAddress = address.replace(/^https?:\/\//, '');
  return cleanAddress.endsWith('.onion');
}

/**
 * Network Error Handler
 *
 * Provides user-friendly error messages for common network errors
 * when using TOR.
 *
 * @param error Error object
 * @returns User-friendly error message
 */
export function getNetworkErrorMessage(error: any): string {
  if (error.code === 'ECONNABORTED') {
    return 'Connection timeout. TOR connections can be slow, please try again.';
  }

  if (error.code === 'ECONNREFUSED') {
    return 'Connection refused. The hidden service may be offline.';
  }

  if (error.code === 'ENOTFOUND') {
    return 'Hidden service not found. Check the .onion address.';
  }

  if (error.code === 'ETIMEDOUT') {
    return 'Connection timed out. Please check your TOR connection.';
  }

  if (error.message?.includes('proxy')) {
    return 'TOR proxy error. Please ensure TOR is running.';
  }

  if (error.message?.includes('SOCKS')) {
    return 'SOCKS proxy error. TOR connection may be unavailable.';
  }

  return error.message || 'Network error occurred';
}

/**
 * Test Connection
 *
 * Tests connectivity to a server through TOR.
 *
 * @param baseURL Server URL to test
 * @param socksProxy SOCKS5 proxy configuration
 * @param timeout Connection timeout in ms
 * @returns True if connection successful
 */
export async function testConnection(
  baseURL: string,
  socksProxy?: SocksProxyConfig,
  timeout: number = 30000
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createHttpClient({
      baseURL,
      socksProxy,
      timeout
    });

    // Try to connect to health endpoint
    const response = await client.get('/health', {
      timeout
    });

    return {
      success: response.status === 200
    };
  } catch (error: any) {
    return {
      success: false,
      error: getNetworkErrorMessage(error)
    };
  }
}

/**
 * Export all utilities
 */
export default {
  createHttpClient,
  createWebSocketClient,
  createSocksAdapter,
  createSocksAgent,
  validateOnionAddress,
  formatOnionUrl,
  isOnionAddress,
  getNetworkErrorMessage,
  testConnection
};
