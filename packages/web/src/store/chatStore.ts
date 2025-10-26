import { create } from 'zustand';
import { Room, Message, RoomMember } from '../types';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { cryptoService } from '../services/crypto';

interface ChatState {
  rooms: Room[];
  currentRoom: Room | null;
  messages: Map<string, Message[]>;
  members: Map<string, RoomMember[]>;
  roomKeys: Map<string, string>;
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
  sendMessage: (roomId: string, content: string, attachments?: string[]) => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  loadMembers: (roomId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  messages: new Map(),
  members: new Map(),
  roomKeys: new Map(),
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

  sendMessage: async (roomId: string, content: string, attachments?: string[]) => {
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

      // Send via socket
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

  clearError: () => set({ error: null }),
}));

// Listen to socket messages
socketService.on('message', (message: Message) => {
  useChatStore.getState().addMessage(message);
});
