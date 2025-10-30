import AsyncStorage from '@react-native-async-storage/async-storage';
import { Server, ConnectionStatus } from '../types/Server';

const SERVERS_KEY = '@tor-chat:servers';
const ACTIVE_SERVER_KEY = '@tor-chat:active-server';

export class ServerStorage {
  /**
   * Save or update a server
   */
  async saveServer(server: Server): Promise<void> {
    try {
      const servers = await this.getAllServers();
      const existingIndex = servers.findIndex((s) => s.id === server.id);

      if (existingIndex >= 0) {
        // Update existing server
        servers[existingIndex] = server;
      } else {
        // Add new server
        servers.push(server);
      }

      await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
    } catch (error) {
      console.error('Failed to save server:', error);
      throw new Error('Failed to save server to storage');
    }
  }

  /**
   * Get all saved servers
   */
  async getAllServers(): Promise<Server[]> {
    try {
      const data = await AsyncStorage.getItem(SERVERS_KEY);
      if (!data) {
        return [];
      }

      const servers: Server[] = JSON.parse(data);

      // Convert date strings back to Date objects
      return servers.map((server) => ({
        ...server,
        lastConnected: server.lastConnected
          ? new Date(server.lastConnected)
          : null,
      }));
    } catch (error) {
      console.error('Failed to load servers:', error);
      return [];
    }
  }

  /**
   * Get a server by ID
   */
  async getServerById(serverId: string): Promise<Server | null> {
    try {
      const servers = await this.getAllServers();
      return servers.find((s) => s.id === serverId) || null;
    } catch (error) {
      console.error('Failed to get server:', error);
      return null;
    }
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<void> {
    try {
      const servers = await this.getAllServers();
      const filtered = servers.filter((s) => s.id !== serverId);
      await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(filtered));

      // If the deleted server was active, clear active server
      const activeServerId = await AsyncStorage.getItem(ACTIVE_SERVER_KEY);
      if (activeServerId === serverId) {
        await AsyncStorage.removeItem(ACTIVE_SERVER_KEY);
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
      throw new Error('Failed to delete server from storage');
    }
  }

  /**
   * Set the active server
   */
  async setActiveServer(serverId: string): Promise<void> {
    try {
      // Verify server exists
      const server = await this.getServerById(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      await AsyncStorage.setItem(ACTIVE_SERVER_KEY, serverId);

      // Update all servers to mark the active one
      const servers = await this.getAllServers();
      const updatedServers = servers.map((s) => ({
        ...s,
        isActive: s.id === serverId,
      }));
      await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(updatedServers));
    } catch (error) {
      console.error('Failed to set active server:', error);
      throw new Error('Failed to set active server');
    }
  }

  /**
   * Get the currently active server
   */
  async getActiveServer(): Promise<Server | null> {
    try {
      const serverId = await AsyncStorage.getItem(ACTIVE_SERVER_KEY);
      if (!serverId) {
        return null;
      }

      return await this.getServerById(serverId);
    } catch (error) {
      console.error('Failed to get active server:', error);
      return null;
    }
  }

  /**
   * Update server connection status
   */
  async updateServerStatus(
    serverId: string,
    status: ConnectionStatus,
    error?: string,
    bootstrapProgress?: number
  ): Promise<void> {
    try {
      const servers = await this.getAllServers();
      const serverIndex = servers.findIndex((s) => s.id === serverId);

      if (serverIndex >= 0) {
        servers[serverIndex].connectionStatus = status;
        servers[serverIndex].connectionError = error;
        servers[serverIndex].bootstrapProgress = bootstrapProgress;

        if (status === ConnectionStatus.CONNECTED) {
          servers[serverIndex].lastConnected = new Date();
        }

        await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
      }
    } catch (error) {
      console.error('Failed to update server status:', error);
    }
  }

  /**
   * Update server authentication info
   */
  async updateServerAuth(
    serverId: string,
    token: string,
    user: Server['user']
  ): Promise<void> {
    try {
      const servers = await this.getAllServers();
      const serverIndex = servers.findIndex((s) => s.id === serverId);

      if (serverIndex >= 0) {
        servers[serverIndex].token = token;
        servers[serverIndex].user = user;
        await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
      }
    } catch (error) {
      console.error('Failed to update server auth:', error);
      throw new Error('Failed to update server authentication');
    }
  }

  /**
   * Clear all servers (use with caution)
   */
  async clearAllServers(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SERVERS_KEY);
      await AsyncStorage.removeItem(ACTIVE_SERVER_KEY);
    } catch (error) {
      console.error('Failed to clear servers:', error);
      throw new Error('Failed to clear all servers');
    }
  }
}

// Export singleton instance
export const serverStorage = new ServerStorage();
