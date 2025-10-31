/**
 * MessageActions Component
 *
 * Bottom sheet/modal that appears on long press of a message.
 * Provides quick actions: React, Reply, Copy, Delete, Forward
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Clipboard,
  Alert,
} from 'react-native';
import { Message } from '../types/Chat';
import EmojiPicker from './EmojiPicker';

interface MessageActionsProps {
  message: Message;
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onForward: () => void;
  onEdit?: () => void;
  isOwnMessage?: boolean;
}

interface ActionButton {
  label: string;
  icon: string;
  onPress: () => void;
  color?: string;
  show?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  visible,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDelete,
  onForward,
  onEdit,
  isOwnMessage = false,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(emoji);
    if (!showEmojiPicker) {
      onClose();
    }
  };

  const handleCopy = () => {
    onCopy();
    onClose();
  };

  const handleReply = () => {
    onReply();
    onClose();
  };

  const handleDelete = () => {
    onClose();
    // Show confirmation alert
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  const handleForward = () => {
    onForward();
    onClose();
  };

  const handleEdit = () => {
    // Check if it's own message
    if (!isOwnMessage) return;

    // Check 15-minute edit window
    const now = Date.now();
    const messageTime = new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (now - messageTime > fifteenMinutes) {
      onClose();
      Alert.alert(
        'Cannot Edit Message',
        'Messages can only be edited within 15 minutes of sending.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Trigger edit mode
    onClose();
    // The parent component should handle setting edit mode
    // This will be connected via navigation or callback
  };

  const handleMoreReactions = () => {
    setShowEmojiPicker(true);
  };

  const handleEmojiPickerClose = () => {
    setShowEmojiPicker(false);
    onClose();
  };

  // Check if message can be edited (within 15 minutes)
  const canEdit = () => {
    if (!isOwnMessage || !onEdit) return false;
    const now = Date.now();
    const messageTime = new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    return now - messageTime <= fifteenMinutes;
  };

  const actions: ActionButton[] = [
    {
      label: 'Reply',
      icon: '↩️',
      onPress: handleReply,
      show: true,
    },
    {
      label: 'Copy',
      icon: '📋',
      onPress: handleCopy,
      show: message.messageType === 'text' || message.decryptedContent,
    },
    {
      label: 'Edit',
      icon: '✏️',
      onPress: () => {
        handleEdit();
        if (onEdit) onEdit();
      },
      show: canEdit(),
    },
    {
      label: 'Forward',
      icon: '➡️',
      onPress: handleForward,
      show: true,
    },
    {
      label: 'Delete',
      icon: '🗑️',
      onPress: handleDelete,
      color: '#ef4444',
      show: isOwnMessage,
    },
  ];

  const visibleActions = actions.filter(action => action.show !== false);

  return (
    <>
      <Modal
        visible={visible && !showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={styles.container}
            onPress={e => e.stopPropagation()}
          >
            {/* Quick Reactions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Reactions</Text>
              <View style={styles.quickReactions}>
                {QUICK_REACTIONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionButton}
                    onPress={() => handleReact(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={handleMoreReactions}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsContainer}>
                {visibleActions.map((action, index) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[
                      styles.actionButton,
                      index === visibleActions.length - 1 &&
                        styles.actionButtonLast,
                    ]}
                    onPress={action.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionIcon}>{action.icon}</Text>
                    <Text
                      style={[
                        styles.actionLabel,
                        action.color && { color: action.color },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onEmojiSelect={handleReact}
        onClose={handleEmojiPickerClose}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  quickReactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  reactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  moreButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  actionsContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtonLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessageActions;
