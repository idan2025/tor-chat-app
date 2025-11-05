import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import RoomList from '../components/RoomList';
import ChatRoom from '../components/ChatRoom';
import CreateRoomModal from '../components/CreateRoomModal';
import NotificationToast from '../components/NotificationToast';
import { useNotifications } from '../hooks/useNotifications';
import { socketService } from '../services/socket';

export default function ChatPage() {
  const { user, logout } = useAuthStore();
  const { loadRooms, currentRoom, getTotalUnreadCount, rooms, selectRoom } = useChatStore();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const totalUnread = getTotalUnreadCount();
  const { notifications, addNotification, dismissNotification } = useNotifications();

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Close sidebar when room is selected on mobile
  useEffect(() => {
    if (currentRoom) {
      setSidebarOpen(false);
    }
  }, [currentRoom]);

  // Listen for new messages and show notifications
  useEffect(() => {
    const handleMessage = (message: any) => {
      // Only show notification if:
      // 1. Message is not from current user
      // 2. Message is in a different room than currently viewing
      if (
        message.sender.id !== user?.id &&
        message.roomId !== currentRoom?.id
      ) {
        const room = rooms.find(r => r.id === message.roomId);
        const roomName = room?.name || 'Unknown Room';

        addNotification({
          title: `${message.sender.displayName || message.sender.username} in ${roomName}`,
          message: message.encryptedContent?.substring(0, 100) || 'New message',
          roomId: message.roomId,
          onClick: () => {
            selectRoom(message.roomId);
            setSidebarOpen(false);
          },
        });

        // Play notification sound (optional)
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {
            // Ignore autoplay restrictions
          });
        } catch {
          // Ignore audio errors
        }
      }
    };

    socketService.on('message', handleMessage);

    return () => {
      socketService.off('message', handleMessage);
    };
  }, [user?.id, currentRoom?.id, rooms, addNotification, selectRoom]);

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden" style={{ height: '100dvh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30
        w-80 bg-gray-800 border-r border-gray-700 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* User header */}
        <div className="p-3 md:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <h2 className="text-lg md:text-xl font-bold text-white">TOR Chat</h2>
              {totalUnread > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mb-2">
            {user?.displayName || user?.username}
            {user?.isAdmin && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded">
                ADMIN
              </span>
            )}
          </p>
          <div className="flex gap-2">
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex-1 px-2 py-1 text-xs md:text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition"
              >
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="flex-1 px-2 py-1 text-xs md:text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Create room button */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded transition"
          >
            + Create Room
          </button>
        </div>

        {/* Room list */}
        <RoomList />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with hamburger */}
        <div className="md:hidden flex items-center p-3 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white mr-3 relative"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
          <h1 className="text-lg font-bold text-white truncate">
            {currentRoom ? currentRoom.name : 'TOR Chat'}
          </h1>
        </div>

        <ChatRoom />
      </div>

      {/* Create room modal */}
      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}

      {/* Notification Toasts */}
      <NotificationToast notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
}
