/**
 * Chat-related type definitions for TOR Chat Android App
 *
 * These types define the structure of messages, rooms, and chat-related entities
 * that match the backend API and enable full chat functionality.
 */

/**
 * Message types supported by the chat system
 */
export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
  SYSTEM = 'system',
}

/**
 * Room types
 */
export enum RoomType {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

/**
 * User information included in messages and rooms
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen?: Date;
  isAdmin: boolean;
}

/**
 * Message attachment information
 */
export interface MessageAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnail?: string;
}

/**
 * Message metadata (can include link previews, reactions, etc.)
 */
export interface MessageMetadata {
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  };
  reactions?: {
    [emoji: string]: string[]; // emoji -> userId[]
  };
  replyTo?: string; // messageId being replied to
  edited?: boolean;
  editedAt?: Date;
}

/**
 * Message entity
 */
export interface Message {
  id: string;
  roomId: string;
  sender: User;
  senderId: string;
  encryptedContent: string;
  decryptedContent?: string; // Decrypted content (client-side only)
  messageType: MessageType | 'text' | 'file' | 'image' | 'video' | 'system';
  attachments?: MessageAttachment[] | string[];
  metadata?: MessageMetadata | Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;

  // Client-side fields
  isDecrypted?: boolean;
  decryptionError?: string;
  status?: 'sending' | 'sent' | 'failed'; // Optimistic update status
  sendError?: string; // Error during send
  localId?: string; // Temporary ID before server confirmation
}

/**
 * Room member information
 */
export interface RoomMember {
  id: string;
  roomId: string;
  userId?: string;
  user: User;
  role?: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
}

/**
 * Room entity
 */
export interface Room {
  id: string;
  name: string;
  description?: string;
  type: RoomType | 'public' | 'private';
  creatorId: string;
  creator?: User;
  encryptionKey?: string; // Only available after joining
  maxMembers?: number;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;

  // Computed fields
  memberCount?: number;
  members?: RoomMember[];
  lastMessage?: Message;

  // Client-side fields
  unreadCount?: number;
  isMuted?: boolean;
  isPinned?: boolean;
}

/**
 * Typing indicator
 */
export interface TypingUser {
  userId: string;
  username: string;
  roomId: string;
  timestamp?: Date;
}

/**
 * Message pagination parameters
 */
export interface MessagePagination {
  roomId: string;
  limit: number;
  before?: string; // messageId to load messages before
  after?: string; // messageId to load messages after
}

/**
 * Create room parameters
 */
export interface CreateRoomParams {
  name: string;
  description?: string;
  type: RoomType | 'public' | 'private';
  maxMembers?: number;
  avatar?: string;
}

/**
 * Send message parameters
 */
export interface SendMessageParams {
  roomId: string;
  content: string;
  messageType?: MessageType | 'text' | 'file' | 'image' | 'video' | 'system';
  attachments?: string[]; // File URLs or IDs
  metadata?: MessageMetadata;
}

/**
 * API response for rooms list
 */
export interface RoomsResponse {
  rooms: Room[];
  total?: number;
}

/**
 * API response for messages list
 */
export interface MessagesResponse {
  messages: Message[];
  total?: number;
  hasMore?: boolean;
}

/**
 * Socket event types
 */
export enum SocketEvent {
  // Outgoing
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  SEND_MESSAGE = 'send_message',
  TYPING = 'typing',

  // Incoming
  MESSAGE = 'message',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_TYPING = 'user_typing',
  USER_STATUS = 'user_status',
  ERROR = 'error',
}

/**
 * Socket message event payload
 */
export interface SocketMessageEvent {
  id: string;
  roomId: string;
  sender: User;
  encryptedContent: string;
  messageType: MessageType | string;
  attachments?: string[];
  createdAt: Date;
}

/**
 * Socket typing event payload
 */
export interface SocketTypingEvent {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
}

/**
 * Socket user status event payload
 */
export interface SocketUserStatusEvent {
  userId: string;
  isOnline: boolean;
}

/**
 * Socket user joined/left event payload
 */
export interface SocketUserRoomEvent {
  userId: string;
  username: string;
  roomId: string;
}

/**
 * Helper function to create an optimistic message for immediate UI updates
 */
export function createOptimisticMessage(
  roomId: string,
  sender: User,
  content: string,
  messageType: MessageType | string = MessageType.TEXT
): Message {
  const now = new Date();
  return {
    id: `temp-${Date.now()}-${Math.random()}`,
    localId: `local-${Date.now()}-${Math.random()}`,
    roomId,
    sender,
    senderId: sender.id,
    encryptedContent: '', // Will be encrypted before sending
    decryptedContent: content,
    messageType,
    attachments: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    isDecrypted: true,
    status: 'sending',
  };
}

/**
 * Helper function to check if a message is a system message
 */
export function isSystemMessage(message: Message): boolean {
  return message.messageType === MessageType.SYSTEM || message.messageType === 'system';
}

/**
 * Helper function to check if a message has attachments
 */
export function hasAttachments(message: Message): boolean {
  return !!message.attachments && message.attachments.length > 0;
}

/**
 * Helper function to get message display text
 */
export function getMessageDisplayText(message: Message): string {
  if (message.decryptedContent) {
    return message.decryptedContent;
  }

  const type = message.messageType;
  switch (type) {
    case MessageType.IMAGE:
    case 'image':
      return '📷 Image';
    case MessageType.VIDEO:
    case 'video':
      return '🎥 Video';
    case MessageType.FILE:
    case 'file':
      return '📎 File';
    case MessageType.SYSTEM:
    case 'system':
      return message.decryptedContent || 'System message';
    default:
      return message.decryptedContent || '';
  }
}

/**
 * Helper function to format message time
 */
export function formatMessageTime(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return messageDate.toLocaleDateString();
  }
}
