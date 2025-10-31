/**
 * ChatStore - Zustand State Management for Chat Functionality
 *
 * Manages all chat-related state including:
 * - Rooms (list, current room, create/join/leave/delete)
 * - Messages (load, send, receive, pagination)
 * - Typing indicators
 * - Online users
 * - Unread counts
 * - Real-time updates via Socket.IO
 *
 * Features:
 * - Optimistic updates (messages appear immediately)
 * - Memory-efficient pagination (load messages on demand)
 * - E2E encryption via CryptoService
 * - Error recovery and retry logic
 * - Integration with ApiService, SocketService, and CryptoService
 */

import { create } from 'zustand';
import {
  Room,
  Message,
  RoomMember,
  TypingUser,
  User,
  CreateRoomParams,
  SendMessageParams,
  MessageType,
  RoomType,
  RoomsResponse,
  MessagesResponse,
  SocketMessageEvent,
  SocketTypingEvent,
  SocketUserStatusEvent,
  SocketUserRoomEvent,
  MessageReaction,
  ReactionEvent,
  createOptimisticMessage,
  FileUploadProgress,
  UploadResult,
} from '../types/Chat';
import { apiService } from '../services/ApiService';
import { socketService } from '../services/SocketService';
import { cryptoService } from '../services/CryptoService';
import { fileService, DocumentPickerResponse, ImageAsset } from '../services/FileService';
import { useServerStore } from './serverStore';
import { detectURLs } from '../utils/urlDetector';

/**
 * Pagination state for each room
 */
interface RoomPaginationState {
  hasMore: boolean;
  oldestMessageId: string | null;
  isLoadingMore: boolean;
}

/**
 * ChatStore state interface
 */
interface ChatState {
  // Core state
  rooms: Room[];
  currentRoom: Room | null;
  currentRoomId: string | null;
  messages: Map<string, Message[]>;
  members: Map<string, RoomMember[]>;
  roomKeys: Map<string, string>;
  typingUsers: Map<string, TypingUser[]>;
  onlineUsers: Set<string>;
  unreadCounts: Map<string, number>;
  isLoading: boolean;
  error: string | null;

  // Pagination state
  pagination: Map<string, RoomPaginationState>;

  // File upload state
  uploadProgress: Map<string, FileUploadProgress>;

  // Reactions state
  reactions: Map<string, MessageReaction[]>; // messageId -> reactions[]

  // Reply and edit state
  replyToMessage: Message | null;
  editingMessage: Message | null;

  // Room actions
  loadRooms: () => Promise<void>;
  setCurrentRoom: (roomId: string | null) => void;
  selectRoom: (roomId: string) => Promise<void>;
  createRoom: (params: CreateRoomParams) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  getRoomById: (roomId: string) => Room | undefined;

  // Message actions
  loadMessages: (roomId: string, limit?: number) => Promise<void>;
  loadMoreMessages: (roomId: string, limit?: number) => Promise<void>;
  sendMessage: (
    roomId: string,
    content: string,
    messageType?: MessageType | string,
    attachments?: string[]
  ) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'failed') => void;
  deleteMessage: (messageId: string, roomId: string) => Promise<void>;
  getMessagesForRoom: (roomId: string) => Message[];

  // Member actions
  loadMembers: (roomId: string) => Promise<void>;

  // Real-time event handlers (called by SocketService)
  handleNewMessage: (message: SocketMessageEvent) => void;
  handleUserJoin: (data: SocketUserRoomEvent) => void;
  handleUserLeave: (data: SocketUserRoomEvent) => void;
  handleTyping: (data: SocketTypingEvent) => void;
  handleStopTyping: (data: SocketTypingEvent) => void;
  handleUserStatus: (data: SocketUserStatusEvent) => void;

  // Typing indicators
  addTypingUser: (data: TypingUser) => void;
  removeTypingUser: (roomId: string, userId: string) => void;

  // Unread counts
  markRoomAsRead: (roomId: string) => void;
  incrementUnread: (roomId: string) => void;
  getUnreadCount: (roomId: string) => number;

  // File upload actions
  uploadFile: (roomId: string, file: DocumentPickerResponse) => Promise<void>;
  uploadImage: (roomId: string, image: ImageAsset) => Promise<void>;
  uploadMultipleImages: (roomId: string, images: ImageAsset[]) => Promise<void>;
  updateUploadProgress: (uploadId: string, progress: number) => void;
  cancelUpload: (uploadId: string) => void;
  getUploadProgress: (uploadId: string) => FileUploadProgress | undefined;

  // Reaction actions
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  handleReactionUpdate: (data: ReactionEvent) => void;
  getReactionsForMessage: (messageId: string) => MessageReaction[];

  // Link preview actions
  fetchLinkPreview: (url: string) => Promise<any | null>;

  // Reply and edit actions
  setReplyToMessage: (message: Message | null) => void;
  clearReplyToMessage: () => void;
  setEditingMessage: (message: Message | null) => void;
  clearEditingMessage: () => void;
  editMessage: async (messageId: string, newContent: string) => Promise<void>;
  forwardMessage: async (messageId: string, toRoomId: string) => Promise<void>;

  // Socket event handlers for message edits/deletes
  handleMessageDeleted: (data: { messageId: string; roomId: string; deletedBy: string }) => void;
  handleMessageEdited: (data: { messageId: string; roomId: string; content: string; editedAt: string }) => void;

  // Error handling
  setError: (error: string) => void;
  clearError: () => void;

  // Utility
  clearCurrentRoom: () => void;
  reset: () => void;
}

