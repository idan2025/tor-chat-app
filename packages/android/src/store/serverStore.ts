import { create } from 'zustand';
import { Server, ConnectionStatus, validateOnionAddress } from '../types/Server';
import { serverStorage } from '../services/ServerStorage';

interface ServerState {
  servers: Server[];
  activeServer: Server | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadServers: () => Promise<void>;
  addServer: (name: string, onionAddress: string) => Promise<Server>;
  deleteServer: (serverId: string) => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
  updateServerStatus: (
    serverId: string,
    status: ConnectionStatus,
    error?: string,
    bootstrapProgress?: number
  ) => Promise<void>;
  updateServerAuth: (
    serverId: string,
    token: string,
    user: Server['user']
  ) => Promise<void>;
  clearError: () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServer: null,
  isLoading: false,
  error: null,

  /**
   * Load all servers from storage
   */
  loadServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const servers = await serverStorage.getAllServers();
      const activeServer = await serverStorage.getActiveServer();

      set({
        servers,
        activeServer,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load servers',
        isLoading: false,
      });
      console.error('Failed to load servers:', error);
    }
  },

  /**
   * Add a new server
   */
  addServer: async (name: string, onionAddress: string) => {
    set({ isLoading: true, error: null });

    try {
      // Validate onion address
      if (!validateOnionAddress(onionAddress)) {
        throw new Error('Invalid .onion address format');
      }

      // Check if server already exists
      const existingServers = get().servers;
      const duplicate = existingServers.find(
        (s) => s.onionAddress.toLowerCase() === onionAddress.toLowerCase()
      );

      if (duplicate) {
        throw new Error('Server with this address already exists');
      }

      // Create new server
      const newServer: Server = {
        id: Date.now().toString(),
        name: name.trim() || onionAddress.split('.')[0],
        onionAddress: onionAddress.toLowerCase().trim(),
        isActive: false,
        lastConnected: null,
        connectionStatus: ConnectionStatus.DISCONNECTED,
      };

      // Save to storage
      await serverStorage.saveServer(newServer);

      // Update state
      set((state) => ({
        servers: [...state.servers, newServer],
        isLoading: false,
      }));

      return newServer;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to add server',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Delete a server
   */
  deleteServer: async (serverId: string) => {
    set({ isLoading: true, error: null });

    try {
      await serverStorage.deleteServer(serverId);

      set((state) => {
        const newServers = state.servers.filter((s) => s.id !== serverId);
        const newActiveServer =
          state.activeServer?.id === serverId ? null : state.activeServer;

        return {
          servers: newServers,
          activeServer: newActiveServer,
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete server',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Switch to a different server
   */
  switchServer: async (serverId: string) => {
    set({ isLoading: true, error: null });

    try {
      await serverStorage.setActiveServer(serverId);

      const server = await serverStorage.getServerById(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      set((state) => ({
        servers: state.servers.map((s) => ({
          ...s,
          isActive: s.id === serverId,
        })),
        activeServer: server,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to switch server',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update server connection status
   */
  updateServerStatus: async (
    serverId: string,
    status: ConnectionStatus,
    error?: string,
    bootstrapProgress?: number
  ) => {
    try {
      await serverStorage.updateServerStatus(
        serverId,
        status,
        error,
        bootstrapProgress
      );

      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                connectionStatus: status,
                connectionError: error,
                bootstrapProgress,
                lastConnected:
                  status === ConnectionStatus.CONNECTED
                    ? new Date()
                    : s.lastConnected,
              }
            : s
        ),
        activeServer:
          state.activeServer?.id === serverId
            ? {
                ...state.activeServer,
                connectionStatus: status,
                connectionError: error,
                bootstrapProgress,
                lastConnected:
                  status === ConnectionStatus.CONNECTED
                    ? new Date()
                    : state.activeServer.lastConnected,
              }
            : state.activeServer,
      }));
    } catch (error: any) {
      console.error('Failed to update server status:', error);
    }
  },

  /**
   * Update server authentication info
   */
  updateServerAuth: async (
    serverId: string,
    token: string,
    user: Server['user']
  ) => {
    try {
      await serverStorage.updateServerAuth(serverId, token, user);

      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                token,
                user,
              }
            : s
        ),
        activeServer:
          state.activeServer?.id === serverId
            ? {
                ...state.activeServer,
                token,
                user,
              }
            : state.activeServer,
      }));
    } catch (error: any) {
      console.error('Failed to update server auth:', error);
      throw error;
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },
}));
