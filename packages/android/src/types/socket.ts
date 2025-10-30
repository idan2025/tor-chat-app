/**
 * Socket.IO Event Types and Interfaces
 *
 * Type definitions for all socket events used in real-time communication
 */

/**
 * Message types supported by the application
 */
export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
  SYSTEM = 'system',
}

/**
 * User information in socket events
 */
export interface SocketUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Message structure from socket events
 */
export interface SocketMessage {
  id: string;
  roomId: string;
  sender: SocketUser;
  encryptedContent: string;
  messageType: MessageType;
  attachments?: string[];
  createdAt: string | Date;
}

/**
 * User joined room event
 */
export interface UserJoinedEvent {
  userId: string;
  username: string;
  roomId: string;
}

/**
 * User left room event
 */
export interface UserLeftEvent {
  userId: string;
  username: string;
  roomId: string;
}

/**
 * User status event (online/offline)
 */
export interface UserStatusEvent {
  userId: string;
  isOnline: boolean;
}

/**
 * User typing event
 */
export interface UserTypingEvent {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
}

/**
 * Room invite event
 */
export interface RoomInviteEvent {
  roomId: string;
  roomName: string;
  invitedBy: SocketUser;
}

/**
 * Socket error event
 */
export interface SocketErrorEvent {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Socket connection state
 */
export enum SocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Socket event callback types
 */
export type ConnectCallback = () => void;
export type DisconnectCallback = (reason: string) => void;
export type MessageCallback = (message: SocketMessage) => void;
export type UserJoinedCallback = (data: UserJoinedEvent) => void;
export type UserLeftCallback = (data: UserLeftEvent) => void;
export type UserStatusCallback = (data: UserStatusEvent) => void;
export type UserTypingCallback = (data: UserTypingEvent) => void;
export type RoomInviteCallback = (data: RoomInviteEvent) => void;
export type ErrorCallback = (error: SocketErrorEvent) => void;
export type ConnectionStateCallback = (state: SocketConnectionState) => void;

/**
 * Socket configuration options
 */
export interface SocketConfig {
  /** Server onion address (e.g., "abc123xyz.onion") */
  serverOnion: string;

  /** Authentication token */
  token: string;

  /** Connection timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Enable auto-reconnect (default: true) */
  reconnection?: boolean;

  /** Maximum reconnection attempts (default: 5) */
  reconnectionAttempts?: number;

  /** Initial reconnection delay in milliseconds (default: 2000) */
  reconnectionDelay?: number;

  /** Maximum reconnection delay in milliseconds (default: 10000) */
  reconnectionDelayMax?: number;

  /** Exponential backoff factor (default: 1.5) */
  reconnectionDelayMultiplier?: number;
}

/**
 * Message send options
 */
export interface SendMessageOptions {
  roomId: string;
  encryptedContent: string;
  messageType?: MessageType;
  attachments?: string[];
  metadata?: Record<string, any>;
}
