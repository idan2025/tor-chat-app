/**
 * TOR Context
 *
 * React Context for managing TOR service state and providing TOR
 * functionality throughout the Android app.
 *
 * This context wraps the TorService singleton and exposes its state
 * and methods to React components via hooks.
 *
 * Usage:
 * 1. Wrap your app with <TorProvider>
 * 2. Use useTor() hook in any component to access TOR state/methods
 *
 * Example:
 * ```tsx
 * function App() {
 *   return (
 *     <TorProvider>
 *       <MyComponent />
 *     </TorProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const { isReady, start, circuits } = useTor();
 *   // ...
 * }
 * ```
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode
} from 'react';
import {
  TorStatus,
  TorContextValue,
  CircuitInfo,
  BootstrapStatus,
  TorError,
  BandwidthStats,
  SocksProxyConfig,
  TorEventType,
  TorEvent
} from '../types/tor';
import { torService, TorService } from '../services/TorService';

/**
 * TOR Context (internal)
 */
const TorContext = createContext<TorContextValue | undefined>(undefined);

/**
 * TOR Provider Props
 */
interface TorProviderProps {
  children: ReactNode;
  autoStart?: boolean; // Auto-start TOR on mount (default: true)
}

/**
 * TOR Provider Component
 *
 * Provides TOR service state and methods to all child components.
 * Automatically starts TOR on mount unless autoStart is false.
 */
export function TorProvider({ children, autoStart = true }: TorProviderProps) {
  // State
  const [status, setStatus] = useState<TorStatus>(torService.getStatus());
  const [bootstrapProgress, setBootstrapProgress] = useState<number>(
    torService.getBootstrapProgress()
  );
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(
    torService.getBootstrapStatus()
  );
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [error, setError] = useState<TorError | null>(torService.getError());
  const [bandwidth, setBandwidth] = useState<BandwidthStats | null>(null);
  const [socksProxy, setSocksProxy] = useState<SocksProxyConfig | null>(
    torService.getSocksProxy()
  );

  // Derived state
  const isBootstrapping = status === TorStatus.BOOTSTRAPPING;
  const isReady = status === TorStatus.READY;

  /**
   * Handle TOR events
   */
  const handleTorEvent = useCallback((event: TorEvent) => {
    switch (event.type) {
      case TorEventType.STATUS_CHANGED:
        setStatus(event.data.status);
        // Update SOCKS proxy when status changes to ready
        if (event.data.status === TorStatus.READY) {
          setSocksProxy(torService.getSocksProxy());
        } else {
          setSocksProxy(null);
        }
        break;

      case TorEventType.BOOTSTRAP_PROGRESS:
        setBootstrapProgress(event.data.progress);
        setBootstrapStatus(event.data.status);
        break;

      case TorEventType.CIRCUIT_BUILT:
        setCircuits(event.data.circuits);
        break;

      case TorEventType.CONNECTION_ERROR:
        setError(event.data.error);
        break;

      case TorEventType.BANDWIDTH_UPDATE:
        setBandwidth(event.data.bandwidth);
        break;

      default:
        // Ignore unknown event types
        break;
    }
  }, []);

  /**
   * Setup event listeners on mount
   */
  useEffect(() => {
    // Register event listeners
    torService.addEventListener(TorEventType.STATUS_CHANGED, handleTorEvent);
    torService.addEventListener(TorEventType.BOOTSTRAP_PROGRESS, handleTorEvent);
    torService.addEventListener(TorEventType.CIRCUIT_BUILT, handleTorEvent);
    torService.addEventListener(TorEventType.CONNECTION_ERROR, handleTorEvent);
    torService.addEventListener(TorEventType.BANDWIDTH_UPDATE, handleTorEvent);

    // Auto-start TOR if enabled
    if (autoStart) {
      console.log('[TorContext] Auto-starting TOR...');
      startTor();
    }

    // Cleanup on unmount
    return () => {
      torService.removeEventListener(TorEventType.STATUS_CHANGED, handleTorEvent);
      torService.removeEventListener(TorEventType.BOOTSTRAP_PROGRESS, handleTorEvent);
      torService.removeEventListener(TorEventType.CIRCUIT_BUILT, handleTorEvent);
      torService.removeEventListener(TorEventType.CONNECTION_ERROR, handleTorEvent);
      torService.removeEventListener(TorEventType.BANDWIDTH_UPDATE, handleTorEvent);
    };
  }, [autoStart, handleTorEvent]);

  /**
   * Start TOR service
   */
  const startTor = useCallback(async () => {
    try {
      await torService.start();
    } catch (error) {
      console.error('[TorContext] Failed to start TOR:', error);
      // Error is already handled by torService and exposed via context
    }
  }, []);

  /**
   * Stop TOR service
   */
  const stopTor = useCallback(async () => {
    try {
      await torService.stop();
    } catch (error) {
      console.error('[TorContext] Failed to stop TOR:', error);
    }
  }, []);

  /**
   * Restart TOR service
   */
  const restartTor = useCallback(async () => {
    try {
      await torService.restart();
    } catch (error) {
      console.error('[TorContext] Failed to restart TOR:', error);
    }
  }, []);

  /**
   * Get SOCKS proxy configuration
   */
  const getSocksProxy = useCallback((): SocksProxyConfig | null => {
    return socksProxy;
  }, [socksProxy]);

  /**
   * Get circuit information
   */
  const getCircuitInfo = useCallback(async (): Promise<CircuitInfo[]> => {
    try {
      const info = await torService.getCircuitInfo();
      setCircuits(info);
      return info;
    } catch (error) {
      console.error('[TorContext] Failed to get circuit info:', error);
      return [];
    }
  }, []);

  /**
   * Request new circuit (change identity)
   */
  const newCircuit = useCallback(async () => {
    try {
      await torService.newCircuit();
    } catch (error) {
      console.error('[TorContext] Failed to create new circuit:', error);
    }
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    torService.clearError();
    setError(null);
  }, []);

  /**
   * Context value
   */
  const contextValue: TorContextValue = {
    // State
    status,
    isBootstrapping,
    isReady,
    bootstrapProgress,
    bootstrapStatus,
    circuits,
    error,
    bandwidth,
    socksProxy,

    // Methods
    start: startTor,
    stop: stopTor,
    restart: restartTor,
    getSocksProxy,
    getCircuitInfo,
    newCircuit,
    clearError
  };

  return (
    <TorContext.Provider value={contextValue}>
      {children}
    </TorContext.Provider>
  );
}

/**
 * Use TOR Hook
 *
 * Hook to access TOR service state and methods from any component.
 *
 * @throws {Error} If used outside of TorProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, start, error } = useTor();
 *
 *   useEffect(() => {
 *     if (!isReady) {
 *       start();
 *     }
 *   }, [isReady, start]);
 *
 *   if (error) {
 *     return <ErrorMessage error={error} />;
 *   }
 *
 *   return <YourComponent />;
 * }
 * ```
 */
export function useTor(): TorContextValue {
  const context = useContext(TorContext);

  if (context === undefined) {
    throw new Error('useTor must be used within a TorProvider');
  }

  return context;
}

/**
 * Export TOR Context (for advanced use cases)
 */
export { TorContext };

/**
 * Export types
 */
export type { TorProviderProps, TorContextValue };
