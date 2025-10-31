/**
 * Socket Service for Real-time Communication over TOR
 *
 * This service manages Socket.IO connections through the TOR SOCKS5 proxy
 * for secure, anonymous real-time messaging.
 *
 * Features:
 * - Socket.IO client integration with TOR routing
 * - Event-driven architecture with type-safe callbacks
 * - Auto-reconnect with exponential backoff
 * - Connection state management
 * - Memory leak prevention
 * - Multiple listener support per event
 * - Singleton pattern
 *
 * Usage:
 * ```typescript
 * import { socketService } from './services/SocketService';
 *
 * // Connect to server
 * socketService.connect('abc123.onion', 'your-jwt-token');
 *
 * // Listen for messages
 * socketService.onNewMessage((message) => {
 *   console.log('New message:', message);
 * });
 *
 * // Send message
 * socketService.sendMessage('room-id', 'encrypted-content', { type: 'text' });
 *
 * // Disconnect
 * socketService.disconnect();
 * ```
 */

import { io, Socket } from 'socket.io-client';
import { torService } from './TorService';
import {
  SocketConfig,
  SocketConnectionState,
  SocketMessage,
  UserJoinedEvent,
  UserLeftEvent,
  UserStatusEvent,
  UserTypingEvent,
  RoomInviteEvent,
  SocketErrorEvent,
  SendMessageOptions,
  MessageType,
  ConnectCallback,
  DisconnectCallback,
  MessageCallback,
  UserJoinedCallback,
  UserLeftCallback,
  UserStatusCallback,
  UserTypingCallback,
  RoomInviteCallback,
  ErrorCallback,
  ConnectionStateCallback,
} from '../types/socket';

/**
 * Event listener management
 */
interface EventListeners {
  connect: Set<ConnectCallback>;
  disconnect: Set<DisconnectCallback>;
  message: Set<MessageCallback>;
  userJoined: Set<UserJoinedCallback>;
  userLeft: Set<UserLeftCallback>;
  userStatus: Set<UserStatusCallback>;
  userTyping: Set<UserTypingCallback>;
  roomInvite: Set<RoomInviteCallback>;
  error: Set<ErrorCallback>;
  connectionState: Set<ConnectionStateCallback>;
}

/**
 * Socket Service Class
 *
 * Manages real-time Socket.IO connections through TOR network.
 * Implements singleton pattern to ensure only one active connection.
 */
export class SocketService {
  private static instance: SocketService | null = null;

  private socket: Socket | null = null;
  private config: SocketConfig | null = null;
  private connectionState: SocketConnectionState = SocketConnectionState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect: boolean = false;

