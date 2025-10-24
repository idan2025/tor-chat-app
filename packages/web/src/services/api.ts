import axios, { AxiosInstance } from 'axios';
import { User, Room, Message, RoomMember } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Auth endpoints
  async register(username: string, email: string, password: string, displayName?: string) {
    const response = await this.api.post('/auth/register', {
      username,
      email,
      password,
      displayName,
    });
    return response.data;
  }

  async login(username: string, password: string) {
    const response = await this.api.post('/auth/login', { username, password });
    return response.data;
  }

  async logout() {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  async getMe(): Promise<{ user: User }> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // Room endpoints
  async getRooms(): Promise<{ rooms: Room[] }> {
    const response = await this.api.get('/rooms');
    return response.data;
  }

  async getRoom(roomId: string): Promise<{ room: Room }> {
    const response = await this.api.get(`/rooms/${roomId}`);
    return response.data;
  }

  async createRoom(data: {
    name: string;
    description?: string;
    type?: 'public' | 'private';
    maxMembers?: number;
  }): Promise<{ room: Room }> {
    const response = await this.api.post('/rooms', data);
    return response.data;
  }

  async joinRoom(roomId: string): Promise<{ room: Room }> {
    const response = await this.api.post(`/rooms/${roomId}/join`);
    return response.data;
  }

  async leaveRoom(roomId: string) {
    const response = await this.api.post(`/rooms/${roomId}/leave`);
    return response.data;
  }

  async getRoomMessages(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: Message[] }> {
    const response = await this.api.get(`/rooms/${roomId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async getRoomMembers(roomId: string): Promise<{ members: RoomMember[] }> {
    const response = await this.api.get(`/rooms/${roomId}/members`);
    return response.data;
  }

  // TOR status
  async getTorStatus() {
    const response = await this.api.get('/tor-status');
    return response.data;
  }
}

export const apiService = new ApiService();
