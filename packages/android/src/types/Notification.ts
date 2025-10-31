/**
 * Notification Types
 *
 * Type definitions for the notification system
 */

/**
 * Notification data passed with each notification
 * Used for navigation when notification is tapped
 */
export interface NotificationData {
  messageId?: string;
  roomId?: string;
  roomName?: string;
  type: 'message' | 'invite' | 'mention';
}

/**
 * User notification settings/preferences
 */
export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  mentionsOnly: boolean;
  doNotDisturb: boolean;
  mutedRooms: string[];
}

/**
 * Push notification permissions (iOS)
 */
export interface PushNotificationPermissions {
  alert: boolean;
  badge: boolean;
  sound: boolean;
}

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  sound: true,
  vibration: true,
  mentionsOnly: false,
  doNotDisturb: false,
  mutedRooms: [],
};
