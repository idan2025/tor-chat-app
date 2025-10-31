/**
 * UserListItem Component
 *
 * List item for displaying user information in the admin panel.
 * Shows avatar, username, role badge, online status, and action menu.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { AdminUser } from '../types/Chat';

export interface UserListItemProps {
  user: AdminUser;
  onPromote?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  onBan?: (userId: string) => void;
  onUnban?: (userId: string) => void;
  onDelete?: (userId: string) => void;
  onViewDetails?: (userId: string) => void;
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  onPromote,
  onDemote,
  onBan,
  onUnban,
  onDelete,
  onViewDetails,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleAction = (action: () => void, confirmMessage?: string) => {
    setShowMenu(false);

    if (confirmMessage) {
      Alert.alert('Confirm Action', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: action,
        },
      ]);
    } else {
      action();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => onViewDetails?.(user.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
          {user.isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{user.username}</Text>
            {user.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            )}
            {user.isBanned && (
              <View style={styles.bannedBadge}>
                <Text style={styles.bannedBadgeText}>BANNED</Text>
              </View>
            )}
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>

          <Text style={styles.date}>
            Joined {formatDate(user.createdAt)}
            {!user.isOnline && user.lastSeen && ` • Last seen ${formatDate(user.lastSeen)}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuIcon}>⋮</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Action Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menu}>
            {onViewDetails && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction(() => onViewDetails(user.id))}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>View Details</Text>
              </TouchableOpacity>
            )}

            {!user.isAdmin && onPromote && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleAction(
                    () => onPromote(user.id),
                    `Are you sure you want to promote ${user.username} to admin?`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>Promote to Admin</Text>
              </TouchableOpacity>
            )}

            {user.isAdmin && onDemote && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleAction(
                    () => onDemote(user.id),
                    `Are you sure you want to remove admin privileges from ${user.username}?`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>Demote to User</Text>
              </TouchableOpacity>
            )}

            {!user.isBanned && onBan && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleAction(
                    () => onBan(user.id),
                    `Are you sure you want to ban ${user.username}? This will prevent them from logging in.`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, styles.dangerText]}>Ban User</Text>
              </TouchableOpacity>
            )}

            {user.isBanned && onUnban && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction(() => onUnban(user.id))}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>Unban User</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() =>
                  handleAction(
                    () => onDelete(user.id),
                    `Are you sure you want to permanently delete ${user.username}? This action cannot be undone.`
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, styles.dangerText]}>Delete User</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, styles.cancelItem]}
              onPress={() => setShowMenu(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3d3d54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#2d2d44',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  adminBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  bannedBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bannedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  email: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  date: {
    color: '#666',
    fontSize: 12,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    color: '#999',
    fontSize: 24,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    minWidth: 250,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dangerText: {
    color: '#ef4444',
  },
  cancelItem: {
    marginTop: 8,
    backgroundColor: '#2d2d44',
  },
});

export default UserListItem;
