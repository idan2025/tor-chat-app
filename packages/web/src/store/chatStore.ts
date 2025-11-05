import { create } from 'zustand';
import { Room, Message, RoomMember, UploadProgress } from '../types';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { cryptoService } from '../services/crypto';

interface ChatState {
  rooms: Room[];
  currentRoom: Room | null;
  messages: Map<string, Message[]>;
  members: Map<string, RoomMember[]>;
  roomKeys: Map<string, string>;
  typingUsers: Map<string, Map<string, string>>;
  unreadCounts: Map<string, number>;
  lastReadMessageId: Map<string, string>;
  uploadProgress: Map<string, UploadProgress>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadRooms: () => Promise<void>;
  selectRoom: (roomId: string) => Promise<void>;
  createRoom: (data: { name: string; description?: string; type?: 'public' | 'private' }) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  addMember: (roomId: string, userId: string) => Promise<void>;
  removeMember: (roomId: string, userId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, attachments?: string[], parentMessageId?: string) => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  loadMembers: (roomId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  addReaction: (messageId: string, roomId: string, emoji: string) => void;
  removeReaction: (messageId: string, roomId: string, emoji: string) => void;
  editMessage: (messageId: string, roomId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, roomId: string) => void;
  markRoomAsRead: (roomId: string) => void;
  updateUnreadCount: (roomId: string) => void;
  getTotalUnreadCount: () => number;
  addUploadProgress: (upload: UploadProgress) => void;
  updateUploadProgress: (id: string, progress: number) => void;
  removeUploadProgress: (id: string) => void;
  setUploadStatus: (id: string, status: 'uploading' | 'complete' | 'failed') => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  messages: new Map(),
  members: new Map(),
  roomKeys: new Map(),
  typingUsers: new Map(),
  unreadCounts: new Map(),
  lastReadMessageId: new Map(),
  uploadProgress: new Map(),
  isLoading: false,
  error: null,

  loadRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getRooms();
      set({ rooms: data.rooms, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to load rooms', isLoading: false });
    }
  },

  selectRoom: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getRoom(roomId);
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

      // Mark room as read
      get().markRoomAsRead(roomId);
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to select room', isLoading: false });
    }
  },

  createRoom: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.createRoom(data);
      const room = response.room;

      // Store encryption key
      if (room.encryptionKey) {
        get().roomKeys.set(room.id, room.encryptionKey);
      }

      set({ rooms: [...get().rooms, room], isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create room', isLoading: false });
      throw error;
    }
  },

  joinRoom: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.joinRoom(roomId);
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
      }

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to join room', isLoading: false });
      throw error;
    }
  },

  leaveRoom: async (roomId: string) => {
    try {
      await apiService.leaveRoom(roomId);
      socketService.leaveRoom(roomId);

      const rooms = get().rooms.filter((r) => r.id !== roomId);
      set({ rooms });

      if (get().currentRoom?.id === roomId) {
        set({ currentRoom: null });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to leave room' });
    }
  },

  deleteRoom: async (roomId: string) => {
    try {
      await apiService.deleteRoom(roomId);
      socketService.leaveRoom(roomId);

      const rooms = get().rooms.filter((r) => r.id !== roomId);
      set({ rooms });

      if (get().currentRoom?.id === roomId) {
        set({ currentRoom: null });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to delete room' });
      throw error;
    }
  },

  addMember: async (roomId: string, userId: string) => {
    try {
      await apiService.addRoomMember(roomId, userId);
      await get().loadMembers(roomId);
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to add member' });
      throw error;
    }
  },

  removeMember: async (roomId: string, userId: string) => {
    try {
      await apiService.removeRoomMember(roomId, userId);
      await get().loadMembers(roomId);
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to remove member' });
      throw error;
    }
  },

  sendMessage: async (roomId: string, content: string, attachments?: string[], _parentMessageId?: string) => {
    try {
      const roomKey = get().roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      // Encrypt message
      const encryptedContent = await cryptoService.encryptRoomMessage(content, roomKey);

      // Determine message type based on attachments
      let messageType = 'text';
      if (attachments && attachments.length > 0) {
        const firstAttachment = attachments[0];
        if (firstAttachment.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          messageType = 'image';
        } else if (firstAttachment.match(/\.(mp4|webm|ogg)$/i)) {
          messageType = 'video';
        } else {
          messageType = 'file';
        }
      }

      // Send via socket (note: backend needs to be updated to support parentMessageId in send_message)
      socketService.sendMessage(roomId, encryptedContent, messageType, attachments);
    } catch (error: any) {
      set({ error: error.message || 'Failed to send message' });
      throw error;
    }
  },

  loadMessages: async (roomId: string) => {
    try {
      const data = await apiService.getRoomMessages(roomId);
      const roomKey = get().roomKeys.get(roomId);

      // Decrypt messages
      if (roomKey) {
        for (const message of data.messages) {
          try {
            const decrypted = await cryptoService.decryptRoomMessage(message.encryptedContent, roomKey);
            (message as any).decryptedContent = decrypted;
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            (message as any).decryptedContent = '[Encrypted]';
          }
        }
      }

      get().messages.set(roomId, data.messages.reverse());
      set({ messages: new Map(get().messages) });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to load messages' });
    }
  },

  loadMembers: async (roomId: string) => {
    try {
      const data = await apiService.getRoomMembers(roomId);
      get().members.set(roomId, data.members);
      set({ members: new Map(get().members) });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to load members' });
    }
  },

  addMessage: async (message: Message) => {
    const roomKey = get().roomKeys.get(message.roomId);
    if (roomKey) {
      try {
        const decrypted = await cryptoService.decryptRoomMessage(message.encryptedContent, roomKey);
        (message as any).decryptedContent = decrypted;
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        (message as any).decryptedContent = '[Encrypted]';
      }
    }

    const roomMessages = get().messages.get(message.roomId) || [];
    roomMessages.push(message);
    get().messages.set(message.roomId, roomMessages);
    set({ messages: new Map(get().messages) });
  },

  addReaction: (messageId: string, roomId: string, emoji: string) => {
    socketService.addReaction(messageId, roomId, emoji);

    // Optimistic update
    const roomMessages = get().messages.get(roomId);
    if (roomMessages) {
      const updatedMessages = roomMessages.map((msg) => {
        if (msg.id === messageId) {
          const metadata = msg.metadata || {};
          const reactions = (metadata as any).reactions || {};
          if (!reactions[emoji]) {
            reactions[emoji] = [];
          }
          if (!reactions[emoji].includes(get().currentRoom?.id || '')) {
            reactions[emoji].push(get().currentRoom?.id || '');
          }
          return { ...msg, metadata: { ...metadata, reactions } };
        }
        return msg;
      });
      get().messages.set(roomId, updatedMessages);
      set({ messages: new Map(get().messages) });
    }
  },

  removeReaction: (messageId: string, roomId: string, emoji: string) => {
    socketService.removeReaction(messageId, roomId, emoji);

    // Optimistic update
    const roomMessages = get().messages.get(roomId);
    if (roomMessages) {
      const updatedMessages = roomMessages.map((msg) => {
        if (msg.id === messageId) {
          const metadata = msg.metadata || {};
          const reactions = (metadata as any).reactions || {};
          if (reactions[emoji]) {
            reactions[emoji] = reactions[emoji].filter((id: string) => id !== get().currentRoom?.id);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          }
          return { ...msg, metadata: { ...metadata, reactions } };
        }
        return msg;
      });
      get().messages.set(roomId, updatedMessages);
      set({ messages: new Map(get().messages) });
    }
  },

  editMessage: async (messageId: string, roomId: string, content: string) => {
    try {
      const roomKey = get().roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('Room encryption key not found');
      }

      // Encrypt new content
      const encryptedContent = await cryptoService.encryptRoomMessage(content, roomKey);

      // Send edit via socket
      socketService.editMessage(messageId, roomId, encryptedContent);

      // Optimistic update
      const roomMessages = get().messages.get(roomId);
      if (roomMessages) {
        const updatedMessages = roomMessages.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              encryptedContent,
              isEdited: true,
              editedAt: new Date(),
            } as any;
          }
          return msg;
        });
        get().messages.set(roomId, updatedMessages);
        set({ messages: new Map(get().messages) });

        // Decrypt the updated message
        const message = updatedMessages.find(m => m.id === messageId);
        if (message) {
          try {
            const decrypted = await cryptoService.decryptRoomMessage(encryptedContent, roomKey);
            (message as any).decryptedContent = decrypted;
            set({ messages: new Map(get().messages) });
          } catch (error) {
            console.error('Failed to decrypt edited message:', error);
          }
        }
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to edit message' });
      throw error;
    }
  },

  deleteMessage: (messageId: string, roomId: string) => {
    socketService.deleteMessage(messageId, roomId);

    // Optimistic update
    const roomMessages = get().messages.get(roomId);
    if (roomMessages) {
      const updatedMessages = roomMessages.map((msg) => {
        if (msg.id === messageId) {
          return {
            ...msg,
            isDeleted: true,
            deletedAt: new Date(),
          } as any;
        }
        return msg;
      });
      get().messages.set(roomId, updatedMessages);
      set({ messages: new Map(get().messages) });
    }
  },

  markRoomAsRead: (roomId: string) => {
    const roomMessages = get().messages.get(roomId);
    if (roomMessages && roomMessages.length > 0) {
      const lastMessage = roomMessages[roomMessages.length - 1];
      get().lastReadMessageId.set(roomId, lastMessage.id);
      get().unreadCounts.set(roomId, 0);
      set({
        lastReadMessageId: new Map(get().lastReadMessageId),
        unreadCounts: new Map(get().unreadCounts)
      });

      // Emit mark_read event to backend
      socketService.markRead(roomId, lastMessage.id);
    }
  },

  updateUnreadCount: (roomId: string) => {
    const roomMessages = get().messages.get(roomId);
    const lastReadId = get().lastReadMessageId.get(roomId);

    if (!roomMessages || roomMessages.length === 0) {
      get().unreadCounts.set(roomId, 0);
      set({ unreadCounts: new Map(get().unreadCounts) });
      return;
    }

    if (!lastReadId) {
      // Never read any message in this room
      get().unreadCounts.set(roomId, roomMessages.length);
      set({ unreadCounts: new Map(get().unreadCounts) });
      return;
    }

    // Count messages after lastReadId
    const lastReadIndex = roomMessages.findIndex(m => m.id === lastReadId);
    const unreadCount = lastReadIndex >= 0 ? roomMessages.length - lastReadIndex - 1 : roomMessages.length;
    get().unreadCounts.set(roomId, Math.max(0, unreadCount));
    set({ unreadCounts: new Map(get().unreadCounts) });
  },

  getTotalUnreadCount: () => {
    let total = 0;
    get().unreadCounts.forEach(count => {
      total += count;
    });
    return total;
  },

  addUploadProgress: (upload: UploadProgress) => {
    get().uploadProgress.set(upload.id, upload);
    set({ uploadProgress: new Map(get().uploadProgress) });
  },

  updateUploadProgress: (id: string, progress: number) => {
    const upload = get().uploadProgress.get(id);
    if (upload) {
      upload.progress = progress;
      get().uploadProgress.set(id, upload);
      set({ uploadProgress: new Map(get().uploadProgress) });
    }
  },

  removeUploadProgress: (id: string) => {
    get().uploadProgress.delete(id);
    set({ uploadProgress: new Map(get().uploadProgress) });
  },

  setUploadStatus: (id: string, status: 'uploading' | 'complete' | 'failed') => {
    const upload = get().uploadProgress.get(id);
    if (upload) {
      upload.status = status;
      get().uploadProgress.set(id, upload);
      set({ uploadProgress: new Map(get().uploadProgress) });
    }
  },

  clearError: () => set({ error: null }),
}));

