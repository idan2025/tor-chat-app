/**
 * TOR Service Types and Interfaces
 *
 * This file contains all TypeScript types and interfaces for the TOR service
 * integration in the Android app.
 */

/**
 * TOR connection status enum
 */
export enum TorStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  BOOTSTRAPPING = 'bootstrapping',
  READY = 'ready',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

/**
 * TOR bootstrap status
 */
export interface BootstrapStatus {
  progress: number; // 0-100
  tag: string; // Bootstrap phase tag (e.g., "conn_or", "handshake", "circuit_create")
  summary: string; // Human-readable description
  warning?: string; // Optional warning message
  recommendation?: string; // Optional recommendation
}

/**
 * TOR circuit information
 */
export interface CircuitInfo {
  id: string;
  status: 'built' | 'building' | 'failed' | 'closed';
  path: CircuitNode[];
  purpose: string; // "general", "hs_client_intro", "hs_service", etc.
  buildTime?: number; // Time to build circuit in ms
  bytes: {
    sent: number;
    received: number;
  };
}

/**
 * Node in a TOR circuit
 */
export interface CircuitNode {
  fingerprint: string;
  nickname: string;
  country: string;
  ip: string;
}

/**
 * TOR service configuration
 */
export interface TorConfig {
  socksPort: number; // SOCKS5 proxy port (default: 9050)
  controlPort: number; // Control port (default: 9051)
  dataDirectory?: string; // Data directory for TOR
  enableLogging?: boolean; // Enable TOR logs
  bridgeMode?: boolean; // Use bridges for censored networks
  bridges?: string[]; // Bridge addresses if bridgeMode is true
  exitNodes?: string[]; // Preferred exit nodes
  entryNodes?: string[]; // Preferred entry nodes
}

/**
 * TOR connection error types
 */
export enum TorErrorType {
  BOOTSTRAP_TIMEOUT = 'bootstrap_timeout',
  CONNECTION_FAILED = 'connection_failed',
  SOCKS_PROXY_ERROR = 'socks_proxy_error',
  CIRCUIT_TIMEOUT = 'circuit_timeout',
  NETWORK_UNREACHABLE = 'network_unreachable',
  PERMISSION_DENIED = 'permission_denied',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * TOR service error
 */
export interface TorError {
  type: TorErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  recoverable: boolean; // Whether error can be recovered by retry
}

/**
 * TOR service event types
 */
export enum TorEventType {
  STATUS_CHANGED = 'status_changed',
  BOOTSTRAP_PROGRESS = 'bootstrap_progress',
  CIRCUIT_BUILT = 'circuit_built',
  CIRCUIT_FAILED = 'circuit_failed',
  CONNECTION_ERROR = 'connection_error',
  BANDWIDTH_UPDATE = 'bandwidth_update'
}

/**
 * TOR service event
 */
export interface TorEvent {
  type: TorEventType;
  timestamp: Date;
  data?: any;
}

/**
 * TOR bandwidth statistics
 */
export interface BandwidthStats {
  read: number; // Bytes read
  written: number; // Bytes written
  rate: {
    read: number; // Bytes per second
    write: number; // Bytes per second
  };
}

/**
 * SOCKS5 proxy configuration
 */
export interface SocksProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * TOR service state (for React Context)
 */
export interface TorServiceState {
  status: TorStatus;
  isBootstrapping: boolean;
  isReady: boolean;
  bootstrapProgress: number;
  bootstrapStatus: BootstrapStatus | null;
  circuits: CircuitInfo[];
  error: TorError | null;
  bandwidth: BandwidthStats | null;
  socksProxy: SocksProxyConfig | null;
}

/**
 * TOR service methods (for React Context)
 */
export interface TorServiceMethods {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  getSocksProxy: () => SocksProxyConfig | null;
  getCircuitInfo: () => Promise<CircuitInfo[]>;
  newCircuit: () => Promise<void>;
  clearError: () => void;
}

/**
 * Complete TOR context value
 */
export interface TorContextValue extends TorServiceState, TorServiceMethods {}
