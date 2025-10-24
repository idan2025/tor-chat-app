export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  encryptionKey?: string;
  creatorId: string;
  maxMembers?: number;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  sender: User;
  encryptedContent: string;
  messageType: 'text' | 'file' | 'image' | 'system';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RoomMember {
  id: string;
  roomId: string;
  user: User;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
}