/**
 * Initial state
 */
const initialState = {
  rooms: [],
  currentRoom: null,
  currentRoomId: null,
  messages: new Map<string, Message[]>(),
  members: new Map<string, RoomMember[]>(),
  roomKeys: new Map<string, string>(),
  typingUsers: new Map<string, TypingUser[]>(),
  onlineUsers: new Set<string>(),
  unreadCounts: new Map<string, number>(),
  pagination: new Map<string, RoomPaginationState>(),
  uploadProgress: new Map<string, FileUploadProgress>(),
  reactions: new Map<string, MessageReaction[]>(),
  replyToMessage: null,
  editingMessage: null,
  isLoading: false,
  error: null,
};

/**
 * Create ChatStore with Zustand
 */
export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  /**
   * Load all rooms for the current user
   */
  loadRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.get<RoomsResponse>('/rooms');
      const rooms = data.rooms || [];

      // Process dates and sort rooms by last message or creation date
      const processedRooms = rooms.map((room) => ({
        ...room,
        createdAt: new Date(room.createdAt),
        updatedAt: new Date(room.updatedAt),
        lastMessage: room.lastMessage
          ? {
              ...room.lastMessage,
              createdAt: new Date(room.lastMessage.createdAt),
            }
          : undefined,
      }));

      const sortedRooms = processedRooms.sort((a, b) => {
        const dateA = a.lastMessage?.createdAt || a.updatedAt;
        const dateB = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      set({ rooms: sortedRooms, isLoading: false });
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to load rooms', isLoading: false });
    }
  },

  /**
   * Set the current active room (without loading full data)
   */
  setCurrentRoom: (roomId: string | null) => {
    const room = roomId ? get().rooms.find((r) => r.id === roomId) : null;
    set({ currentRoomId: roomId, currentRoom: room || null });

    // Mark room as read when entering
    if (roomId) {
      get().markRoomAsRead(roomId);
    }
  },

  selectRoom: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.get<{ room: Room }>(`/rooms/${roomId}`);
      set({ currentRoom: data.room, isLoading: false });

      // Store encryption key
      if (data.room.encryptionKey) {
        get().roomKeys.set(roomId, data.room.encryptionKey);
      }

      // Join socket room
      socketService.joinRoom(roomId);

      // Load messages and members
      await get().loadMessages(roomId);
      await get().loadMembers(roomId);
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to select room', isLoading: false });
    }
  },

  /**
   * Create a new room
   */
  createRoom: async (params: CreateRoomParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.post<{ room: Room }>('/rooms', params);
      const room = response.room;

      // Process dates
      const processedRoom = {
        ...room,
        createdAt: new Date(room.createdAt),
        updatedAt: new Date(room.updatedAt),
        unreadCount: 0,
      };

      // Store encryption key
      if (processedRoom.encryptionKey) {
        get().roomKeys.set(processedRoom.id, processedRoom.encryptionKey);
      }

      set((state) => ({
        rooms: [processedRoom, ...state.rooms],
        isLoading: false,
      }));

      return processedRoom;
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to create room', isLoading: false });
      throw error;
    }
  },

  joinRoom: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.post<{ room: Room }>(`/rooms/${roomId}/join`, {});
      const room = response.room;

      // Store encryption key
      if (room.encryptionKey) {
        get().roomKeys.set(roomId, room.encryptionKey);
      }

      // Update rooms list
      const rooms = get().rooms;
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index >= 0) {
        rooms[index] = room;
        set({ rooms: [...rooms] });
      } else {
        set({ rooms: [room, ...rooms] });
      }

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to join room', isLoading: false });
      throw error;
    }
  },

  leaveRoom: async (roomId: string) => {
    try {
      await apiService.post(`/rooms/${roomId}/leave`, {});
      socketService.leaveRoom(roomId);

      const rooms = get().rooms.filter((r) => r.id !== roomId);
      set({ rooms });

      if (get().currentRoom?.id === roomId) {
        set({ currentRoom: null });
      }
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to leave room' });
    }
  },

  deleteRoom: async (roomId: string) => {
    try {
      await apiService.delete(`/rooms/${roomId}`);
      socketService.leaveRoom(roomId);

      const rooms = get().rooms.filter((r) => r.id !== roomId);
      set({ rooms });

      if (get().currentRoom?.id === roomId) {
        set({ currentRoom: null });
      }
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to delete room' });
      throw error;
    }
  },

  /**
   * Send a message (with optimistic update)
   */
  sendMessage: async (
    roomId: string,
    content: string,
    messageType: MessageType | string = MessageType.TEXT,
    attachments: string[] = []
  ) => {
    try {
      const roomKey = get().roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      // Get current user from server store
      const activeServer = useServerStore.getState().activeServer;
      if (!activeServer?.user) {
        throw new Error('No active user');
      }

      const currentUser: User = {
        id: activeServer.user.id,
        username: activeServer.user.username,
        displayName: activeServer.user.displayName,
        publicKey: '', // Not needed for optimistic update
        isOnline: true,
        isAdmin: activeServer.user.isAdmin,
      };

      // Detect URLs and fetch link preview for the first URL
      let linkPreview = null;
      const urls = detectURLs(content);
      if (urls.length > 0) {
        // Fetch preview for first URL only to avoid spamming the API
        linkPreview = await get().fetchLinkPreview(urls[0].url);
      }

      // Create optimistic message
      const optimisticMessage = createOptimisticMessage(
        roomId,
        currentUser,
        content,
        messageType
      );

      // Add link preview metadata if available
      if (linkPreview) {
        optimisticMessage.metadata = {
          ...optimisticMessage.metadata,
          linkPreview,
        };
      }

      // Add attachments if provided
      if (attachments.length > 0) {
        optimisticMessage.attachments = attachments;

        // Auto-detect message type from attachments if type is TEXT
        if (messageType === MessageType.TEXT || messageType === 'text') {
          const firstAttachment = attachments[0];
          if (firstAttachment.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            optimisticMessage.messageType = MessageType.IMAGE;
          } else if (firstAttachment.match(/\.(mp4|webm|ogg)$/i)) {
            optimisticMessage.messageType = MessageType.VIDEO;
          } else {
            optimisticMessage.messageType = MessageType.FILE;
          }
        }
      }

      // Add optimistic message to UI immediately
      get().addMessage(optimisticMessage);

      // Encrypt message
      const encryptedContent = await cryptoService.encryptMessage(content, roomKey);

      // Send via socket
      socketService.sendMessage(
        roomId,
        encryptedContent,
        optimisticMessage.messageType as string,
        attachments
      );

      // Update status to sent
      get().updateMessageStatus(optimisticMessage.id, 'sent');
    } catch (error: any) {
      console.error('Failed to send message:', error);
      set({ error: error.message || 'Failed to send message' });
      throw error;
    }
  },

  /**
   * Load messages for a room (initial load)
   */
  loadMessages: async (roomId: string, limit: number = 50) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.get<MessagesResponse>(
        `/rooms/${roomId}/messages?limit=${limit}`
      );

      const messages = response.messages || [];
      const roomKey = get().roomKeys.get(roomId);

      // Decrypt messages
      if (roomKey) {
        for (const message of messages) {
          try {
            const decrypted = await cryptoService.decryptMessage(message.encryptedContent, roomKey);
            message.decryptedContent = decrypted;
            message.isDecrypted = true;
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            message.decryptedContent = '[Encrypted]';
            message.decryptionError = 'Failed to decrypt';
          }
        }
      }

      // Process dates and sort by createdAt (oldest first for chat display)
      const processedMessages = messages
        .map((msg) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
          updatedAt: msg.updatedAt ? new Date(msg.updatedAt) : undefined,
          status: 'sent' as const,
        }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Update messages cache
      const messagesCache = get().messages;
      messagesCache.set(roomId, processedMessages);

      // Update pagination state
      const paginationState = get().pagination;
      paginationState.set(roomId, {
        hasMore: response.hasMore || false,
        oldestMessageId: processedMessages.length > 0 ? processedMessages[0].id : null,
        isLoadingMore: false,
      });

      set({
        messages: new Map(messagesCache),
        pagination: new Map(paginationState),
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      set({
        error: error.message || 'Failed to load messages',
        isLoading: false,
      });
    }
  },

  loadMembers: async (roomId: string) => {
    try {
      const data = await apiService.get<{ members: RoomMember[] }>(`/rooms/${roomId}/members`);
      get().members.set(roomId, data.members);
      set({ members: new Map(get().members) });
    } catch (error: any) {
      set({ error: error.error || error.message || 'Failed to load members' });
    }
  },

  addMessage: async (message: Message) => {
    const roomKey = get().roomKeys.get(message.roomId);
    if (roomKey) {
      try {
        const decrypted = await cryptoService.decryptRoomMessage(message.encryptedContent, roomKey);
        message.decryptedContent = decrypted;
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        message.decryptedContent = '[Encrypted]';
      }
    }

    const roomMessages = get().messages.get(message.roomId) || [];

    // Check if message already exists (avoid duplicates)
    const exists = roomMessages.some(m => m.id === message.id);
    if (!exists) {
      roomMessages.push(message);
      get().messages.set(message.roomId, roomMessages);
      set({ messages: new Map(get().messages) });

      // Update room's last message
      const rooms = get().rooms.map(room => {
        if (room.id === message.roomId) {
          return { ...room, lastMessage: message };
        }
        return room;
      });
      set({ rooms });
    }
  },

  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'failed') => {
    const messages = get().messages;
    for (const [roomId, roomMessages] of messages.entries()) {
      const messageIndex = roomMessages.findIndex(m => m.id === messageId);
      if (messageIndex >= 0) {
        roomMessages[messageIndex].status = status;
        messages.set(roomId, [...roomMessages]);
        set({ messages: new Map(messages) });
        break;
      }
    }
  },

  addTypingUser: (data: TypingUser) => {
    const typingUsers = get().typingUsers.get(data.roomId) || [];
    const exists = typingUsers.some(u => u.userId === data.userId);

    if (!exists) {
      typingUsers.push(data);
      get().typingUsers.set(data.roomId, typingUsers);
      set({ typingUsers: new Map(get().typingUsers) });
    }
  },

  removeTypingUser: (roomId: string, userId: string) => {
    const typingUsers = get().typingUsers.get(roomId) || [];
    const filtered = typingUsers.filter(u => u.userId !== userId);
    get().typingUsers.set(roomId, filtered);
    set({ typingUsers: new Map(get().typingUsers) });
  },

  clearCurrentRoom: () => {
    const currentRoom = get().currentRoom;
    if (currentRoom) {
      socketService.leaveRoom(currentRoom.id);
    }
    set({ currentRoom: null, currentRoomId: null });
  },

  clearError: () => set({ error: null }),

  /**
   * Get a room by ID
   */
  getRoomById: (roomId: string) => {
    return get().rooms.find((r) => r.id === roomId);
  },

  /**
   * Load more messages (pagination)
   */
  loadMoreMessages: async (roomId: string, limit: number = 50) => {
    const paginationState = get().pagination.get(roomId);
    if (!paginationState?.hasMore || paginationState.isLoadingMore) {
      return;
    }

    // Set loading state
    const pagination = get().pagination;
    pagination.set(roomId, { ...paginationState, isLoadingMore: true });
    set({ pagination: new Map(pagination) });

    try {
      const response = await apiService.get<MessagesResponse>(
        `/rooms/${roomId}/messages?limit=${limit}&before=${paginationState.oldestMessageId}`
      );

      const newMessages = response.messages || [];
      const roomKey = get().roomKeys.get(roomId);

      // Decrypt messages
      if (roomKey) {
        for (const message of newMessages) {
          try {
            const decrypted = await cryptoService.decryptMessage(message.encryptedContent, roomKey);
            message.decryptedContent = decrypted;
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            message.decryptedContent = '[Encrypted]';
          }
        }
      }

      // Prepend to existing messages
      const messagesCache = get().messages;
      const existingMessages = messagesCache.get(roomId) || [];
      messagesCache.set(roomId, [...newMessages.reverse(), ...existingMessages]);

      // Update pagination state
      const updatedPagination = get().pagination;
      updatedPagination.set(roomId, {
        hasMore: response.hasMore || false,
        oldestMessageId: newMessages.length > 0 ? newMessages[0].id : paginationState.oldestMessageId,
        isLoadingMore: false,
      });

      set({
        messages: new Map(messagesCache),
        pagination: new Map(updatedPagination),
      });
    } catch (error: any) {
      console.error('Failed to load more messages:', error);

      // Reset loading state
      const pagination = get().pagination;
      const state = pagination.get(roomId);
      if (state) {
        pagination.set(roomId, { ...state, isLoadingMore: false });
        set({ pagination: new Map(pagination) });
      }

      set({ error: error.message || 'Failed to load more messages' });
    }
  },

  /**
   * Update a message in the cache
   */
  updateMessage: (messageId: string, updates: Partial<Message>) => {
    const messagesCache = get().messages;

    // Find the room containing this message
    for (const [roomId, messages] of messagesCache.entries()) {
      const messageIndex = messages.findIndex((m) => m.id === messageId || m.localId === messageId);

      if (messageIndex >= 0) {
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          ...updates,
        };

        messagesCache.set(roomId, updatedMessages);
        set({ messages: new Map(messagesCache) });
        break;
      }
    }
  },

  /**
   * Delete a message
   */
  deleteMessage: async (messageId: string, roomId: string) => {
    try {
      // Optimistic delete
      const messagesCache = get().messages;
      const roomMessages = messagesCache.get(roomId) || [];
      const originalMessages = [...roomMessages];

      messagesCache.set(
        roomId,
        roomMessages.filter((m) => m.id !== messageId)
      );
      set({ messages: new Map(messagesCache) });

      // API call
      await apiService.delete(`/rooms/${roomId}/messages/${messageId}`);

      // Socket emit
      socketService.emit('messageDeleted', { messageId, roomId });
    } catch (error: any) {
      console.error('Failed to delete message:', error);

      // Revert optimistic delete on error
      const messagesCache = get().messages;
      const originalMessages = messagesCache.get(roomId) || [];
      // Note: In a production app, you'd want to store the original messages
      // before the optimistic update to properly revert

      set({ error: error.message || 'Failed to delete message' });
      throw error;
    }
  },

  /**
   * Get messages for a specific room
   */
  getMessagesForRoom: (roomId: string) => {
    return get().messages.get(roomId) || [];
  },

  /**
   * Handle new message from Socket.IO
   */
  handleNewMessage: (socketMessage: SocketMessageEvent) => {
    const message: Message = {
      id: socketMessage.id,
      roomId: socketMessage.roomId,
      sender: socketMessage.sender,
      senderId: socketMessage.sender.id,
      encryptedContent: socketMessage.encryptedContent,
      messageType: socketMessage.messageType,
      attachments: socketMessage.attachments,
      createdAt: new Date(socketMessage.createdAt),
      status: 'sent',
      isDecrypted: false,
    };

    // Decrypt message asynchronously
    const roomKey = get().roomKeys.get(message.roomId);
    if (roomKey) {
      cryptoService
        .decryptMessage(message.encryptedContent, roomKey)
        .then((decrypted) => {
          message.decryptedContent = decrypted;
          message.isDecrypted = true;
          get().addMessage(message);
        })
        .catch((error) => {
          console.error('Failed to decrypt message:', error);
          message.decryptedContent = '[Encrypted]';
          message.decryptionError = error.message;
          get().addMessage(message);
        });
    } else {
      get().addMessage(message);
    }

    // Increment unread count if not in the room
    if (get().currentRoomId !== message.roomId) {
      get().incrementUnread(message.roomId);
    }

    // Update room's last message
    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === message.roomId
          ? {
              ...room,
              lastMessage: message,
            }
          : room
      ),
    }));
  },

  /**
   * Handle user joining a room
   */
  handleUserJoin: (data: SocketUserRoomEvent) => {
    console.log(`User ${data.username} joined room ${data.roomId}`);
    // Could add a system message here if desired
  },

  /**
   * Handle user leaving a room
   */
  handleUserLeave: (data: SocketUserRoomEvent) => {
    console.log(`User ${data.username} left room ${data.roomId}`);
    // Could add a system message here if desired
  },

  /**
   * Handle typing indicator
   */
  handleTyping: (data: SocketTypingEvent) => {
    if (!data.isTyping) {
      get().handleStopTyping(data);
      return;
    }

    get().addTypingUser({
      userId: data.userId,
      username: data.username,
      roomId: data.roomId,
      timestamp: new Date(),
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeTypingUser(data.roomId, data.userId);
    }, 5000);
  },

  /**
   * Handle stop typing
   */
  handleStopTyping: (data: SocketTypingEvent) => {
    get().removeTypingUser(data.roomId, data.userId);
  },

  /**
   * Handle user status change (online/offline)
   */
  handleUserStatus: (data: SocketUserStatusEvent) => {
    const onlineUsers = get().onlineUsers;

    if (data.isOnline) {
      onlineUsers.add(data.userId);
    } else {
      onlineUsers.delete(data.userId);
    }

    set({ onlineUsers: new Set(onlineUsers) });
  },

  /**
   * Mark a room as read (clear unread count)
   */
  markRoomAsRead: (roomId: string) => {
    const unreadCounts = get().unreadCounts;
    unreadCounts.set(roomId, 0);

    set({
      unreadCounts: new Map(unreadCounts),
      rooms: get().rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      ),
    });
  },

  /**
   * Increment unread count for a room
   */
  incrementUnread: (roomId: string) => {
    const unreadCounts = get().unreadCounts;
    const current = unreadCounts.get(roomId) || 0;
    unreadCounts.set(roomId, current + 1);

    set({
      unreadCounts: new Map(unreadCounts),
      rooms: get().rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: current + 1 } : room
      ),
    });
  },

  /**
   * Get unread count for a room
   */
  getUnreadCount: (roomId: string) => {
    return get().unreadCounts.get(roomId) || 0;
  },

  /**
   * Upload a file to the server
   * Creates an optimistic message with upload progress tracking
   */
  uploadFile: async (roomId: string, file: DocumentPickerResponse) => {
    try {
      const activeServer = useServerStore.getState().activeServer;
      if (!activeServer?.user) {
        throw new Error('No active user');
      }

      const currentUser: User = {
        id: activeServer.user.id,
        username: activeServer.user.username,
        displayName: activeServer.user.displayName,
        publicKey: '',
        isOnline: true,
        isAdmin: activeServer.user.isAdmin,
      };

      const uploadId = `upload-${Date.now()}-${Math.random()}`;
      const messageId = `temp-${Date.now()}-${Math.random()}`;

      const uploadProgressEntry: FileUploadProgress = {
        uploadId,
        messageId,
        filename: file.name || 'file',
        progress: 0,
        status: 'uploading',
      };

      const uploadProgress = get().uploadProgress;
      uploadProgress.set(uploadId, uploadProgressEntry);
      set({ uploadProgress: new Map(uploadProgress) });

      const optimisticMessage = createOptimisticMessage(
        roomId,
        currentUser,
        file.name || 'File',
        fileService.getFileType(file.type || 'application/octet-stream')
      );
      optimisticMessage.id = messageId;

      get().addMessage(optimisticMessage);

      const result = await fileService.uploadFile(file, roomId, (progress) => {
        get().updateUploadProgress(uploadId, progress);
      });

      const currentProgress = get().uploadProgress.get(uploadId);
      if (currentProgress) {
        currentProgress.status = 'completed';
        currentProgress.progress = 100;
        get().uploadProgress.set(uploadId, currentProgress);
        set({ uploadProgress: new Map(get().uploadProgress) });
      }

      const roomKey = get().roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      const encryptedContent = await cryptoService.encryptMessage(result.originalName, roomKey);

      const attachment = {
        id: result.filename,
        filename: result.filename,
        originalName: result.originalName,
        mimeType: result.mimetype,
        size: result.size,
        url: result.url,
        thumbnail: result.thumbnailUrl,
      };

      socketService.sendMessage(
        roomId,
        encryptedContent,
        fileService.getFileType(result.mimetype),
        [JSON.stringify(attachment)]
      );

      get().updateMessage(messageId, {
        status: 'sent',
        attachments: [attachment],
      });

      setTimeout(() => {
        const uploadProgress = get().uploadProgress;
        uploadProgress.delete(uploadId);
        set({ uploadProgress: new Map(uploadProgress) });
      }, 3000);
    } catch (error: any) {
      console.error('[ChatStore] File upload failed:', error);
      set({ error: error.message || 'Failed to upload file' });
      throw error;
    }
  },

  /**
   * Upload an image to the server
   */
  uploadImage: async (roomId: string, image: ImageAsset) => {
    try {
      const activeServer = useServerStore.getState().activeServer;
      if (!activeServer?.user) {
        throw new Error('No active user');
      }

      const currentUser: User = {
        id: activeServer.user.id,
        username: activeServer.user.username,
        displayName: activeServer.user.displayName,
        publicKey: '',
        isOnline: true,
        isAdmin: activeServer.user.isAdmin,
      };

      const uploadId = `upload-${Date.now()}-${Math.random()}`;
      const messageId = `temp-${Date.now()}-${Math.random()}`;

      const uploadProgressEntry: FileUploadProgress = {
        uploadId,
        messageId,
        filename: image.fileName || 'image.jpg',
        progress: 0,
        status: 'uploading',
      };

      const uploadProgress = get().uploadProgress;
      uploadProgress.set(uploadId, uploadProgressEntry);
      set({ uploadProgress: new Map(uploadProgress) });

      const optimisticMessage = createOptimisticMessage(
        roomId,
        currentUser,
        'Image',
        MessageType.IMAGE
      );
      optimisticMessage.id = messageId;

      get().addMessage(optimisticMessage);

      const result = await fileService.uploadImage(image, roomId, (progress) => {
        get().updateUploadProgress(uploadId, progress);
      });

      const currentProgress = get().uploadProgress.get(uploadId);
      if (currentProgress) {
        currentProgress.status = 'completed';
        currentProgress.progress = 100;
        get().uploadProgress.set(uploadId, currentProgress);
        set({ uploadProgress: new Map(get().uploadProgress) });
      }

      const roomKey = get().roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      const encryptedContent = await cryptoService.encryptMessage('Image', roomKey);

      const attachment = {
        id: result.filename,
        filename: result.filename,
        originalName: result.originalName,
        mimeType: result.mimetype,
        size: result.size,
        url: result.url,
        thumbnail: result.thumbnailUrl,
      };

      socketService.sendMessage(
        roomId,
        encryptedContent,
        MessageType.IMAGE,
        [JSON.stringify(attachment)]
      );

      get().updateMessage(messageId, {
        status: 'sent',
        attachments: [attachment],
      });

      setTimeout(() => {
        const uploadProgress = get().uploadProgress;
        uploadProgress.delete(uploadId);
        set({ uploadProgress: new Map(uploadProgress) });
      }, 3000);
    } catch (error: any) {
      console.error('[ChatStore] Image upload failed:', error);
      set({ error: error.message || 'Failed to upload image' });
      throw error;
    }
  },

  /**
   * Upload multiple images
   */
  uploadMultipleImages: async (roomId: string, images: ImageAsset[]) => {
    try {
      for (const image of images) {
        await get().uploadImage(roomId, image);
      }
    } catch (error: any) {
      console.error('[ChatStore] Multiple image upload failed:', error);
      set({ error: error.message || 'Failed to upload images' });
      throw error;
    }
  },

  /**
   * Update upload progress
   */
  updateUploadProgress: (uploadId: string, progress: number) => {
    const uploadProgress = get().uploadProgress;
    const current = uploadProgress.get(uploadId);

    if (current) {
      current.progress = progress;
      uploadProgress.set(uploadId, current);
      set({ uploadProgress: new Map(uploadProgress) });
    }
  },

  /**
   * Cancel an active upload
   */
  cancelUpload: (uploadId: string) => {
    try {
      fileService.cancelUpload(uploadId);

      const uploadProgress = get().uploadProgress;
      const current = uploadProgress.get(uploadId);

      if (current) {
        current.status = 'cancelled';
        uploadProgress.set(uploadId, current);
        set({ uploadProgress: new Map(uploadProgress) });

        setTimeout(() => {
          uploadProgress.delete(uploadId);
          set({ uploadProgress: new Map(uploadProgress) });
        }, 2000);
      }
    } catch (error: any) {
      console.error('[ChatStore] Cancel upload failed:', error);
    }
  },

  /**
   * Get upload progress
   */
  getUploadProgress: (uploadId: string) => {
    return get().uploadProgress.get(uploadId);
  },

  /**
   * Fetch link preview metadata from backend
   */
  fetchLinkPreview: async (url: string) => {
    try {
      const response = await apiService.post<any>('/link-preview', { url });
      return response;
    } catch (error: any) {
      console.error('Failed to fetch link preview:', error);
      return null;
    }
  },

  /**
   * Add a reaction to a message
   */
  addReaction: async (messageId: string, emoji: string) => {
    const { currentRoomId } = get();
    if (!currentRoomId) return;

    const activeServer = useServerStore.getState().activeServer;
    if (!activeServer?.user) return;

    const currentUserId = activeServer.user.id;

    // Optimistic update
    const reactions = get().reactions.get(messageId) || [];
    const existingReaction = reactions.find(r => r.emoji === emoji);

    if (existingReaction) {
      if (!existingReaction.users.includes(currentUserId)) {
        existingReaction.users.push(currentUserId);
        existingReaction.count++;
      }
    } else {
      reactions.push({ emoji, users: [currentUserId], count: 1 });
    }

    const updatedReactions = new Map(get().reactions);
    updatedReactions.set(messageId, [...reactions]);
    set({ reactions: updatedReactions });

    // Emit socket event
    try {
      socketService.emit('addReaction', {
        messageId,
        roomId: currentRoomId,
        emoji,
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  },

  /**
   * Remove a reaction from a message
   */
  removeReaction: async (messageId: string, emoji: string) => {
    const { currentRoomId } = get();
    if (!currentRoomId) return;

    const activeServer = useServerStore.getState().activeServer;
    if (!activeServer?.user) return;

    const currentUserId = activeServer.user.id;

    // Optimistic update
    const reactions = get().reactions.get(messageId) || [];
    const reactionIndex = reactions.findIndex(r => r.emoji === emoji);

    if (reactionIndex !== -1) {
      const reaction = reactions[reactionIndex];
      reaction.users = reaction.users.filter(id => id !== currentUserId);
      reaction.count--;
      if (reaction.count === 0) {
        reactions.splice(reactionIndex, 1);
      }
    }

    const updatedReactions = new Map(get().reactions);
    updatedReactions.set(messageId, [...reactions]);
    set({ reactions: updatedReactions });

    // Emit socket event
    try {
      socketService.emit('removeReaction', {
        messageId,
        roomId: currentRoomId,
        emoji,
      });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  },

  /**
   * Toggle a reaction (add if not exists, remove if exists)
   */
  toggleReaction: async (messageId: string, emoji: string) => {
    const activeServer = useServerStore.getState().activeServer;
    if (!activeServer?.user) return;

    const currentUserId = activeServer.user.id;
    const reactions = get().reactions.get(messageId) || [];
    const existingReaction = reactions.find(r => r.emoji === emoji);

    if (existingReaction && existingReaction.users.includes(currentUserId)) {
      await get().removeReaction(messageId, emoji);
    } else {
      await get().addReaction(messageId, emoji);
    }
  },

  /**
   * Handle reaction update from Socket.IO
   */
  handleReactionUpdate: (data: ReactionEvent) => {
    const reactions = get().reactions.get(data.messageId) || [];

    if (data.action === 'add') {
      const existingReaction = reactions.find(r => r.emoji === data.emoji);
      if (existingReaction) {
        if (!existingReaction.users.includes(data.userId)) {
          existingReaction.users.push(data.userId);
          existingReaction.count++;
        }
      } else {
        reactions.push({ emoji: data.emoji, users: [data.userId], count: 1 });
      }
    } else if (data.action === 'remove') {
      const reactionIndex = reactions.findIndex(r => r.emoji === data.emoji);
      if (reactionIndex !== -1) {
        const reaction = reactions[reactionIndex];
        reaction.users = reaction.users.filter(id => id !== data.userId);
        reaction.count--;
        if (reaction.count === 0) {
          reactions.splice(reactionIndex, 1);
        }
      }
    }

    const updatedReactions = new Map(get().reactions);
    updatedReactions.set(data.messageId, [...reactions]);
    set({ reactions: updatedReactions });
  },

  /**
   * Get reactions for a specific message
   */
  getReactionsForMessage: (messageId: string) => {
    return get().reactions.get(messageId) || [];
  },

  /**
   * Set error message
   */
  setError: (error: string) => {
    set({ error });
  },

  /**
   * Set message to reply to
   */
  setReplyToMessage: (message: Message | null) => {
    set({ replyToMessage: message, editingMessage: null });
  },

  /**
   * Clear reply message
   */
  clearReplyToMessage: () => {
    set({ replyToMessage: null });
  },

  /**
   * Set message to edit
   */
  setEditingMessage: (message: Message | null) => {
    set({ editingMessage: message, replyToMessage: null });
  },

  /**
   * Clear editing message
   */
  clearEditingMessage: () => {
    set({ editingMessage: null });
  },

  /**
   * Edit a message
   */
  editMessage: async (messageId: string, newContent: string) => {
    const { currentRoomId } = get();
    if (!currentRoomId) return;

    try {
      // Optimistic update
      const messagesCache = get().messages;
      const roomMessages = messagesCache.get(currentRoomId) || [];
      const messageIndex = roomMessages.findIndex(m => m.id === messageId);

      if (messageIndex !== -1) {
        roomMessages[messageIndex] = {
          ...roomMessages[messageIndex],
          decryptedContent: newContent,
          isEdited: true,
          editedAt: new Date().toISOString(),
        };
        messagesCache.set(currentRoomId, [...roomMessages]);
        set({ messages: new Map(messagesCache) });
      }

      // API call
      const roomKey = get().roomKeys.get(currentRoomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      const encryptedContent = await cryptoService.encryptMessage(newContent, roomKey);

      await apiService.put(`/rooms/${currentRoomId}/messages/${messageId}`, {
        content: encryptedContent,
      });

      // Socket emit
      socketService.emit('messageEdited', {
        messageId,
        roomId: currentRoomId,
        content: encryptedContent,
      });

      get().clearEditingMessage();
    } catch (error: any) {
      console.error('Failed to edit message:', error);
      set({ error: error.message || 'Failed to edit message' });
      throw error;
    }
  },

  /**
   * Forward a message to another room
   */
  forwardMessage: async (messageId: string, toRoomId: string) => {
    try {
      // Find the message
      const messagesCache = get().messages;
      let foundMessage: Message | null = null;

      for (const [roomId, messages] of messagesCache.entries()) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          foundMessage = message;
          break;
        }
      }

      if (!foundMessage || !foundMessage.decryptedContent) {
        throw new Error('Message not found');
      }

      // Send to target room
      await get().sendMessage(
        toRoomId,
        foundMessage.decryptedContent,
        foundMessage.messageType,
        foundMessage.attachments as string[]
      );
    } catch (error: any) {
      console.error('Failed to forward message:', error);
      set({ error: error.message || 'Failed to forward message' });
      throw error;
    }
  },

  /**
   * Handle message deleted event from Socket.IO
   */
  handleMessageDeleted: (data: { messageId: string; roomId: string; deletedBy: string }) => {
    const messagesCache = get().messages;
    const roomMessages = messagesCache.get(data.roomId) || [];

    messagesCache.set(
      data.roomId,
      roomMessages.filter(m => m.id !== data.messageId)
    );

    set({ messages: new Map(messagesCache) });

    console.log(`[ChatStore] Message ${data.messageId} deleted by ${data.deletedBy}`);
  },

  /**
   * Handle message edited event from Socket.IO
   */
  handleMessageEdited: async (data: { messageId: string; roomId: string; content: string; editedAt: string }) => {
    const messagesCache = get().messages;
    const roomMessages = messagesCache.get(data.roomId) || [];
    const messageIndex = roomMessages.findIndex(m => m.id === data.messageId);

    if (messageIndex !== -1) {
      const roomKey = get().roomKeys.get(data.roomId);

      if (roomKey) {
        try {
          // Decrypt the edited content
          const decryptedContent = await cryptoService.decryptMessage(data.content, roomKey);

          roomMessages[messageIndex] = {
            ...roomMessages[messageIndex],
            encryptedContent: data.content,
            decryptedContent,
            isEdited: true,
            editedAt: data.editedAt,
          };

          messagesCache.set(data.roomId, [...roomMessages]);
          set({ messages: new Map(messagesCache) });

          console.log(`[ChatStore] Message ${data.messageId} edited`);
        } catch (error) {
          console.error('[ChatStore] Failed to decrypt edited message:', error);
        }
      }
    }
  },

  /**
   * Reset store to initial state (on logout)
   */
  reset: () => {
    fileService.cancelAllUploads();
    set(initialState);
  },
}));

/**
 * Export default
 */
export default useChatStore;
