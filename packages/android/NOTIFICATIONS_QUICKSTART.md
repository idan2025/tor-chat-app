# Notifications Quick Start Guide

## For Developers

### 1. Show a Custom Notification

```typescript
import NotificationService from './src/services/NotificationService';

// Show message notification
NotificationService.showMessageNotification(
  'Room Name',
  'Sender Name',
  'Message content here',
  'room-id-123',
  'message-id-456'
);

// Show mention notification
NotificationService.showMentionNotification(
  'Room Name',
  'Sender Name',
  '@username check this out!',
  'room-id-123',
  'message-id-456'
);

// Show invite notification
NotificationService.showInviteNotification(
  'Secret Room',
  'Admin User',
  'room-id-789'
);
```

### 2. Manage Badge Count

```typescript
// Set badge count
NotificationService.setBadgeCount(5);

// Get badge count
const count = NotificationService.getBadgeCount();

// Clear badge
NotificationService.clearBadge();
```

### 3. Clear Notifications

```typescript
// Cancel specific notification
NotificationService.cancelNotification(notificationId);

// Cancel all notifications
NotificationService.cancelAllNotifications();
```

### 4. Check/Request Permissions

```typescript
// Check current permissions
const permissions = await NotificationService.checkPermissions();
console.log(permissions); // { alert: true, badge: true, sound: true }

// Request permissions
const granted = await NotificationService.requestPermissions();
if (granted) {
  console.log('Permissions granted!');
}
```

### 5. Access Unread Counts in ChatStore

```typescript
import { useChatStore } from './src/store/chatStore';

// Get unread count for a specific room
const unreadCount = useChatStore.getState().getUnreadCount('room-id');

// Get total unread across all rooms
const totalUnread = useChatStore.getState().getTotalUnreadCount();

// Clear unread for a room
useChatStore.getState().clearUnreadCount('room-id');

// Increment unread (called automatically on new messages)
useChatStore.getState().incrementUnreadCount('room-id');
```

### 6. Load/Save Notification Settings

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings } from './src/types/Notification';

const SETTINGS_KEY = '@notification_settings';

// Load settings
const loadSettings = async () => {
  const stored = await AsyncStorage.getItem(SETTINGS_KEY);
  if (stored) {
    return JSON.parse(stored) as NotificationSettings;
  }
  return null;
};

// Save settings
const saveSettings = async (settings: NotificationSettings) => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
```

### 7. Navigate to Notification Settings

```typescript
// From any screen with navigation
navigation.navigate('NotificationSettings');
```

---

## For Users

### Accessing Notification Settings

**Option 1**: Add to ChatScreen header
```typescript
// In ChatScreen.tsx
<TouchableOpacity
  onPress={() => navigation.navigate('NotificationSettings')}
  style={{ padding: 10 }}
>
  <Icon name="notifications-outline" size={24} color="#fff" />
</TouchableOpacity>
```

**Option 2**: Add to Settings/Profile menu
```typescript
// In SettingsScreen.tsx or ProfileScreen.tsx
<TouchableOpacity
  onPress={() => navigation.navigate('NotificationSettings')}
  style={styles.menuItem}
>
  <Icon name="notifications" size={24} color="#7c3aed" />
  <Text style={styles.menuText}>Notification Settings</Text>
</TouchableOpacity>
```

### Available Settings

1. **Enable Notifications**: Master toggle for all notifications
2. **Sound**: Enable/disable notification sounds
3. **Vibration**: Enable/disable vibration
4. **Mentions Only**: Only get notified when mentioned
5. **Do Not Disturb**: Temporarily disable all notifications
6. **Muted Rooms**: Mute notifications for specific rooms (future)

---

## Common Use Cases

### Disable Notifications Temporarily
```typescript
// User wants quiet time
NotificationService.cancelAllNotifications();

