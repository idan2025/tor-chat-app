import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

// Use environment variable if set, otherwise use current origin (for nginx proxy)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('connected', true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.emit('connected', false);
    });

    this.socket.on('message', (data: Message) => {
      this.emit('message', data);
    });

    this.socket.on('user_joined', (data: any) => {
      this.emit('user_joined', data);
    });

    this.socket.on('user_left', (data: any) => {
      this.emit('user_left', data);
    });

    this.socket.on('user_status', (data: any) => {
      this.emit('user_status', data);
    });

    this.socket.on('user_typing', (data: any) => {
      this.emit('user_typing', data);
    });

    this.socket.on('error', (data: any) => {
      this.emit('error', data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId: string): void {
    this.socket?.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string): void {
    this.socket?.emit('leave_room', { roomId });
  }

  sendMessage(roomId: string, encryptedContent: string, messageType: string = 'text'): void {
    this.socket?.emit('send_message', { roomId, encryptedContent, messageType });
  }

  sendTyping(roomId: string, isTyping: boolean): void {
    this.socket?.emit('typing', { roomId, isTyping });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
