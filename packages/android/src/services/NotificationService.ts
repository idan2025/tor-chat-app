/**
 * NotificationService - Local Push Notifications
 *
 * Manages local push notifications for:
 * - New messages
 * - Room invites
 * - Mentions
 *
 * Features:
 * - Local notifications only (no Firebase)
 * - Notification channels (Android 8+)
 * - Badge count management
 * - Tap-to-navigate
 * - Sound and vibration control
 */

import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

// Notification importance levels for Android
const Importance = {
  DEFAULT: 3,
  HIGH: 4,
  LOW: 2,
  MIN: 1,
};

export interface NotificationData {
  messageId?: string;
  roomId?: string;
  roomName?: string;
  type: 'message' | 'invite' | 'mention';
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  mentionsOnly: boolean;
  doNotDisturb: boolean;
  mutedRooms: string[];
}

class NotificationService {
  private static configured = false;
  private static unreadCount = 0;

  /**
   * Configure notification system
   * Must be called on app startup
   */
  static configure(onNotificationTap: (data: NotificationData) => void): void {
    if (this.configured) return;

    // Create notification channels (Android 8+)
    PushNotification.createChannel(
      {
        channelId: 'chat-messages',
        channelName: 'Chat Messages',
        channelDescription: 'Notifications for new messages',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`[NotificationService] Channel 'chat-messages' created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'room-invites',
        channelName: 'Room Invites',
        channelDescription: 'Notifications for room invitations',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`[NotificationService] Channel 'room-invites' created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'mentions',
        channelName: 'Mentions',
        channelDescription: 'Notifications for mentions',
        importance: Importance.HIGH,
        vibrate: true,
        playSound: true,
      },
      (created) => console.log(`[NotificationService] Channel 'mentions' created: ${created}`)
    );

    // Configure notification handler
    PushNotification.configure({
      // Called when notification is tapped
      onNotification: (notification: any) => {
        console.log('[NotificationService] Notification tapped:', notification);

        // Only handle if user tapped notification
        if (notification.userInteraction && notification.data) {
          onNotificationTap(notification.data as NotificationData);
        }

        // Required on iOS only
        if (notification.finish) {
          notification.finish();
        }
      },

      // Permissions (iOS)
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // Request permissions on iOS
      requestPermissions: Platform.OS === 'ios',
    });

    this.configured = true;
    console.log('[NotificationService] Configured successfully');
  }

  /**
   * Show notification for new message
   */
  static showMessageNotification(
    roomName: string,
    senderName: string,
    message: string,
    roomId: string,
    messageId: string,
    settings?: NotificationSettings
  ): void {
    // Check if notifications are enabled
    if (settings && (!settings.enabled || settings.doNotDisturb)) {
      return;
    }

    // Check if room is muted
    if (settings?.mutedRooms.includes(roomId)) {
      return;
    }

    // Check if mentions only mode
    if (settings?.mentionsOnly) {
      return; // Don't show regular messages in mentions-only mode
    }

    // Truncate long messages
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;

    this.unreadCount++;

    PushNotification.localNotification({
      channelId: 'chat-messages',
      title: roomName,
      message: `${senderName}: ${truncatedMessage}`,
      playSound: settings?.sound !== false,
      soundName: 'default',
      vibrate: settings?.vibration !== false,
      badge: this.unreadCount,
      userInfo: {
        type: 'message',
        roomId,
        messageId,
        roomName,
      },
      smallIcon: 'ic_notification',
      largeIcon: 'ic_launcher',
      color: '#7c3aed', // Purple color for app branding
    });

    console.log(`[NotificationService] Message notification: ${roomName} - ${senderName}`);
  }

  /**
   * Show notification for room invite
   */
  static showInviteNotification(
    roomName: string,
    inviterName: string,
    roomId: string,
    settings?: NotificationSettings
  ): void {
    // Check if notifications are enabled
    if (settings && (!settings.enabled || settings.doNotDisturb)) {
      return;
    }

    PushNotification.localNotification({
      channelId: 'room-invites',
      title: 'Room Invitation',
      message: `${inviterName} invited you to ${roomName}`,
      playSound: settings?.sound !== false,
      soundName: 'default',
      vibrate: settings?.vibration !== false,
      userInfo: {
        type: 'invite',
        roomId,
        roomName,
      },
      smallIcon: 'ic_notification',
      largeIcon: 'ic_launcher',
      color: '#7c3aed',
    });

    console.log(`[NotificationService] Invite notification: ${roomName} from ${inviterName}`);
  }

