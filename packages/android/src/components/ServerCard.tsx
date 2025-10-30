import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Server,
  getServerDisplayName,
  getConnectionStatusColor,
  getConnectionStatusText,
} from '../types/Server';

interface ServerCardProps {
  server: Server;
  onPress?: (server: Server) => void;
  onDelete?: (server: Server) => void;
  showDeleteButton?: boolean;
}

export default function ServerCard({
  server,
  onPress,
  onDelete,
  showDeleteButton = true,
}: ServerCardProps) {
  const handleDelete = () => {
    Alert.alert(
      'Delete Server',
      `Are you sure you want to delete "${getServerDisplayName(server)}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(server),
        },
      ]
    );
  };

  const statusColor = getConnectionStatusColor(server.connectionStatus);
  const statusText = getConnectionStatusText(
    server.connectionStatus,
    server.bootstrapProgress
  );

  return (
    <TouchableOpacity
      style={[styles.container, server.isActive && styles.activeContainer]}
      onPress={() => onPress?.(server)}
      activeOpacity={0.7}
    >
      {/* Server Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.icon, { backgroundColor: statusColor }]}>
          <Text style={styles.iconText}>
            {getServerDisplayName(server)[0].toUpperCase()}
          </Text>
        </View>
        {server.isActive && <View style={styles.activeBadge} />}
      </View>

      {/* Server Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{getServerDisplayName(server)}</Text>
        <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
          {server.onionAddress}
        </Text>

        {/* Status and User Info */}
        <View style={styles.metaContainer}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>

          {server.user && (
            <Text style={styles.userText}>
              {server.user.displayName || server.user.username}
              {server.user.isAdmin && ' (Admin)'}
            </Text>
          )}
        </View>

        {/* Last Connected */}
        {server.lastConnected && (
          <Text style={styles.lastConnected}>
            Last: {formatLastConnected(server.lastConnected)}
          </Text>
        )}

        {/* Error Message */}
        {server.connectionError && (
          <Text style={styles.errorText} numberOfLines={1}>
            {server.connectionError}
          </Text>
        )}
      </View>

      {/* Delete Button */}
      {showDeleteButton && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteIcon}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function formatLastConnected(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeContainer: {
    borderColor: '#7c3aed',
    backgroundColor: '#2d2d44',
  },
  iconContainer: {
    position: 'relative',
    marginRight: 15,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  activeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7c3aed',
    borderWidth: 2,
    borderColor: '#2d2d44',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  address: {
    color: '#999',
    fontSize: 12,
    marginBottom: 6,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userText: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '600',
  },
  lastConnected: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  deleteIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
});
