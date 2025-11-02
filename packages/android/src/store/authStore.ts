import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/ApiService';
import { torService } from '../services/TorService';
import { AuthUser, AuthState, LoginParams, RegisterParams, AuthResponse } from '../types/Auth';
import { Server } from '../types/Server';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  activeServer: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  /**
   * Login with server selection
   * Routes request through TOR if server is configured
   */
  login: async (params: LoginParams) => {
    set({ isLoading: true, error: null });
    try {
      const { username, password, server } = params;

      // Set active server for API routing
      apiService.setServer(server);

      // Ensure TOR is connected if using .onion address
      if (server && !torService.isReady()) {
        const torConnected = await torService.start();
        if (!torConnected) {
          throw new Error('Failed to connect to TOR network. Please ensure Orbot is running.');
        }
      }

      // Make login request through ApiService
      const response: AuthResponse = await apiService.post('/auth/login', {
        username,
        password,
      });

      const { token, user } = response;

      // Store token and server info
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('activeServerId', server.id);
      await AsyncStorage.setItem('activeServer', JSON.stringify(server));

      set({
        user,
        token,
        activeServer: server,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const errorMessage = error.error || error.message || 'Login failed';
      const detailedMessage = error.message || 'Please check your credentials and connection';

      set({
        error: `${errorMessage}: ${detailedMessage}`,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Register with server selection
   * Routes request through TOR if server is configured
   */
  register: async (params: RegisterParams) => {
    set({ isLoading: true, error: null });
    try {
      const { username, email, password, displayName, server } = params;

      // Set active server for API routing
      apiService.setServer(server);

      // Ensure TOR is connected if using .onion address
      if (server && !torService.isReady()) {
        const torConnected = await torService.start();
        if (!torConnected) {
          throw new Error('Failed to connect to TOR network. Please ensure Orbot is running.');
        }
      }

      // Make registration request through ApiService
      const response: AuthResponse = await apiService.post('/auth/register', {
        username,
        email,
        password,
        displayName,
      });

      const { token, user } = response;

      // Store token and server info
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('activeServerId', server.id);
      await AsyncStorage.setItem('activeServer', JSON.stringify(server));

      set({
        user,
        token,
        activeServer: server,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const errorMessage = error.error || error.message || 'Registration failed';
      const detailedMessage = error.message || 'Please try again';

      set({
        error: `${errorMessage}: ${detailedMessage}`,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Logout and clear session
   */
  logout: async () => {
    try {
      // Clear stored data
      await AsyncStorage.multiRemove(['token', 'activeServerId', 'activeServer']);

      // Clear API service token
      await apiService.setToken(null);

      // Reset state
      set({
        user: null,
        token: null,
        activeServer: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even on error
      set({
        user: null,
        token: null,
        activeServer: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },

  /**
   * Load user from stored token
   * Restores session if valid token exists
   */
  loadUser: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const activeServerJson = await AsyncStorage.getItem('activeServer');

      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      // Restore active server if available
      let activeServer: Server | null = null;
      if (activeServerJson) {
        try {
          activeServer = JSON.parse(activeServerJson);
          apiService.setServer(activeServer);

          // Initialize TOR if using onion address
          if (activeServer && !torService.isReady()) {
            await torService.start().catch((err) => {
              console.warn('TOR initialization failed:', err);
              // Continue without TOR (will fallback to direct connection)
            });
          }
        } catch (error) {
          console.error('Failed to parse active server:', error);
        }
      }

      // Fetch current user info
      const response = await apiService.get<{ user: User }>('/auth/me');

      set({
        user: response.user,
        token,
        activeServer,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Load user error:', error);
      // Clear invalid session
      await AsyncStorage.multiRemove(['token', 'activeServerId', 'activeServer']);
      set({
        user: null,
        token: null,
        activeServer: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  /**
   * Set active server
   * Updates API service to route requests to the new server
   */
  setActiveServer: (server: Server | null) => {
    apiService.setServer(server);
    set({ activeServer: server });

    // Store server preference
    if (server) {
      AsyncStorage.setItem('activeServerId', server.id);
      AsyncStorage.setItem('activeServer', JSON.stringify(server));
    } else {
      AsyncStorage.multiRemove(['activeServerId', 'activeServer']);
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },
}));