// Listen to socket messages
socketService.on('message', (message: Message) => {
  const state = useChatStore.getState();
  state.addMessage(message);

  // Update unread count if message is not in current room
  if (state.currentRoom?.id !== message.roomId) {
    state.updateUnreadCount(message.roomId);
  }
});

// Listen to reaction events
socketService.on('reaction_added', async (data: { messageId: string; userId: string; emoji: string; roomId: string }) => {
  const state = useChatStore.getState();
  const roomMessages = state.messages.get(data.roomId);

  if (roomMessages) {
    const updatedMessages = roomMessages.map((msg) => {
      if (msg.id === data.messageId) {
        const metadata = msg.metadata || {};
        const reactions = (metadata as any).reactions || {};
        if (!reactions[data.emoji]) {
          reactions[data.emoji] = [];
        }
        if (!reactions[data.emoji].includes(data.userId)) {
          reactions[data.emoji].push(data.userId);
        }
        return { ...msg, metadata: { ...metadata, reactions } };
      }
      return msg;
    });
    state.messages.set(data.roomId, updatedMessages);
    useChatStore.setState({ messages: new Map(state.messages) });
  }
});

socketService.on('reaction_removed', (data: { messageId: string; userId: string; emoji: string; roomId: string }) => {
  const state = useChatStore.getState();
  const roomMessages = state.messages.get(data.roomId);

  if (roomMessages) {
    const updatedMessages = roomMessages.map((msg) => {
      if (msg.id === data.messageId) {
        const metadata = msg.metadata || {};
        const reactions = (metadata as any).reactions || {};
        if (reactions[data.emoji]) {
          reactions[data.emoji] = reactions[data.emoji].filter((id: string) => id !== data.userId);
          if (reactions[data.emoji].length === 0) {
            delete reactions[data.emoji];
          }
        }
        return { ...msg, metadata: { ...metadata, reactions } };
      }
      return msg;
    });
    state.messages.set(data.roomId, updatedMessages);
    useChatStore.setState({ messages: new Map(state.messages) });
  }
});

