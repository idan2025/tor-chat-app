/**
 * User entity representing authenticated user data
 */
export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  publicKey: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Authentication state interface for Zustand store
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  activeServer: Server | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setActiveServer: (server: Server | null) => void;
  clearError: () => void;
}

/**
 * Login parameters including server selection
 */
export interface LoginParams {
  username: string;
  password: string;
  server: Server;
}

/**
 * Registration parameters including server selection
 */
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  server: Server;
}

/**
 * Server configuration for multi-server support
 */
export interface Server {
  id: string;
  name: string;
  onionAddress: string;
  description?: string;
  isDefault?: boolean;
  lastConnected?: string;
  createdAt?: string;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Error response from API
 */
export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}
