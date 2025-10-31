import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import { Message } from '../types/Chat';
import Toast from 'react-native-toast-message';

export default function ChatScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params || {};
  const flatListRef = useRef<FlatList>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { user } = useAuthStore();
  const {
    currentRoom,
    messages,
    typingUsers,
    isLoading,
    error,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    clearCurrentRoom,
    clearError,
  } = useChatStore();

  // Get messages for current room
  const roomMessages = currentRoom ? (messages.get(currentRoom.id) || []) : [];
  const roomTypingUsers = currentRoom ? (typingUsers.get(currentRoom.id) || []) : [];

  useEffect(() => {
    if (!roomId) {
      navigation.goBack();
      return;
    }

    // Set navigation title
    navigation.setOptions({
      title: roomName || 'Chat',
      headerRight: () => (
        <TouchableOpacity onPress={handleSettings} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>⚙</Text>
        </TouchableOpacity>
      ),
    });

    // Load initial messages
    if (currentRoom?.id === roomId) {
      loadMessages(roomId);
    }

    // Cleanup on unmount
    return () => {
      clearCurrentRoom();
    };
  }, [roomId]);

  useEffect(() => {
    if (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error,
      });
      clearError();
    }
  }, [error]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (roomMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [roomMessages.length]);

  const handleSend = async (content: string, attachments?: string[]) => {
    if (!currentRoom) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No room selected',
      });
      return;
    }

    try {
      await sendMessage(currentRoom.id, content, 'text', attachments);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to send message',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleAttach = async () => {
    if (!currentRoom) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No room selected',
      });
      return;
    }

    // Show action sheet on Android/iOS
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const { ActionSheetIOS, Alert } = require('react-native');

      // For iOS, use ActionSheetIOS
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose Photo', 'Choose File'],
            cancelButtonIndex: 0,
          },
          async (buttonIndex: number) => {
            try {
              if (buttonIndex === 1) {
                // Take photo with camera
                const { fileService } = await import('../services/FileService');
                const result = await fileService.launchCamera({ mediaType: 'photo' });
                if (result.assets && result.assets.length > 0) {
                  await useChatStore.getState().uploadImage(currentRoom.id, result.assets[0]);
                }
              } else if (buttonIndex === 2) {
                // Choose from gallery
                const { fileService } = await import('../services/FileService');
                const result = await fileService.pickImage({ mediaType: 'photo', selectionLimit: 5 });
                if (result.assets && result.assets.length > 0) {
                  if (result.assets.length === 1) {
                    await useChatStore.getState().uploadImage(currentRoom.id, result.assets[0]);
                  } else {
                    await useChatStore.getState().uploadMultipleImages(currentRoom.id, result.assets);
                  }
                }
              } else if (buttonIndex === 3) {
                // Choose file
                const { fileService } = await import('../services/FileService');
                const file = await fileService.pickDocument();
                await useChatStore.getState().uploadFile(currentRoom.id, file);
              }
            } catch (error: any) {
              if (!error.message?.includes('cancelled')) {
                Toast.show({
                  type: 'error',
                  text1: 'Upload Failed',
                  text2: error.message || 'Please try again',
                });
              }
            }
          }
        );
      } else {
        // For Android, use custom alert with options
        Alert.alert(
          'Attach File',
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Take Photo',
              onPress: async () => {
                try {
                  const { fileService } = await import('../services/FileService');
                  const result = await fileService.launchCamera({ mediaType: 'photo' });
                  if (result.assets && result.assets.length > 0) {
                    await useChatStore.getState().uploadImage(currentRoom.id, result.assets[0]);
                  }
                } catch (error: any) {
                  if (!error.message?.includes('cancelled')) {
                    Toast.show({
                      type: 'error',
                      text1: 'Upload Failed',
                      text2: error.message || 'Please try again',
                    });
                  }
                }
              },
            },
            {
              text: 'Choose Photo',
              onPress: async () => {
                try {
                  const { fileService } = await import('../services/FileService');
                  const result = await fileService.pickImage({ mediaType: 'photo', selectionLimit: 5 });
                  if (result.assets && result.assets.length > 0) {
                    if (result.assets.length === 1) {
                      await useChatStore.getState().uploadImage(currentRoom.id, result.assets[0]);
                    } else {
                      await useChatStore.getState().uploadMultipleImages(currentRoom.id, result.assets);
                    }
                  }
                } catch (error: any) {
                  if (!error.message?.includes('cancelled')) {
                    Toast.show({
                      type: 'error',
                      text1: 'Upload Failed',
                      text2: error.message || 'Please try again',
                    });
                  }
                }
              },
            },
            {
              text: 'Choose File',
              onPress: async () => {
                try {
                  const { fileService } = await import('../services/FileService');
                  const file = await fileService.pickDocument();
                  await useChatStore.getState().uploadFile(currentRoom.id, file);
                } catch (error: any) {
                  if (!error.message?.includes('cancelled')) {
                    Toast.show({
                      type: 'error',
                      text1: 'Upload Failed',
                      text2: error.message || 'Please try again',
                    });
                  }
                }
              },
            },
          ],
          { cancelable: true }
        );
      }
    }
  };

  const handleSettings = () => {
    if (currentRoom) {
      navigation.navigate('RoomSettings', {
        roomId: currentRoom.id,
        roomName: currentRoom.name,
      });
    }
  };

  const handleLoadMore = async () => {
    if (!currentRoom || isLoadingMore || isLoading) {
      return;
    }

    setIsLoadingMore(true);
    try {
      await loadMoreMessages(currentRoom.id);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleMessageLongPress = (message: Message) => {
    // TODO: Show message actions menu (Phase 3)
    Toast.show({
      type: 'info',
      text1: 'Coming Soon',
      text2: 'Message actions will be available in Phase 3',
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.sender?.id === user?.id || item.senderId === user?.id;
    const previousMessage = roomMessages[index + 1];
    const showAvatar =
      !previousMessage || previousMessage.sender?.id !== item.sender?.id;

    return (
      <MessageBubble
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar}
        onLongPress={handleMessageLongPress}
      />
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Messages Yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to send a message in this room
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) {
      return null;
    }

    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#7c3aed" />
        <Text style={styles.loadingMoreText}>Loading more messages...</Text>
      </View>
    );
  };

  const renderListHeader = () => {
    if (roomTypingUsers.length === 0) {
      return null;
    }

    return <TypingIndicator typingUsers={roomTypingUsers} />;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={roomMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            roomMessages.length === 0 && styles.messageListEmpty,
          ]}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          ListHeaderComponent={renderListHeader}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={20}
          windowSize={10}
        />

        <MessageInput
          roomId={roomId}
          onSend={handleSend}
          onAttach={handleAttach}
          disabled={isLoading || !currentRoom}
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  headerButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  messageList: {
    paddingVertical: 8,
  },
  messageListEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
});
