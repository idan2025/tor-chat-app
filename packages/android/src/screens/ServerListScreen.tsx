import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useServerStore } from '../store/serverStore';
import ServerCard from '../components/ServerCard';
import { Server } from '../types/Server';

export default function ServerListScreen({ navigation }: any) {
  const {
    servers,
    activeServer,
    isLoading,
    error,
    loadServers,
    switchServer,
    deleteServer,
    clearError,
  } = useServerStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadServers();
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
    setRefreshing(true);
    await loadServers();
    setRefreshing(false);
  };

  const handleSelectServer = async (server: Server) => {
    try {
      await switchServer(server.id);
      Toast.show({
        type: 'success',
        text1: 'Server Selected',
        text2: `Switched to ${server.name}`,
      });

      // Navigate to login/chat if server has auth
      if (server.token && server.user) {
        navigation.navigate('Chat');
      } else {
        navigation.navigate('Login');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to switch server',
      });
    }
  };

  const handleDeleteServer = async (server: Server) => {
    try {
      await deleteServer(server.id);
      Toast.show({
        type: 'success',
        text1: 'Server Deleted',
        text2: `${server.name} has been removed`,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to delete server',
      });
    }
  };

  const handleAddServer = () => {
    navigation.navigate('AddServer');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🌐</Text>
      <Text style={styles.emptyTitle}>No Servers Added</Text>
      <Text style={styles.emptyText}>
        Add your first TOR hidden service to get started
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleAddServer}>
        <Text style={styles.emptyButtonText}>Add Server</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Servers</Text>
        <Text style={styles.subtitle}>
          {servers.length} server{servers.length !== 1 ? 's' : ''}
          {activeServer && ` • ${activeServer.name} active`}
        </Text>
      </View>
    </View>
  );

  if (isLoading && servers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading servers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {servers.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ServerCard
              server={item}
              onPress={handleSelectServer}
              onDelete={handleDeleteServer}
              showDeleteButton={true}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7c3aed"
              colors={['#7c3aed']}
            />
          }
          ListFooterComponent={
            <View style={styles.footerSpacer} />
          }
        />
      )}

      {/* Add Server Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Add Server</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
    marginTop: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  footerSpacer: {
    height: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
