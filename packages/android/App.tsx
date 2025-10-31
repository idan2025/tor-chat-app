import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from './src/store/authStore';
import { useServerStore } from './src/store/serverStore';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import AdminRoomsScreen from './src/screens/AdminRoomsScreen';
import ForwardMessageScreen from './src/screens/ForwardMessageScreen';

const Stack = createNativeStackNavigator();

function App(): JSX.Element {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const activeServer = useServerStore((state) => state.activeServer);
  const isAdmin = activeServer?.user?.isAdmin || false;

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <NavigationContainer>
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
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
}

export default App;