// Listen to message edit events
socketService.on('message_edited', async (data: { messageId: string; roomId: string; encryptedContent: string; editedAt: Date }) => {
  const state = useChatStore.getState();
  const roomMessages = state.messages.get(data.roomId);
  const roomKey = state.roomKeys.get(data.roomId);

  if (roomMessages && roomKey) {
    const updatedMessages = roomMessages.map((msg) => {
      if (msg.id === data.messageId) {
        return {
          ...msg,
          encryptedContent: data.encryptedContent,
          isEdited: true,
          editedAt: data.editedAt,
        } as any;
      }
      return msg;
    });
    state.messages.set(data.roomId, updatedMessages);
    useChatStore.setState({ messages: new Map(state.messages) });

    // Decrypt the updated message
    const message = updatedMessages.find(m => m.id === data.messageId);
    if (message) {
      try {
        const { cryptoService } = await import('../services/crypto');
        const decrypted = await cryptoService.decryptRoomMessage(data.encryptedContent, roomKey);
        (message as any).decryptedContent = decrypted;
        useChatStore.setState({ messages: new Map(state.messages) });
      } catch (error) {
        console.error('Failed to decrypt edited message:', error);
      }
    }
  }
});

// Listen to message delete events
socketService.on('message_deleted', (data: { messageId: string; roomId: string }) => {
  const state = useChatStore.getState();
  const roomMessages = state.messages.get(data.roomId);

  if (roomMessages) {
    const updatedMessages = roomMessages.map((msg) => {
      if (msg.id === data.messageId) {
        return {
          ...msg,
          isDeleted: true,
          deletedAt: new Date(),
        } as any;
      }
      return msg;
    });
    state.messages.set(data.roomId, updatedMessages);
    useChatStore.setState({ messages: new Map(state.messages) });
  }
});

// Listen to typing events
socketService.on('user_typing', (data: { userId: string; username: string; roomId: string; isTyping: boolean }) => {
  const state = useChatStore.getState();

  if (!state.typingUsers.has(data.roomId)) {
    state.typingUsers.set(data.roomId, new Map());
  }

  const roomTypingUsers = state.typingUsers.get(data.roomId)!;

  if (data.isTyping) {
    roomTypingUsers.set(data.userId, data.username);
  } else {
    roomTypingUsers.delete(data.userId);
  }

  useChatStore.setState({ typingUsers: new Map(state.typingUsers) });
});
