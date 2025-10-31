import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { socketService } from '../services/SocketService';
import { useChatStore } from '../store/chatStore';

interface MessageInputProps {
  roomId: string;
  onSend: (content: string, attachments?: string[]) => void;
  onAttach?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  roomId,
  onSend,
  onAttach,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Get reply and edit state from chatStore
  const replyToMessage = useChatStore((state) => state.replyToMessage);
  const editingMessage = useChatStore((state) => state.editingMessage);
  const clearReplyToMessage = useChatStore((state) => state.clearReplyToMessage);
  const clearEditingMessage = useChatStore((state) => state.clearEditingMessage);
  const chatStore = useChatStore();

  // Load editing message content when edit mode is activated
  useEffect(() => {
    if (editingMessage && editingMessage.decryptedContent) {
      setText(editingMessage.decryptedContent);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    // Cleanup typing indicator on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        socketService.sendStopTyping(roomId);
      }
    };
  }, [roomId, isTyping]);

  const handleChangeText = (value: string) => {
    setText(value);

    // Send typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      socketService.sendTyping(roomId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socketService.sendStopTyping(roomId);
      }
    }, 2000);
  };

  const handleSend = async () => {
    const trimmedText = text.trim();

    if (trimmedText.length === 0 || disabled) {
      return;
    }

    // Clear typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      socketService.sendStopTyping(roomId);
    }

    // Handle edit mode
    if (editingMessage) {
      try {
        await chatStore.editMessage(editingMessage.id, trimmedText);
        clearEditingMessage();
      } catch (error) {
        console.error('Failed to edit message:', error);
      }
    } else {
      // Send message (with optional reply)
      onSend(trimmedText);

      // Clear reply if any
      if (replyToMessage) {
        clearReplyToMessage();
      }
    }

    // Clear input
    setText('');
    inputRef.current?.focus();
  };

  const handleAttach = () => {
    if (onAttach && !disabled) {
      onAttach();
    }
  };

  // Render reply or edit preview
  const renderPreview = () => {
    if (editingMessage) {
      return (
        <View style={styles.previewContainer}>
          <View style={styles.previewBar} />
          <View style={styles.previewContent}>
            <Text style={styles.previewLabel}>Editing message</Text>
            <Text style={styles.previewText} numberOfLines={1}>
              {editingMessage.decryptedContent || '[Message]'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => {
              clearEditingMessage();
              setText('');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (replyToMessage) {
      return (
        <View style={styles.previewContainer}>
          <View style={styles.previewBar} />
          <View style={styles.previewContent}>
            <Text style={styles.previewLabel}>
              Replying to {replyToMessage.sender?.username || 'Unknown'}
            </Text>
            <Text style={styles.previewText} numberOfLines={1}>
              {replyToMessage.decryptedContent || '[Message]'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={clearReplyToMessage}
            activeOpacity={0.7}
          >
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderPreview()}
      <View style={styles.container}>
        {onAttach && (
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttach}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <View style={styles.attachIcon} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor="#999"
            multiline
            maxLength={5000}
            editable={!disabled}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          activeOpacity={0.7}
        >
          <View style={styles.sendIcon} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIcon: {
    width: 20,
    height: 2,
    backgroundColor: '#7c3aed',
    transform: [{ rotate: '45deg' }],
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    minHeight: 20,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#3d3d54',
    opacity: 0.5,
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    transform: [{ rotate: '90deg' }],
    marginLeft: 2,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#3d3d54',
  },
  previewBar: {
    width: 3,
    height: 40,
    backgroundColor: '#7c3aed',
    borderRadius: 2,
    marginRight: 12,
  },
  previewContent: {
    flex: 1,
  },
  previewLabel: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewText: {
    color: '#fff',
    fontSize: 14,
  },
  previewClose: {
    padding: 8,
  },
  previewCloseText: {
    color: '#999',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default MessageInput;
