declare module 'react-native-push-notification' {
  export interface PushNotificationPermissions {
    alert?: boolean;
    badge?: boolean;
    sound?: boolean;
  }

  export interface ChannelObject {
    channelId: string;
    channelName: string;
    channelDescription?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: number;
    vibrate?: boolean;
  }

  export interface PushNotification {
    configure(options: any): void;
    localNotification(details: any): void;
    createChannel(channel: ChannelObject, callback: (created: boolean) => void): void;
    cancelAllLocalNotifications(): void;
    requestPermissions(permissions?: PushNotificationPermissions): Promise<any>;
    checkPermissions(callback: (permissions: PushNotificationPermissions) => void): void;
    setApplicationIconBadgeNumber(number: number): void;
  }

  const PushNotificationInstance: PushNotification;
  export default PushNotificationInstance;
}
