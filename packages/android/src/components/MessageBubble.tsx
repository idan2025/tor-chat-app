import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message } from '../types/Chat';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  onLongPress?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showAvatar = true,
  onLongPress,
}) => {
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getStatusIcon = () => {
    if (!isOwnMessage) return null;

    switch (message.status) {
      case 'sending':
        return '○';
      case 'sent':
        return '✓';
      case 'failed':
        return '✗';
      default:
        return '✓';
    }
  };

  const getMessageContent = () => {
    if (message.decryptedContent) {
      return message.decryptedContent;
    }

    switch (message.messageType) {
      case 'image':
        return '[Image]';
      case 'video':
        return '[Video]';
      case 'file':
        return '[File]';
      case 'system':
        return message.decryptedContent || 'System message';
      default:
        return '[Encrypted]';
    }
  };

  const isSystemMessage = message.messageType === 'system';

  if (isSystemMessage) {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{getMessageContent()}</Text>
        <Text style={styles.systemTime}>{formatTime(message.createdAt)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isOwnMessage && styles.containerOwn]}>
      {!isOwnMessage && showAvatar && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {message.sender?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}
        onLongPress={() => onLongPress && onLongPress(message)}
        activeOpacity={0.7}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>{message.sender?.username || 'Unknown'}</Text>
        )}

        <Text style={[styles.messageText, isOwnMessage && styles.messageTextOwn]}>
          {getMessageContent()}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.timestamp, isOwnMessage && styles.timestampOwn]}>
            {formatTime(message.createdAt)}
          </Text>
          {isOwnMessage && (
            <Text
              style={[
                styles.status,
                message.status === 'failed' && styles.statusFailed,
              ]}
            >
              {getStatusIcon()}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {isOwnMessage && <View style={styles.spacer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    marginHorizontal: 12,
    alignItems: 'flex-end',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3d3d54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 10,
  },
  bubbleOwn: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#2d2d44',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  timestamp: {
    color: '#999',
    fontSize: 11,
  },
  timestampOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  status: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginLeft: 4,
  },
  statusFailed: {
    color: '#ef4444',
  },
  spacer: {
    width: 40,
  },
  systemContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemText: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
  },
  systemTime: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
});

export default MessageBubble;
