import { useEffect, useState } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  roomId?: string;
  onClick?: () => void;
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export default function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setVisibleNotifications(notifications);
  }, [notifications]);

  const handleDismiss = (id: string) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== id));
    setTimeout(() => onDismiss(id), 300);
  };

  const handleClick = (notification: Notification) => {
    if (notification.onClick) {
      notification.onClick();
    }
    handleDismiss(notification.id);
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleClick(notification)}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 cursor-pointer hover:bg-gray-750 transition-all transform animate-slide-in-right"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <div className="font-semibold text-white mb-1">{notification.title}</div>
              <div className="text-sm text-gray-300 line-clamp-2">{notification.message}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(notification.id);
              }}
              className="text-gray-400 hover:text-white flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
