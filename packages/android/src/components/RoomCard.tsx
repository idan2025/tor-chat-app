import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Room } from '../types/Chat';
import { formatMessageTime } from '../types/Chat';

interface RoomCardProps {
  room: Room;
  onPress: () => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onPress }) => {
  const getLastMessageText = () => {
    if (!room.lastMessage) {
      return 'No messages yet';
    }

    const content = room.lastMessage.decryptedContent || '[Encrypted]';
    const sender = room.lastMessage.sender?.username || 'Unknown';

    // Truncate long messages
    const truncated = content.length > 50 ? `${content.substring(0, 50)}...` : content;

    return `${sender}: ${truncated}`;
  };

  const getTimeDisplay = () => {
    if (!room.lastMessage) {
      return formatMessageTime(room.createdAt);
    }
    return formatMessageTime(room.lastMessage.createdAt);
  };

  const getRoomIcon = () => {
    if (room.avatar) {
      return room.avatar.charAt(0).toUpperCase();
    }
    return room.name.charAt(0).toUpperCase();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, room.type === 'private' && styles.avatarPrivate]}>
          <Text style={styles.avatarText}>{getRoomIcon()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.roomName} numberOfLines={1}>
              {room.name}
            </Text>
            {room.type === 'private' && (
              <View style={styles.privateBadge}>
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
          </View>
          <Text style={styles.timestamp}>{getTimeDisplay()}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {getLastMessageText()}
          </Text>
          {room.unreadCount && room.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPrivate: {
    backgroundColor: '#f59e0b',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  roomName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  privateBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  privateBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default RoomCard;
