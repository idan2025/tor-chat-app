import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { useServerStore } from '../store/serverStore';
import { Server } from '../types/Server';

export default function LoginScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showServerList, setShowServerList] = useState(false);

  const { login, isLoading: authLoading } = useAuthStore();
  const { servers, loadServers, isLoading: serversLoading } = useServerStore();

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  // Auto-select first server or active server
  useEffect(() => {
    if (servers.length > 0 && !selectedServer) {
      const activeServer = servers.find((s) => s.isActive);
      setSelectedServer(activeServer || servers[0]);
    }
  }, [servers]);

  const handleLogin = async () => {
    // Validate server selection
    if (!selectedServer) {
      Toast.show({
        type: 'error',
        text1: 'No Server Selected',
        text2: 'Please select a server or add one in settings',
      });
      return;
    }

    // Validate credentials
    if (!username.trim() || !password.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: 'Please enter both username and password',
      });
      return;
    }

    try {
      await login({
        username: username.trim(),
        password: password.trim(),
        server: selectedServer,
      });
      // Navigation happens automatically via auth state change
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.message || 'Please check your credentials and connection',
      });
    }
  };

  const handleServerSelect = (server: Server) => {
    setSelectedServer(server);
    setShowServerList(false);
  };

  const isLoading = authLoading || serversLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>TOR Chat</Text>
          <Text style={styles.subtitle}>Secure & Anonymous</Text>

          <View style={styles.form}>
            {/* Server Selector */}
            <View style={styles.serverSection}>
              <Text style={styles.label}>Server</Text>
              {servers.length === 0 ? (
                <View style={styles.noServerContainer}>
                  <Text style={styles.noServerText}>
                    No servers configured
                  </Text>
                  <TouchableOpacity
                    style={styles.addServerButton}
                    onPress={() => navigation.navigate('ServerManagement')}
                  >
                    <Text style={styles.addServerButtonText}>Add Server</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.serverSelector}
                    onPress={() => setShowServerList(!showServerList)}
                    disabled={isLoading}
                  >
                    <View style={styles.serverInfo}>
                      <Text style={styles.serverName}>
                        {selectedServer?.name || 'Select Server'}
                      </Text>
                      <Text style={styles.serverAddress}>
                        {selectedServer?.onionAddress || 'No server selected'}
                      </Text>
                    </View>
                    <Text style={styles.dropdownIcon}>
                      {showServerList ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {/* Server Dropdown List */}
                  {showServerList && (
                    <View style={styles.serverList}>
                      {servers.map((server) => (
                        <TouchableOpacity
                          key={server.id}
                          style={[
                            styles.serverItem,
                            selectedServer?.id === server.id &&
                              styles.serverItemSelected,
                          ]}
                          onPress={() => handleServerSelect(server)}
                        >
                          <Text style={styles.serverItemName}>
                            {server.name}
                          </Text>
                          <Text style={styles.serverItemAddress}>
                            {server.onionAddress}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => navigation.navigate('ServerManagement')}
                  >
                    <Text style={styles.manageServersLink}>
                      Manage Servers
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Login Form */}
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading || servers.length === 0}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
            >
              <Text style={styles.link}>Don't have an account? Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 15,
  },
  serverSection: {
    marginBottom: 10,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  serverSelector: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3d3d54',
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  serverAddress: {
    color: '#999',
    fontSize: 12,
  },
  dropdownIcon: {
    color: '#7c3aed',
    fontSize: 12,
    marginLeft: 10,
  },
  serverList: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3d3d54',
    maxHeight: 200,
  },
  serverItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d54',
  },
  serverItemSelected: {
    backgroundColor: '#3d3d54',
  },
  serverItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  serverItemAddress: {
    color: '#999',
    fontSize: 12,
  },
  manageServersLink: {
    color: '#7c3aed',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'right',
  },
  noServerContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3d54',
    borderStyle: 'dashed',
  },
  noServerText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  addServerButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addServerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#5a2ba3',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#7c3aed',
    textAlign: 'center',
    marginTop: 15,
    fontSize: 16,
  },
});