// Or use Do Not Disturb in settings
const settings = await loadSettings();
settings.doNotDisturb = true;
await saveSettings(settings);
```

### Only Get Mentioned Notifications
```typescript
const settings = await loadSettings();
settings.mentionsOnly = true;
await saveSettings(settings);
```

### Custom Room Muting
```typescript
const settings = await loadSettings();
settings.mutedRooms.push('room-id-to-mute');
await saveSettings(settings);
```

---

## Debugging

### Enable Notification Logs
```typescript
// In NotificationService.ts, logs are already included:
console.log('[NotificationService] ...');
```

### Check If Notifications Are Working
```typescript
// Test notification
NotificationService.showMessageNotification(
  'Test Room',
  'Test User',
  'This is a test notification',
  'test-room',
  'test-message'
);
```

### Verify Badge Count
```typescript
const totalUnread = useChatStore.getState().getTotalUnreadCount();
console.log('Total unread:', totalUnread);

NotificationService.setBadgeCount(totalUnread);
```

---

## Architecture Overview

```
User receives message
        ↓
SocketService emits 'message' event
        ↓
chatStore.handleNewMessage() called
        ↓
Check if notification should be shown
        ↓
Load notification settings from AsyncStorage
        ↓
Check for @mention
        ↓
Show appropriate notification (message/mention)
        ↓
Increment unread count
        ↓
Update badge count
        ↓
User taps notification
        ↓
onNotificationTap() in App.tsx
        ↓
Navigate to chat room
        ↓
Clear unread count
        ↓
Update badge count
```

---

## Best Practices

1. **Always check settings**: Load settings before showing notifications
2. **Respect user preferences**: Check enabled, DND, muted rooms
3. **Clear notifications**: When user opens room or app
4. **Update badge**: Keep badge count synchronized with unread counts
5. **Test on devices**: Emulator behavior differs from real devices
6. **Handle permissions**: Always check before showing notifications

---

## TypeScript Types

```typescript
interface NotificationData {
  messageId?: string;
  roomId?: string;
  roomName?: string;
  type: 'message' | 'invite' | 'mention';
}

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  mentionsOnly: boolean;
  doNotDisturb: boolean;
  mutedRooms: string[];
}

interface PushNotificationPermissions {
  alert: boolean;
  badge: boolean;
  sound: boolean;
}
```

---

## Platform Differences

### Android
- Notifications work out of the box (Android 8+)
- POST_NOTIFICATIONS permission required (Android 13+)
- Badge support depends on launcher
- Channels required for Android 8+

### iOS
- Requires permission request on first launch
- Badge always works
- Sound requires permission
- System manages notification center

---

## Troubleshooting Guide

### Notifications Not Appearing

**Check 1**: Permissions granted?
```typescript
const perms = await NotificationService.checkPermissions();
console.log(perms);
```

**Check 2**: Settings enabled?
```typescript
const settings = await loadSettings();
console.log(settings.enabled, settings.doNotDisturb);
```

**Check 3**: App in background?
```typescript
// Notifications only show when app is in background or not in room
```

### Badge Not Updating

**Check 1**: Unread counts correct?
```typescript
console.log(useChatStore.getState().getTotalUnreadCount());
```

**Check 2**: Badge set?
```typescript
NotificationService.setBadgeCount(5);
console.log(NotificationService.getBadgeCount());
```

### Navigation Not Working

**Check 1**: NavigationRef attached?
```typescript
// In App.tsx
<NavigationContainer ref={navigationRef}>
```

**Check 2**: Screen exists?
```typescript
// Verify 'Chat' screen is registered
```

---

## Quick Commands

```bash
# Clear all app data (including notifications)
adb shell pm clear com.torchat

# Check current notifications
adb shell dumpsys notification

# Grant notification permission
adb shell pm grant com.torchat android.permission.POST_NOTIFICATIONS

# Force stop app
adb shell am force-stop com.torchat

# Start app
adb shell am start -n com.torchat/.MainActivity
```

---

## Resources

- [react-native-push-notification docs](https://github.com/zo0r/react-native-push-notification)
- [Android Notification Channels](https://developer.android.com/training/notify-user/channels)
- [iOS Local Notifications](https://developer.apple.com/documentation/usernotifications)

---

Last Updated: 2025-10-31