  /**
   * Show notification for mention
   */
  static showMentionNotification(
    roomName: string,
    senderName: string,
    message: string,
    roomId: string,
    messageId: string,
    settings?: NotificationSettings
  ): void {
    // Check if notifications are enabled
    if (settings && (!settings.enabled || settings.doNotDisturb)) {
      return;
    }

    // Check if room is muted
    if (settings?.mutedRooms.includes(roomId)) {
      return;
    }

    // Truncate long messages
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;

    this.unreadCount++;

    PushNotification.localNotification({
      channelId: 'mentions',
      title: `${roomName} - Mentioned`,
      message: `${senderName}: ${truncatedMessage}`,
      playSound: settings?.sound !== false,
      soundName: 'default',
      vibrate: settings?.vibration !== false,
      priority: 'high',
      badge: this.unreadCount,
      userInfo: {
        type: 'mention',
        roomId,
        messageId,
        roomName,
      },
      smallIcon: 'ic_notification',
      largeIcon: 'ic_launcher',
      color: '#7c3aed',
    });

    console.log(`[NotificationService] Mention notification: ${roomName} - ${senderName}`);
  }

  /**
   * Update badge count
   */
  static setBadgeCount(count: number): void {
    this.unreadCount = count;
    PushNotification.setApplicationIconBadgeNumber(count);
    console.log(`[NotificationService] Badge count set to ${count}`);
  }

  /**
   * Get current badge count
   */
  static getBadgeCount(): number {
    return this.unreadCount;
  }

  /**
   * Cancel notification by ID
   */
  static cancelNotification(notificationId: number): void {
    // Note: react-native-push-notification doesn't support canceling by ID on all platforms
    // Using cancelAllLocalNotifications as fallback
    PushNotification.cancelAllLocalNotifications();
    console.log(`[NotificationService] Cancelled notification ${notificationId}`);
  }

  /**
   * Cancel all notifications
   */
  static cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
    console.log('[NotificationService] Cancelled all notifications');
  }

  /**
   * Clear badge
   */
  static clearBadge(): void {
    this.unreadCount = 0;
    PushNotification.setApplicationIconBadgeNumber(0);
    console.log('[NotificationService] Badge cleared');
  }

  /**
   * Request permissions (iOS)
   * On Android, permissions are automatically granted
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Android permissions are handled in AndroidManifest.xml
      // For Android 13+, we need to request POST_NOTIFICATIONS at runtime
      if (Platform.Version >= 33) {
        // This will be handled by react-native-push-notification library
        return true;
      }
      return true;
    }

    // iOS - check and request permissions
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions) => {
        if (permissions.alert && permissions.badge && permissions.sound) {
          console.log('[NotificationService] Permissions already granted');
          resolve(true);
        } else {
          console.log('[NotificationService] Requesting permissions...');
          PushNotification.requestPermissions({
            alert: true,
            badge: true,
            sound: true,
          }).then(() => {
            console.log('[NotificationService] Permissions granted');
            resolve(true);
          });
        }
      });
    });
  }

  /**
   * Check if notifications are enabled
   */
  static async checkPermissions(): Promise<{ alert: boolean; badge: boolean; sound: boolean }> {
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions) => {
        resolve(permissions);
      });
    });
  }

  /**
   * Get channel notification settings (for settings screen)
   */
  static getChannelInfo(): void {
    if (Platform.OS === 'android') {
      // This can be extended to fetch channel settings
      console.log('[NotificationService] Checking channel info...');
    }
  }

  /**
   * Reset service (for testing or logout)
   */
  static reset(): void {
    this.cancelAllNotifications();
    this.clearBadge();
    console.log('[NotificationService] Reset complete');
  }
}

export default NotificationService;
