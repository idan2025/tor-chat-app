/**
 * AdminRoomsScreen Component
 *
 * Admin panel screen for managing chat rooms.
 * Allows admins to view, search, edit, and delete rooms.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { AdminRoom } from '../types/Chat';
import { apiService } from '../services/ApiService';

interface RoomListItemProps {
  room: AdminRoom;
  onDelete: (roomId: string) => void;
}

const RoomListItem: React.FC<RoomListItemProps> = ({ room, onDelete }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Room',
      `Are you sure you want to permanently delete "${room.name}"? This will delete all messages and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(room.id),
        },
      ]
    );
  };

  return (
    <View style={styles.roomItem}>
      <View style={styles.roomIcon}>
        <Text style={styles.roomIconText}>{room.isPublic ? '🌐' : '🔒'}</Text>
      </View>

      <View style={styles.roomInfo}>
        <View style={styles.roomNameRow}>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={[styles.typeBadge, room.isPublic && styles.publicBadge]}>
            <Text style={styles.typeBadgeText}>
              {room.isPublic ? 'PUBLIC' : 'PRIVATE'}
            </Text>
          </View>
        </View>

        <View style={styles.roomStats}>
          <Text style={styles.roomStat}>👥 {room.memberCount} members</Text>
          <Text style={styles.roomStat}>💬 {room.messageCount} messages</Text>
        </View>

        <Text style={styles.roomDate}>Created {formatDate(room.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
};

export const AdminRoomsScreen: React.FC = () => {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<AdminRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRooms = async () => {
    try {
      const response = await apiService.get<{ rooms: AdminRoom[] }>('/admin/rooms');
      const roomsData = response.rooms || [];
      setRooms(roomsData);
      applyFilters(roomsData, searchQuery, filterType);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load rooms',
        text2: error.message || 'Please try again',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const applyFilters = (
    roomsList: AdminRoom[],
    search: string,
    type: 'all' | 'public' | 'private'
  ) => {
    let filtered = roomsList;

    // Apply type filter
    if (type !== 'all') {
      filtered = filtered.filter((room) =>
        type === 'public' ? room.isPublic : !room.isPublic
      );
    }

    // Apply search filter
    if (search.trim() !== '') {
      const query = search.toLowerCase();
      filtered = filtered.filter((room) => room.name.toLowerCase().includes(query));
    }

    setFilteredRooms(filtered);
  };

  useEffect(() => {
    applyFilters(rooms, searchQuery, filterType);
  }, [searchQuery, filterType, rooms]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const handleDelete = async (roomId: string) => {
    try {
      await apiService.delete(`/admin/rooms/${roomId}`);

      // Remove from local state
      setRooms((prev) => prev.filter((room) => room.id !== roomId));

      Toast.show({
        type: 'success',
        text1: 'Room deleted',
        text2: 'Room has been permanently deleted',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to delete room',
        text2: error.message || 'Please try again',
      });
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Room Management</Text>
      <Text style={styles.subtitle}>
        {filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'}
      </Text>

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

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
          onPress={() => setFilterType('all')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.filterTabText, filterType === 'all' && styles.filterTabTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterType === 'public' && styles.filterTabActive]}
          onPress={() => setFilterType('public')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterTabText,
              filterType === 'public' && styles.filterTabTextActive,
            ]}
          >
            Public
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterType === 'private' && styles.filterTabActive]}
          onPress={() => setFilterType('private')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterTabText,
              filterType === 'private' && styles.filterTabTextActive,
            ]}
          >
            Private
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminRoom }) => <RoomListItem room={item} onDelete={handleDelete} />,
    []
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.emptyText}>Loading rooms...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyText}>No rooms found</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery || filterType !== 'all'
            ? 'Try adjusting your filters'
            : 'No rooms created yet'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRooms}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#999',
    fontSize: 16,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#7c3aed',
  },
  filterTabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#fff',
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
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  roomName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: '#3d3d54',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publicBadge: {
    backgroundColor: '#10b981',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  roomStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  roomStat: {
    color: '#999',
    fontSize: 13,
  },
  roomDate: {
    color: '#666',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 24,
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
  },
});

export default AdminRoomsScreen;
