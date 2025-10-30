import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useChatStore } from '../store/chatStore';
import RoomCard from '../components/RoomCard';
import { Room } from '../types/Chat';
import Toast from 'react-native-toast-message';

export default function RoomListScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { rooms, isLoading, error, loadRooms, selectRoom, clearError } = useChatStore();

  useEffect(() => {
    loadRooms();
  }, []);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadRooms();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRoomPress = async (room: Room) => {
    try {
      await selectRoom(room.id);
      navigation.navigate('Chat', { roomId: room.id, roomName: room.name });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to open room',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRoom = ({ item }: { item: Room }) => (
    <RoomCard room={item} onPress={() => handleRoomPress(item)} />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Rooms Yet</Text>
        <Text style={styles.emptySubtitle}>
          Create or join a room to start chatting
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
          <Text style={styles.createButtonText}>Create Room</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <View style={styles.searchIcon}>
          <Text style={styles.searchIconText}>🔍</Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      <FlatList
        data={filteredRooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredRooms.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateRoom} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {isLoading && !isRefreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchIconText: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#999',
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 8,
  },
  listContentEmpty: {
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
    marginBottom: 30,
  },
  createButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
