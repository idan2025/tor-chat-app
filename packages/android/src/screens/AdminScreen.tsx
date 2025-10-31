/**
 * AdminScreen Component
 *
 * Main admin panel dashboard showing server statistics and navigation to admin sub-screens.
 * Only accessible to users with isAdmin = true.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AdminStats } from '../types/Chat';
import { AdminCard } from '../components/AdminCard';
import { apiService } from '../services/ApiService';
import { useServerStore } from '../store/serverStore';

export const AdminScreen: React.FC = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const activeServer = useServerStore((state) => state.activeServer);

  const loadStats = async () => {
    try {
      const response = await apiService.get<AdminStats>('/admin/stats');
      setStats(response);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load statistics',
        text2: error.message || 'Please try again',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Check if user is admin
    if (!activeServer?.user?.isAdmin) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'You do not have admin permissions',
      });
      navigation.goBack();
      return;
    }

    loadStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Server Management & Statistics</Text>
        </View>

        {/* Stats Grid */}
        {stats && (
          <View style={styles.statsGrid}>
            <AdminCard
              icon="👥"
              title="Total Users"
              value={stats.totalUsers}
              subtitle={`${stats.onlineUsers} online now`}
              color="#10b981"
              onPress={() => navigation.navigate('AdminUsers' as never)}
            />

            <AdminCard
              icon="💬"
              title="Total Rooms"
              value={stats.totalRooms}
              subtitle="Public and private"
              color="#3b82f6"
              onPress={() => navigation.navigate('AdminRooms' as never)}
            />

            <AdminCard
              icon="📨"
              title="Messages Today"
              value={stats.todayMessages}
              subtitle={`${stats.totalMessages} total`}
              color="#8b5cf6"
            />

            <AdminCard
              icon="🟢"
              title="Online Now"
              value={stats.onlineUsers}
              subtitle="Active users"
              color="#10b981"
            />
          </View>
        )}

        {/* Active Users */}
        {stats && stats.activeUsers && stats.activeUsers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Users</Text>
            <View style={styles.activeUsersList}>
              {stats.activeUsers.slice(0, 5).map((user) => (
                <View key={user.id} style={styles.activeUserItem}>
                  <View style={styles.activeUserAvatar}>
                    <Text style={styles.activeUserAvatarText}>
                      {user.username.charAt(0).toUpperCase()}
                    </Text>
                    <View style={styles.activeUserBadge} />
                  </View>
                  <View style={styles.activeUserInfo}>
                    <Text style={styles.activeUserName}>{user.username}</Text>
                    <Text style={styles.activeUserStatus}>Online</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Admin Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('AdminUsers' as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>👥</Text>
              <Text style={styles.actionLabel}>Manage Users</Text>
              <Text style={styles.actionDescription}>
                View, promote, ban, or delete users
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('AdminRooms' as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionLabel}>Manage Rooms</Text>
              <Text style={styles.actionDescription}>
                View, edit, or delete chat rooms
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        {stats && stats.recentActivity && stats.recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityList}>
              {stats.recentActivity.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Text style={styles.activityIconText}>
                      {activity.type === 'user_join' && '👋'}
                      {activity.type === 'user_leave' && '👋'}
                      {activity.type === 'room_create' && '💬'}
                      {activity.type === 'room_delete' && '🗑️'}
                      {activity.type === 'message_delete' && '❌'}
                    </Text>
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDescription}>
                      {activity.description}
                    </Text>
                    <Text style={styles.activityTime}>
                      {new Date(activity.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
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
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 24,
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
  },
  statsGrid: {
    paddingHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  activeUsersList: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
  },
  activeUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3d3d54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  activeUserAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeUserBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#2d2d44',
  },
  activeUserInfo: {
    flex: 1,
  },
  activeUserName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  activeUserStatus: {
    color: '#10b981',
    fontSize: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDescription: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  activityList: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3d3d54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 18,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  activityTime: {
    color: '#666',
    fontSize: 12,
  },
  footer: {
    height: 40,
  },
});

export default AdminScreen;