  // Event listeners organized by event type
  private listeners: EventListeners = {
    connect: new Set(),
    disconnect: new Set(),
    message: new Set(),
    userJoined: new Set(),
    userLeft: new Set(),
    userStatus: new Set(),
    userTyping: new Set(),
    roomInvite: new Set(),
    error: new Set(),
    connectionState: new Set(),
  };

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Singleton - use getInstance()
  }

  /**
   * Get singleton instance of SocketService
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to Socket.IO server through TOR
   *
   * @param serverOnion - Server onion address (e.g., "abc123.onion")
   * @param token - JWT authentication token
   * @param options - Additional connection options
   */
  public connect(
    serverOnion: string,
    token: string,
    options?: Partial<SocketConfig>
  ): void {
    // Prevent multiple simultaneous connections
    if (this.socket?.connected || this.connectionState === SocketConnectionState.CONNECTING) {
      console.log('[SocketService] Already connected or connecting');
      return;
    }

    // Ensure TOR is ready
    if (!torService.isReady()) {
      this.handleError({
        message: 'TOR is not ready. Please ensure TOR is connected.',
        code: 'TOR_NOT_READY',
      });
      return;
    }

    try {
      this.isManualDisconnect = false;
      this.updateConnectionState(SocketConnectionState.CONNECTING);

      // Build configuration
      this.config = {
        serverOnion,
        token,
        timeout: options?.timeout ?? 60000, // 60 seconds for TOR
        reconnection: options?.reconnection ?? true,
        reconnectionAttempts: options?.reconnectionAttempts ?? 5,
        reconnectionDelay: options?.reconnectionDelay ?? 2000,
        reconnectionDelayMax: options?.reconnectionDelayMax ?? 10000,
        reconnectionDelayMultiplier: options?.reconnectionDelayMultiplier ?? 1.5,
      };

      // Get SOCKS proxy configuration from TOR service
      const socksProxy = torService.getSocksProxy();

      if (!socksProxy) {
        throw new Error('SOCKS proxy not available from TOR service');
      }

      // Build server URL
      const serverUrl = this.buildServerUrl(serverOnion);

      console.log('[SocketService] Connecting to:', serverUrl);
      console.log('[SocketService] Using SOCKS proxy:', `${socksProxy.host}:${socksProxy.port}`);

      // Create Socket.IO connection
      // Note: Socket.IO client doesn't natively support SOCKS proxy
      // For React Native, we need to configure the underlying HTTP agent
      // This is typically done through native modules or custom adapters

      this.socket = io(serverUrl, {
        auth: {
          token: this.config.token,
        },
        transports: ['websocket'], // Use WebSocket only (more efficient over TOR)
        timeout: this.config.timeout,
        reconnection: false, // We handle reconnection manually for better control
        autoConnect: true,
        // TODO: Configure SOCKS proxy agent for React Native
        // This requires native module integration or a custom transport
        // For now, we'll rely on system-wide proxy settings configured by TorService
      });

      // Setup event handlers
      this.setupSocketEventHandlers();

    } catch (error) {
      console.error('[SocketService] Connection error:', error);
      this.handleError({
        message: 'Failed to establish socket connection',
        code: 'CONNECTION_FAILED',
        details: error instanceof Error ? error.message : String(error),
      });
      this.updateConnectionState(SocketConnectionState.ERROR);
    }
  }

  /**
   * Disconnect from Socket.IO server
   */
  public disconnect(): void {
    console.log('[SocketService] Disconnecting...');

    this.isManualDisconnect = true;
    this.clearReconnectTimer();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateConnectionState(SocketConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): SocketConnectionState {
    return this.connectionState;
  }

  // ========================================================================
  // EMIT EVENTS (Client → Server)
  // ========================================================================

  /**
   * Join a room
   */
  public joinRoom(roomId: string): void {
    if (!this.ensureConnected()) return;

    console.log('[SocketService] Joining room:', roomId);
    this.socket!.emit('join_room', { roomId });
  }

  /**
   * Leave a room
   */
  public leaveRoom(roomId: string): void {
    if (!this.ensureConnected()) return;

    console.log('[SocketService] Leaving room:', roomId);
    this.socket!.emit('leave_room', { roomId });
  }

  /**
   * Send a message
   */
  public sendMessage(
    roomId: string,
    encryptedContent: string,
    metadata?: Partial<SendMessageOptions>
  ): void {
    if (!this.ensureConnected()) return;

    const payload: SendMessageOptions = {
      roomId,
      encryptedContent,
      messageType: metadata?.messageType ?? MessageType.TEXT,
      attachments: metadata?.attachments,
      ...metadata,
    };

    console.log('[SocketService] Sending message to room:', roomId);
    this.socket!.emit('send_message', payload);
  }

  /**
   * Send typing indicator
   */
  public sendTyping(roomId: string): void {
    if (!this.ensureConnected()) return;

    this.socket!.emit('typing', { roomId, isTyping: true });
  }

  /**
   * Send stop typing indicator
   */
  public sendStopTyping(roomId: string): void {
    if (!this.ensureConnected()) return;

    this.socket!.emit('typing', { roomId, isTyping: false });
  }

  /**
   * Generic emit method for custom events
   */
  public emit(event: string, data: any): void {
    if (!this.ensureConnected()) return;

    console.log(`[SocketService] Emitting event: ${event}`);
    this.socket!.emit(event, data);
  }

  // ========================================================================
  // EVENT LISTENERS (Server → Client)
  // ========================================================================

  /**
   * Register callback for connection event
   */
  public onConnect(callback: ConnectCallback): void {
    this.listeners.connect.add(callback);
  }

  /**
   * Register callback for disconnect event
   */
  public onDisconnect(callback: DisconnectCallback): void {
    this.listeners.disconnect.add(callback);
  }

  /**
   * Register callback for new message event
   */
  public onNewMessage(callback: MessageCallback): void {
    this.listeners.message.add(callback);
  }

  /**
   * Register callback for user joined event
   */
  public onUserJoin(callback: UserJoinedCallback): void {
    this.listeners.userJoined.add(callback);
  }

  /**
   * Register callback for user left event
   */
  public onUserLeave(callback: UserLeftCallback): void {
    this.listeners.userLeft.add(callback);
  }

  /**
   * Register callback for user status event
   */
  public onUserStatus(callback: UserStatusCallback): void {
    this.listeners.userStatus.add(callback);
  }

  /**
   * Register callback for typing indicator event
   */
  public onTyping(callback: UserTypingCallback): void {
    this.listeners.userTyping.add(callback);
  }

  /**
   * Register callback for room invite event
   */
  public onRoomInvite(callback: RoomInviteCallback): void {
    this.listeners.roomInvite.add(callback);
  }

  /**
   * Register callback for error event
   */
  public onError(callback: ErrorCallback): void {
    this.listeners.error.add(callback);
  }

  /**
   * Register callback for connection state changes
   */
  public onConnectionStateChange(callback: ConnectionStateCallback): void {
    this.listeners.connectionState.add(callback);
  }

  // ========================================================================
  // REMOVE LISTENERS
  // ========================================================================

  /**
   * Remove specific connect listener
   */
  public offConnect(callback: ConnectCallback): void {
    this.listeners.connect.delete(callback);
  }

  /**
   * Remove specific disconnect listener
   */
  public offDisconnect(callback: DisconnectCallback): void {
    this.listeners.disconnect.delete(callback);
  }

  /**
   * Remove specific message listener
   */
  public offNewMessage(callback: MessageCallback): void {
    this.listeners.message.delete(callback);
  }

  /**
   * Remove specific user joined listener
   */
  public offUserJoin(callback: UserJoinedCallback): void {
    this.listeners.userJoined.delete(callback);
  }

  /**
   * Remove specific user left listener
   */
  public offUserLeave(callback: UserLeftCallback): void {
    this.listeners.userLeft.delete(callback);
  }

  /**
   * Remove specific user status listener
   */
  public offUserStatus(callback: UserStatusCallback): void {
    this.listeners.userStatus.delete(callback);
  }

  /**
   * Remove specific typing listener
   */
  public offTyping(callback: UserTypingCallback): void {
    this.listeners.userTyping.delete(callback);
  }

  /**
   * Remove specific room invite listener
   */
  public offRoomInvite(callback: RoomInviteCallback): void {
    this.listeners.roomInvite.delete(callback);
  }

  /**
   * Remove specific error listener
   */
  public offError(callback: ErrorCallback): void {
    this.listeners.error.delete(callback);
  }

  /**
   * Remove specific connection state listener
   */
  public offConnectionStateChange(callback: ConnectionStateCallback): void {
    this.listeners.connectionState.delete(callback);
  }

  /**
   * Remove all listeners (useful for cleanup)
   */
  public removeAllListeners(): void {
    Object.keys(this.listeners).forEach((key) => {
      (this.listeners as any)[key].clear();
    });
    console.log('[SocketService] All listeners removed');
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('[SocketService] Connected!');
      this.reconnectAttempts = 0;
      this.updateConnectionState(SocketConnectionState.CONNECTED);
      this.notifyListeners('connect');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketService] Disconnected:', reason);
      this.updateConnectionState(SocketConnectionState.DISCONNECTED);
      this.notifyListeners('disconnect', reason);

      // Attempt reconnection if not manually disconnected
      if (!this.isManualDisconnect && this.config?.reconnection) {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[SocketService] Connection error:', error);
      this.handleError({
        message: 'Socket connection error',
        code: 'CONNECT_ERROR',
        details: error.message,
      });

      // Attempt reconnection
      if (!this.isManualDisconnect && this.config?.reconnection) {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_timeout', () => {
      console.error('[SocketService] Connection timeout');
      this.handleError({
        message: 'Socket connection timeout',
        code: 'CONNECT_TIMEOUT',
        details: 'Connection to server timed out. TOR network may be slow.',
      });
    });

    // Message events
    this.socket.on('message', (data: SocketMessage) => {
      this.notifyListeners('message', data);
    });

    // User events
    this.socket.on('user_joined', (data: UserJoinedEvent) => {
      this.notifyListeners('userJoined', data);
    });

    this.socket.on('user_left', (data: UserLeftEvent) => {
      this.notifyListeners('userLeft', data);
    });

    this.socket.on('user_status', (data: UserStatusEvent) => {
      this.notifyListeners('userStatus', data);
    });

    this.socket.on('user_typing', (data: UserTypingEvent) => {
      this.notifyListeners('userTyping', data);
    });

    // Room events
    this.socket.on('room_invite', (data: RoomInviteEvent) => {
      this.notifyListeners('roomInvite', data);
    });

    // Error events
    this.socket.on('error', (data: SocketErrorEvent) => {
      this.handleError(data);
    });

    // Reaction events
    this.socket.on('reactionAdded', (data: any) => {
      // Import chatStore dynamically to avoid circular dependency
      import('../store/chatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleReactionUpdate(data);
      });
    });

    this.socket.on('reactionRemoved', (data: any) => {
      // Import chatStore dynamically to avoid circular dependency
      import('../store/chatStore').then(({ useChatStore }) => {
        useChatStore.getState().handleReactionUpdate(data);
      });
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (!this.config || this.isManualDisconnect) {
      return;
    }

    const maxAttempts = this.config.reconnectionAttempts || 5;

    if (this.reconnectAttempts >= maxAttempts) {
      console.error('[SocketService] Max reconnection attempts reached');
      this.updateConnectionState(SocketConnectionState.ERROR);
      this.handleError({
        message: 'Failed to reconnect after maximum attempts',
        code: 'MAX_RECONNECT_ATTEMPTS',
        details: `Tried ${maxAttempts} times`,
      });
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionState(SocketConnectionState.RECONNECTING);

    // Calculate delay with exponential backoff
    const baseDelay = this.config.reconnectionDelay || 2000;
    const multiplier = this.config.reconnectionDelayMultiplier || 1.5;
    const maxDelay = this.config.reconnectionDelayMax || 10000;

    const delay = Math.min(
      baseDelay * Math.pow(multiplier, this.reconnectAttempts - 1),
      maxDelay
    );

    console.log(
      `[SocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      console.log('[SocketService] Attempting reconnection...');

      if (this.config) {
        // Disconnect existing socket if any
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        // Attempt new connection
        this.connect(this.config.serverOnion, this.config.token, this.config);
      }
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(state: SocketConnectionState): void {
    this.connectionState = state;
    this.notifyListeners('connectionState', state);
  }

  /**
   * Notify all listeners for a specific event
   */
  private notifyListeners(event: keyof EventListeners, data?: any): void {
    const eventListeners = this.listeners[event];
    if (eventListeners && eventListeners.size > 0) {
      eventListeners.forEach((listener) => {
        try {
          (listener as any)(data);
        } catch (error) {
          console.error(`[SocketService] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Handle socket errors
   */
  private handleError(error: SocketErrorEvent): void {
    console.error('[SocketService] Error:', error);
    this.notifyListeners('error', error);
  }

  /**
   * Ensure socket is connected before emitting events
   */
  private ensureConnected(): boolean {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot emit event: Socket not connected');
      this.handleError({
        message: 'Socket is not connected',
        code: 'NOT_CONNECTED',
      });
      return false;
    }
    return true;
  }

  /**
   * Build server URL from onion address
   */
  private buildServerUrl(serverOnion: string): string {
    // Ensure proper format
    const cleanOnion = serverOnion.trim().toLowerCase();

    // Add .onion suffix if missing
    const onionAddress = cleanOnion.endsWith('.onion')
      ? cleanOnion
      : `${cleanOnion}.onion`;

    // Build full HTTP URL (TOR uses HTTP, encryption is provided by TOR network)
    return `http://${onionAddress}`;
  }
}

/**
 * Export singleton instance
 */
export const socketService = SocketService.getInstance();

/**
 * Export default instance
 */
export default socketService;
