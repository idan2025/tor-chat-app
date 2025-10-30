export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  BOOTSTRAPPING = 'bootstrapping',
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  isAdmin: boolean;
}

export interface Server {
  id: string;
  name: string;
  onionAddress: string;
  isActive: boolean;
  lastConnected: Date | null;
  thumbnail?: string;
  userCount?: number;

  // Authentication
  token?: string;
  user?: User;

  // Connection status
  connectionStatus: ConnectionStatus;
  connectionError?: string;
  torCircuitStatus?: string;
  bootstrapProgress?: number;
}

// Helper functions
export function createServer(
  name: string,
  onionAddress: string
): Omit<Server, 'id'> {
  return {
    name,
    onionAddress,
    isActive: false,
    lastConnected: null,
    connectionStatus: ConnectionStatus.DISCONNECTED,
  };
}

export function validateOnionAddress(address: string): boolean {
  // Validate .onion address format
  // v2: 16 characters + .onion
  // v3: 56 characters + .onion
  const v2Regex = /^[a-z2-7]{16}\.onion$/i;
  const v3Regex = /^[a-z2-7]{56}\.onion$/i;

  return v2Regex.test(address) || v3Regex.test(address);
}

export function getServerDisplayName(server: Server): string {
  return server.name || server.onionAddress.split('.')[0];
}

export function isServerConnected(server: Server): boolean {
  return server.connectionStatus === ConnectionStatus.CONNECTED;
}

export function getConnectionStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return '#10b981'; // green
    case ConnectionStatus.CONNECTING:
    case ConnectionStatus.BOOTSTRAPPING:
      return '#f59e0b'; // orange
    case ConnectionStatus.ERROR:
      return '#ef4444'; // red
    case ConnectionStatus.DISCONNECTED:
    default:
      return '#6b7280'; // gray
  }
}

export function getConnectionStatusText(status: ConnectionStatus, bootstrapProgress?: number): string {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return 'Connected';
    case ConnectionStatus.CONNECTING:
      return 'Connecting...';
    case ConnectionStatus.BOOTSTRAPPING:
      return bootstrapProgress !== undefined
        ? `Bootstrapping ${bootstrapProgress}%`
        : 'Bootstrapping...';
    case ConnectionStatus.ERROR:
      return 'Connection Error';
    case ConnectionStatus.DISCONNECTED:
    default:
      return 'Disconnected';
  }
}
