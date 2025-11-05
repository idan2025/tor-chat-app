import { useState, useCallback, useEffect, useRef } from 'react';
import { Notification } from '../components/NotificationToast';

const MAX_NOTIFICATIONS = 5;
const AUTO_DISMISS_DELAY = 5000; // 5 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = { ...notification, id };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });

    // Auto dismiss after delay
    const timeoutId = window.setTimeout(() => {
      dismissNotification(id);
    }, AUTO_DISMISS_DELAY);

    timeoutsRef.current.set(id, timeoutId);

    // Request browser notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/logo.png', // You can add a logo
          badge: '/logo.png',
          tag: id,
          requireInteraction: false,
        });

        browserNotification.onclick = () => {
          window.focus();
          if (notification.onClick) {
            notification.onClick();
          }
          dismissNotification(id);
          browserNotification.close();
        };
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }

    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    // Clear timeout
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutsRef.current.clear();

    setNotifications([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  };
}
