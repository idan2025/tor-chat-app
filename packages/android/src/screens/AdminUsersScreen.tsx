/**
 * AdminUsersScreen Component
 *
 * Admin panel screen for managing users.
 * Allows admins to view, search, promote, demote, ban, unban, and delete users.
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { AdminUser } from '../types/Chat';
import { UserListItem } from '../components/UserListItem';
import { apiService } from '../services/ApiService';

export const AdminUsersScreen: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadUsers = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await apiService.get<{ users: AdminUser[]; total: number }>(
        `/admin/users?page=${pageNum}&limit=50`
      );

      const newUsers = response.users || [];

      if (append) {
        setUsers((prev) => [...prev, ...newUsers]);
        setFilteredUsers((prev) => [...prev, ...newUsers]);
      } else {
        setUsers(newUsers);
        setFilteredUsers(newUsers);
      }

      setHasMore(newUsers.length === 50);
      setPage(pageNum);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load users',
        text2: error.message || 'Please try again',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.username.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers(1, false);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadUsers(page + 1, true);
    }
  };

  const handlePromote = async (userId: string) => {
    try {
      await apiService.put(`/admin/users/${userId}/promote`, {});

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isAdmin: true } : user))
      );

      Toast.show({
        type: 'success',
        text1: 'User promoted',
        text2: 'User has been promoted to admin',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to promote user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await apiService.put(`/admin/users/${userId}/demote`, {});

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isAdmin: false } : user))
      );

      Toast.show({
        type: 'success',
        text1: 'User demoted',
        text2: 'Admin privileges have been removed',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to demote user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleBan = async (userId: string) => {
    try {
      await apiService.put(`/admin/users/${userId}/ban`, {});

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isBanned: true } : user))
      );

      Toast.show({
        type: 'success',
        text1: 'User banned',
        text2: 'User has been banned from the server',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to ban user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await apiService.put(`/admin/users/${userId}/unban`, {});

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isBanned: false } : user))
      );

      Toast.show({
        type: 'success',
        text1: 'User unbanned',
        text2: 'User can now access the server',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to unban user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiService.delete(`/admin/users/${userId}`);

      // Remove from local state
      setUsers((prev) => prev.filter((user) => user.id !== userId));

      Toast.show({
        type: 'success',
        text1: 'User deleted',
        text2: 'User has been permanently deleted',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to delete user',
        text2: error.message || 'Please try again',
      });
    }
  };

  const handleViewDetails = (userId: string) => {
    // TODO: Implement user details modal/screen
    Toast.show({
      type: 'info',
      text1: 'User Details',
      text2: 'User details view coming soon',
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>User Management</Text>
      <Text style={styles.subtitle}>
        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
      </Text>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or email..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <UserListItem
        user={item}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onBan={handleBan}
        onUnban={handleUnban}
        onDelete={handleDelete}
        onViewDetails={handleViewDetails}
      />
    ),
    []
  );

  const renderFooter = () => {
    if (!hasMore || isLoading) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#7c3aed" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.emptyText}>Loading users...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyText}>No users found</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery ? 'Try a different search query' : 'No users registered yet'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
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
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default AdminUsersScreen;
