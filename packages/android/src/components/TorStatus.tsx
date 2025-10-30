/**
 * TOR Status Component
 *
 * Displays the current TOR connection status, bootstrap progress,
 * and circuit information. Shows loading indicators, error messages,
 * and provides actions for reconnection.
 *
 * Features:
 * - Bootstrap progress bar
 * - Connection status indicator
 * - Circuit information display
 * - Error handling with retry
 * - Expandable/collapsible design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated
} from 'react-native';
import { useTor } from '../contexts/TorContext';
import { TorStatus as TorStatusEnum, TorErrorType } from '../types/tor';

/**
 * Component Props
 */
interface TorStatusProps {
  compact?: boolean; // Show compact version (default: false)
  showCircuits?: boolean; // Show circuit information (default: true)
  onDismiss?: () => void; // Callback when user dismisses the status
}

/**
 * TOR Status Component
 */
export function TorStatus({
  compact = false,
  showCircuits = true,
  onDismiss
}: TorStatusProps) {
  const {
    status,
    isBootstrapping,
    isReady,
    bootstrapProgress,
    bootstrapStatus,
    circuits,
    error,
    restart,
    clearError
  } = useTor();

  const [isExpanded, setIsExpanded] = useState(!compact);

  /**
   * Get status color based on current state
   */
  const getStatusColor = (): string => {
    switch (status) {
      case TorStatusEnum.READY:
        return '#10b981'; // Green
      case TorStatusEnum.BOOTSTRAPPING:
      case TorStatusEnum.STARTING:
        return '#f59e0b'; // Orange
      case TorStatusEnum.ERROR:
        return '#ef4444'; // Red
      case TorStatusEnum.STOPPED:
      default:
        return '#6b7280'; // Gray
    }
  };

  /**
   * Get status text
   */
  const getStatusText = (): string => {
    if (error) {
      return `Error: ${error.message}`;
    }

    switch (status) {
      case TorStatusEnum.READY:
        return 'Connected to TOR network';
      case TorStatusEnum.BOOTSTRAPPING:
        return bootstrapStatus?.summary || 'Connecting...';
      case TorStatusEnum.STARTING:
        return 'Starting TOR service...';
      case TorStatusEnum.RECONNECTING:
        return 'Reconnecting...';
      case TorStatusEnum.ERROR:
        return 'Connection failed';
      case TorStatusEnum.STOPPED:
      default:
        return 'TOR not connected';
    }
  };

  /**
   * Handle retry button
   */
  const handleRetry = async () => {
    clearError();
    await restart();
  };

  /**
   * Toggle expanded state
   */
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  /**
   * Render compact version
   */
  if (compact && !isExpanded) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { borderLeftColor: getStatusColor() }]}
        onPress={toggleExpanded}
      >
        <View style={styles.compactContent}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.compactText} numberOfLines={1}>
            {getStatusText()}
          </Text>
          {isBootstrapping && (
            <Text style={styles.compactProgress}>{bootstrapProgress}%</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  /**
   * Render full version
   */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.headerTitle}>TOR Connection</Text>
        </View>
        <View style={styles.headerRight}>
          {compact && (
            <TouchableOpacity onPress={toggleExpanded} style={styles.collapseButton}>
              <Text style={styles.collapseIcon}>−</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissIcon}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Text */}
      <Text style={styles.statusText}>{getStatusText()}</Text>

      {/* Bootstrap Progress */}
      {isBootstrapping && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${bootstrapProgress}%`, backgroundColor: getStatusColor() }
              ]}
            />
          </View>
          <Text style={styles.progressText}>{bootstrapProgress}%</Text>
        </View>
      )}

      {/* Loading Indicator */}
      {(isBootstrapping || status === TorStatusEnum.STARTING) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={getStatusColor()} size="small" />
          <Text style={styles.loadingText}>
            {bootstrapStatus?.tag || 'Initializing...'}
          </Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          {error.details && (
            <Text style={styles.errorDetails}>{error.details}</Text>
          )}
          {error.recoverable && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Circuit Information */}
      {isReady && showCircuits && circuits.length > 0 && (
        <View style={styles.circuitsContainer}>
          <Text style={styles.circuitsTitle}>
            Active Circuits ({circuits.length})
          </Text>
          <ScrollView
            style={styles.circuitsList}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {circuits.map((circuit) => (
              <View key={circuit.id} style={styles.circuitCard}>
                <View style={styles.circuitHeader}>
                  <Text style={styles.circuitId}>Circuit {circuit.id}</Text>
                  <View
                    style={[
                      styles.circuitStatus,
                      {
                        backgroundColor:
                          circuit.status === 'built' ? '#10b981' : '#6b7280'
                      }
                    ]}
                  >
                    <Text style={styles.circuitStatusText}>
                      {circuit.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.circuitPurpose}>{circuit.purpose}</Text>
                <View style={styles.circuitPath}>
                  {circuit.path.map((node, index) => (
                    <View key={node.fingerprint} style={styles.circuitNode}>
                      <Text style={styles.circuitNodeText}>
                        {index + 1}. {node.nickname} ({node.country})
                      </Text>
                    </View>
                  ))}
                </View>
                {circuit.buildTime && (
                  <Text style={styles.circuitBuildTime}>
                    Build time: {circuit.buildTime}ms
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Success Message */}
      {isReady && !showCircuits && (
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>
            Your connection is secure and anonymous
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Styles
 */
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8
  },
  compactContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    marginVertical: 4
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  compactText: {
    color: '#fff',
    fontSize: 14,
    flex: 1
  },
  compactProgress: {
    color: '#999',
    fontSize: 12,
    fontWeight: 'bold'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  statusText: {
    color: '#e5e5e5',
    fontSize: 14,
    marginBottom: 12
  },
  progressContainer: {
    marginVertical: 12
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  progressText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'right'
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8
  },
  loadingText: {
    color: '#999',
    fontSize: 12
  },
  errorContainer: {
    backgroundColor: '#3a1f1f',
    borderRadius: 8,
    padding: 12,
    marginTop: 8
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4
  },
  errorMessage: {
    color: '#fca5a5',
    fontSize: 13,
    marginBottom: 4
  },
  errorDetails: {
    color: '#999',
    fontSize: 11,
    marginBottom: 8
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginTop: 8
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  circuitsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    paddingTop: 12
  },
  circuitsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8
  },
  circuitsList: {
    maxHeight: 200
  },
  circuitCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8
  },
  circuitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  circuitId: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  circuitStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  circuitStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  circuitPurpose: {
    color: '#999',
    fontSize: 11,
    marginBottom: 8
  },
  circuitPath: {
    gap: 4
  },
  circuitNode: {
    paddingLeft: 8
  },
  circuitNodeText: {
    color: '#b0b0b0',
    fontSize: 11
  },
  circuitBuildTime: {
    color: '#666',
    fontSize: 10,
    marginTop: 4
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12
  },
  successIcon: {
    fontSize: 20,
    color: '#10b981'
  },
  successText: {
    color: '#10b981',
    fontSize: 13
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center'
  },
  collapseIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dismissIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  }
});

/**
 * Export component
 */
export default TorStatus;
