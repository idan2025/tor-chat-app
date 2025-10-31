import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from './src/store/authStore';
import { useServerStore } from './src/store/serverStore';
import { useChatStore } from './src/store/chatStore';
import NotificationService from './src/services/NotificationService';
import { NotificationData } from './src/types/Notification';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import AdminRoomsScreen from './src/screens/AdminRoomsScreen';
import ForwardMessageScreen from './src/screens/ForwardMessageScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';

const Stack = createNativeStackNavigator();

function App(): JSX.Element {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const activeServer = useServerStore((state) => state.activeServer);
  const isAdmin = activeServer?.user?.isAdmin || false;
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Initialize notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[App] Initializing notification service...');

    // Configure notifications with navigation handler
    NotificationService.configure((data: NotificationData) => {
      console.log('[App] Notification tapped:', data);

      if (!navigationRef.current) {
        console.warn('[App] Navigation ref not ready');
        return;
      }

      if (data.type === 'message' || data.type === 'mention') {
        // Navigate to chat screen
        navigationRef.current.navigate('Chat', {
          roomId: data.roomId,
          roomName: data.roomName,
        });

        // Clear unread count for this room
        if (data.roomId) {
          useChatStore.getState().clearUnreadCount(data.roomId);
        }
      } else if (data.type === 'invite') {
        // Navigate to chat screen (room list)
        navigationRef.current.navigate('Chat');
      }
    });

    // Request permissions
    NotificationService.requestPermissions().then((granted) => {
      if (granted) {
        console.log('[App] Notification permissions granted');
      } else {
        console.log('[App] Notification permissions denied');
      }
    });

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[App] AppState changed to:', nextAppState);

      if (nextAppState === 'active') {
        // Clear unread for current room when app becomes active
        const currentRoomId = useChatStore.getState().currentRoomId;
        if (currentRoomId) {
          useChatStore.getState().clearUnreadCount(currentRoomId);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {!isAuthenticated ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: 'TOR Chat' }}
              />
              {/* Admin Routes - Only accessible to admin users */}
              {isAdmin && (
                <>
                  <Stack.Screen
                    name="Admin"
                    component={AdminScreen}
                    options={{
                      title: 'Admin Panel',
                      headerStyle: { backgroundColor: '#1a1a2e' },
                      headerTintColor: '#fff',
                    }}
                  />
                  <Stack.Screen
                    name="AdminUsers"
                    component={AdminUsersScreen}
                    options={{
                      title: 'Manage Users',
                      headerStyle: { backgroundColor: '#1a1a2e' },
                      headerTintColor: '#fff',
                    }}
                  />
                  <Stack.Screen
                    name="AdminRooms"
                    component={AdminRoomsScreen}
                    options={{
                      title: 'Manage Rooms',
                      headerStyle: { backgroundColor: '#1a1a2e' },
                      headerTintColor: '#fff',
                    }}
                  />
                </>
              )}
              {/* Forward Message Screen - Available to all users */}
              <Stack.Screen
                name="ForwardMessage"
                component={ForwardMessageScreen}
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              {/* Notification Settings - Available to all users */}
              <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
                options={{
                  title: 'Notification Settings',
                  headerStyle: { backgroundColor: '#1a1a2e' },
                  headerTintColor: '#fff',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
}

export default App;
