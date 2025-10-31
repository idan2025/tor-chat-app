# Adding Notification Settings Button to UI

## Quick Integration Guide

The notification system is fully implemented and ready to use. You just need to add UI buttons to access the `NotificationSettings` screen.

---

## Option 1: Add to ChatScreen Header (Recommended)

### Location
`/home/idan/Projects/tor-chat-app/packages/android/src/screens/ChatScreen.tsx`

### Code to Add

```typescript
import React, { useLayoutEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// Inside ChatScreen component, add this useLayoutEffect hook:

useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <TouchableOpacity
        onPress={() => navigation.navigate('NotificationSettings')}
        style={{ paddingRight: 15 }}
      >
        <Icon name="notifications-outline" size={24} color="#fff" />
      </TouchableOpacity>
    ),
  });
}, [navigation]);
```

### Result
- Bell icon appears in the top-right corner of ChatScreen
- Tapping it opens the Notification Settings screen

---

## Option 2: Add to Settings/Profile Screen

If you have a Settings or Profile screen, add a menu item:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const SettingsScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      {/* Other menu items... */}

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('NotificationSettings')}
      >
        <Icon name="notifications" size={24} color="#7c3aed" />
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuTitle}>Notification Settings</Text>
          <Text style={styles.menuSubtitle}>
            Manage notification preferences
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color="#888" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  menuTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});
```

---

## Option 3: Add to Admin Panel

If you want admins to have quick access:

```typescript
// In AdminScreen.tsx

<TouchableOpacity
  style={styles.adminButton}
  onPress={() => navigation.navigate('NotificationSettings')}
>
  <Icon name="notifications" size={24} color="#fff" />
  <Text style={styles.buttonText}>Notification Settings</Text>
</TouchableOpacity>
```

---

## Option 4: Floating Action Button

Add a floating action button to the main chat screen:

```typescript
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const ChatScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      {/* Your existing chat UI */}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NotificationSettings')}
      >
        <Icon name="notifications" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
```

---

## Option 5: Context Menu (Long Press)

Add to a message context menu:

```typescript
const messageContextMenu = [
  { text: 'Reply', onPress: () => handleReply() },
  { text: 'Edit', onPress: () => handleEdit() },
  { text: 'Delete', onPress: () => handleDelete() },
  {
    text: 'Notification Settings',
    onPress: () => navigation.navigate('NotificationSettings')
  },
];
```

---

## Testing the Integration

After adding the button:

1. **Build and run the app**
   ```bash
   cd /home/idan/Projects/tor-chat-app/packages/android
   npm run android
   ```

2. **Navigate to the button location**
   - Open the app
   - Go to the screen where you added the button
   - Tap the notification icon/button

3. **Verify settings screen opens**
   - Check that NotificationSettings screen appears
   - Verify all toggles and buttons work
   - Toggle settings and save
   - Close and reopen to verify persistence

4. **Test notification functionality**
   - Put app in background
   - Send a message from another device
   - Verify notification appears
   - Tap notification
   - Verify navigates to chat room

---

## Badge Count Display (Optional)

If you want to show the unread count on the notification icon:

```typescript
import { useChatStore } from '../store/chatStore';

const ChatScreen = ({ navigation }) => {
  const totalUnread = useChatStore((state) => state.getTotalUnreadCount());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationSettings')}
          style={{ paddingRight: 15 }}
        >
          <View>
            <Icon name="notifications-outline" size={24} color="#fff" />
            {totalUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation, totalUnread]);

  return (
    // ... your chat UI
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
```

---

## Complete Example: ChatScreen Header with Notification Badge

Here's a complete working example you can copy-paste:

```typescript
import React, { useLayoutEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useChatStore } from '../store/chatStore';

const ChatScreen = ({ navigation }) => {
  const totalUnread = useChatStore((state) => state.getTotalUnreadCount());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', paddingRight: 10 }}>
          {/* Notification Settings Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('NotificationSettings')}
            style={{ marginHorizontal: 10, position: 'relative' }}
          >
            <Icon name="notifications-outline" size={24} color="#fff" />
            {totalUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, totalUnread]);

  return (
    // ... your existing ChatScreen UI
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default ChatScreen;
```

---

## Troubleshooting

### Icon not showing
```bash
# Make sure react-native-vector-icons is linked
cd android && ./gradlew clean && cd ..
npm run android
```

### Navigation error
```typescript
// Make sure NotificationSettings screen is registered in App.tsx
// It should already be there from Phase 5 implementation
```

### Badge count not updating
```typescript
// Make sure you're using the zustand hook
const totalUnread = useChatStore((state) => state.getTotalUnreadCount());
// This will auto-update when unread count changes
```

---

## Recommended Placement

**Best Option**: ChatScreen Header (Option 1)
- Most accessible to users
- Visible on main screen
- Consistent with messaging apps
- Shows unread badge
- Clean UI integration

---

## Next Steps

1. Choose one of the options above
2. Add the code to the appropriate screen
3. Test the navigation
4. Test notification functionality
5. Verify settings persistence

---

**That's it!** The notification system is fully functional and ready to use.
