export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: Date;
  isAdmin: boolean;
  isBanned?: boolean;
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
  messageType: 'text' | 'file' | 'image' | 'video' | 'system';
  metadata?: Record<string, any>;
  attachments?: string[];
  parentMessageId?: string;
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  status?: 'sending' | 'sent' | 'failed';
  createdAt: Date;
}

export interface MessageReactions {
  [emoji: string]: string[];
}

export interface RoomMember {
  id: string;
  roomId: string;
  user: User;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
}

export interface UploadProgress {
  id: string;
  filename: string;
  size: number;
  progress: number;
  status: 'uploading' | 'complete' | 'failed';
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}
