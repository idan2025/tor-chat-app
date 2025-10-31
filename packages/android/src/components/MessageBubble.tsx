import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard } from 'react-native';
import Toast from 'react-native-toast-message';
import FastImage from 'react-native-fast-image';
import { Message, MessageAttachment } from '../types/Chat';
import { LinkPreview, LinkPreviewData } from './LinkPreview';
import { ImageViewer, ImageSource } from './ImageViewer';
import { useChatStore } from '../store/chatStore';
import { useServerStore } from '../store/serverStore';
import MessageActions from './MessageActions';

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
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);

  const chatStore = useChatStore();
  const reactions = chatStore.getReactionsForMessage(message.id);
  const activeServer = useServerStore((state) => state.activeServer);

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

  // Extract image attachments for the image viewer
  const getImageAttachments = (): ImageSource[] => {
    if (!message.attachments || message.attachments.length === 0) return [];

    return message.attachments
      .filter((att) => {
        if (typeof att === 'string') return false;
        const attachment = att as MessageAttachment;
        return attachment.mimeType && attachment.mimeType.startsWith('image/');
      })
      .map((att) => {
        const attachment = att as MessageAttachment;
        return { uri: attachment.url };
      });
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(message);
    }
    setShowActions(true);
  };

  const handleReact = async (emoji: string) => {
    await chatStore.toggleReaction(message.id, emoji);
  };

  const handleCopy = () => {
    if (message.decryptedContent) {
      Clipboard.setString(message.decryptedContent);
      Toast.show({
        type: 'success',
        text1: 'Copied to clipboard',
        position: 'bottom',
      });
    }
  };

  const handleDelete = async () => {
    // TODO: Implement delete in Phase 4
    Toast.show({
      type: 'info',
      text1: 'Delete feature coming in Phase 4',
      position: 'bottom',
    });
  };

  const handleReply = () => {
    // TODO: Implement reply in Phase 4
    Toast.show({
      type: 'info',
      text1: 'Reply feature coming in Phase 4',
      position: 'bottom',
    });
  };

  const handleForward = () => {
    // TODO: Implement forward in Phase 4
    Toast.show({
      type: 'info',
      text1: 'Forward feature coming in Phase 4',
      position: 'bottom',
    });
  };

  // Render reactions below message
  const renderReactions = () => {
    if (reactions.length === 0) return null;

    return (
      <View style={styles.reactionsContainer}>
        {reactions.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            style={[
              styles.reactionBubble,
              reaction.users.includes(activeServer?.user?.id || '') &&
                styles.reactionBubbleActive,
            ]}
            onPress={() => handleReact(reaction.emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render link preview if metadata exists
  const renderLinkPreview = () => {
    if (!message.metadata?.linkPreview) return null;

    return <LinkPreview preview={message.metadata.linkPreview as LinkPreviewData} />;
  };

  // Render attachments
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    const attachmentElements = [];
    let imageIndex = 0;

    for (let i = 0; i < message.attachments.length; i++) {
      const attachment = message.attachments[i];

      // Skip string attachments (old format)
      if (typeof attachment === 'string') continue;

      const att = attachment as MessageAttachment;

      if (att.mimeType && att.mimeType.startsWith('image/')) {
        const currentImageIndex = imageIndex;
        attachmentElements.push(
          <TouchableOpacity
            key={att.id}
            onPress={() => handleImagePress(currentImageIndex)}
            activeOpacity={0.9}
          >
            <FastImage
              source={{ uri: att.thumbnail || att.url }}
              style={styles.imageAttachment}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
        imageIndex++;
      } else {
        // Render other file types (video, documents, etc.)
        attachmentElements.push(
          <TouchableOpacity
            key={att.id}
            style={styles.fileAttachment}
            onPress={() => {
              // Open file in browser or external viewer
              Linking.openURL(att.url).catch(() => {
                Toast.show({
                  type: 'error',
                  text1: 'Failed to open file',
                  text2: 'Could not open the file',
                });
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.fileIcon}>
              {att.mimeType?.startsWith('video/') ? '🎥' : '📎'}
            </Text>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {att.originalName || att.filename}
              </Text>
              <Text style={styles.fileSize}>
                {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Unknown size'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }
    }

    if (attachmentElements.length === 0) return null;

    return <View style={styles.attachmentsContainer}>{attachmentElements}</View>;
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

  const imageAttachments = getImageAttachments();

  return (
    <>
      <View style={[styles.container, isOwnMessage && styles.containerOwn]}>
        {!isOwnMessage && showAvatar && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {message.sender?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <View>
          <TouchableOpacity
            style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}
            onLongPress={handleLongPress}
            activeOpacity={0.7}
          >
            {!isOwnMessage && (
              <Text style={styles.senderName}>{message.sender?.username || 'Unknown'}</Text>
            )}

            <Text style={[styles.messageText, isOwnMessage && styles.messageTextOwn]}>
              {getMessageContent()}
            </Text>

            {renderAttachments()}
            {renderLinkPreview()}

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

          {renderReactions()}
        </View>

        {isOwnMessage && <View style={styles.spacer} />}
      </View>

      {imageAttachments.length > 0 && (
        <ImageViewer
          visible={imageViewerVisible}
          images={imageAttachments}
          initialIndex={selectedImageIndex}
          onClose={() => setImageViewerVisible(false)}
        />
      )}

      <MessageActions
        message={message}
        visible={showActions}
        onClose={() => setShowActions(false)}
        onReact={handleReact}
        onReply={handleReply}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onForward={handleForward}
        isOwnMessage={isOwnMessage}
      />
    </>
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
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  imageAttachment: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  fileAttachment: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  fileSize: {
    color: '#888',
    fontSize: 12,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reactionBubbleActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderColor: '#7c3aed',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});

export default MessageBubble;
