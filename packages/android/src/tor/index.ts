/**
 * TOR Integration - Main Export File
 *
 * This file provides a single entry point for all TOR-related
 * functionality. Import what you need from this file.
 *
 * @example
 * ```typescript
 * import { useTor, TorProvider, TorStatus } from './tor';
 * ```
 */

// ============================================================================
// Service
// ============================================================================

export { TorService, torService } from '../services/TorService';

// ============================================================================
// Context & Hooks
// ============================================================================

export { TorProvider, useTor, TorContext } from '../contexts/TorContext';
export type { TorProviderProps, TorContextValue } from '../contexts/TorContext';

// ============================================================================
// Components
// ============================================================================

export { TorStatus } from '../components/TorStatus';

// ============================================================================
// Network Utilities
// ============================================================================

export {
  createHttpClient,
  createWebSocketClient,
  createSocksAdapter,
  createSocksAgent,
  validateOnionAddress,
  formatOnionUrl,
  isOnionAddress,
  getNetworkErrorMessage,
  testConnection
} from '../utils/network';

export type {
  HttpClientConfig,
  WebSocketClientConfig
} from '../utils/network';

// ============================================================================
// Types
// ============================================================================

export {
  TorStatus as TorStatusEnum,
  TorErrorType,
  TorEventType
} from '../types/tor';

export type {
  TorConfig,
  TorError,
  BootstrapStatus,
  CircuitInfo,
  CircuitNode,
  BandwidthStats,
  SocksProxyConfig,
  TorEvent,
  TorServiceState,
  TorServiceMethods
} from '../types/tor';

// ============================================================================
// Default Export
// ============================================================================

import { torService } from '../services/TorService';
import { TorProvider, useTor } from '../contexts/TorContext';
import { TorStatus } from '../components/TorStatus';
import * as networkUtils from '../utils/network';

export default {
  // Service
  service: torService,

  // React
  Provider: TorProvider,
  useTor,
  Status: TorStatus,

  // Network
  network: networkUtils
};
