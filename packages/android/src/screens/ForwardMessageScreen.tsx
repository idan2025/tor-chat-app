/**
 * ForwardMessageScreen Component
 *
 * Modal/screen for selecting a room to forward a message to.
 * Shows all available rooms with search functionality.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Room } from '../types/Chat';
import { useChatStore } from '../store/chatStore';

type ForwardMessageRouteProp = RouteProp<{ ForwardMessage: { messageId: string } }, 'ForwardMessage'>;

interface RoomListItemProps {
  room: Room;
  onSelect: (roomId: string) => void;
}

const RoomListItem: React.FC<RoomListItemProps> = ({ room, onSelect }) => {
  return (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => onSelect(room.id)}
      activeOpacity={0.7}
    >
      <View style={styles.roomIcon}>
        <Text style={styles.roomIconText}>{room.type === 'public' ? '🌐' : '🔒'}</Text>
      </View>

      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>{room.name}</Text>
        {room.description && (
          <Text style={styles.roomDescription} numberOfLines={1}>
            {room.description}
          </Text>
        )}
        <Text style={styles.roomMembers}>
          {room.memberCount || 0} members • {room.type === 'public' ? 'Public' : 'Private'}
        </Text>
      </View>

      <View style={styles.arrowIcon}>
        <Text style={styles.arrowIconText}>→</Text>
      </View>
    </TouchableOpacity>
  );
};

export const ForwardMessageScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ForwardMessageRouteProp>();
  const { messageId } = route.params;

  const chatStore = useChatStore();
  const rooms = chatStore.rooms;

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRooms, setFilteredRooms] = useState<Room[]>(rooms);
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    // Filter rooms based on search query
    if (searchQuery.trim() === '') {
      setFilteredRooms(rooms);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRooms(
        rooms.filter((room) => room.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, rooms]);

  const handleSelectRoom = async (roomId: string) => {
    const selectedRoom = rooms.find((r) => r.id === roomId);
    if (!selectedRoom) return;

    setIsForwarding(true);

    try {
      await chatStore.forwardMessage(messageId, roomId);

      Toast.show({
        type: 'success',
        text1: 'Message forwarded',
        text2: `Message sent to ${selectedRoom.name}`,
      });

      // Close the modal/screen
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to forward message',
        text2: error.message || 'Please try again',
      });
      setIsForwarding(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Forward Message</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Select a room to forward this message to</Text>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Room }) => (
    <RoomListItem room={item} onSelect={handleSelectRoom} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyText}>No rooms found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try a different search query' : 'You are not a member of any rooms'}
      </Text>
    </View>
  );

  if (isForwarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Forwarding message...</Text>
      </View>
    );
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => navigation.goBack()}
    >
      <View style={styles.container}>
        <FlatList
          data={filteredRooms}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#999',
    fontSize: 15,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3d3d54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomIconText: {
    fontSize: 24,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roomDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  roomMembers: {
    color: '#666',
    fontSize: 12,
  },
  arrowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ForwardMessageScreen;
