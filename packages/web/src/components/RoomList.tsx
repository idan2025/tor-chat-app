import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { Room } from '../types';

export default function RoomList() {
  const { rooms, currentRoom, selectRoom, isLoading, unreadCounts, messages } = useChatStore();

  // Sort rooms: unread first, then by most recent activity
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const unreadA = unreadCounts.get(a.id) || 0;
      const unreadB = unreadCounts.get(b.id) || 0;

      // Rooms with unread messages first
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;

      // Then by most recent message
      const messagesA = messages.get(a.id) || [];
      const messagesB = messages.get(b.id) || [];
      const lastMessageA = messagesA[messagesA.length - 1];
      const lastMessageB = messagesB[messagesB.length - 1];

      if (lastMessageA && lastMessageB) {
        return new Date(lastMessageB.createdAt).getTime() - new Date(lastMessageA.createdAt).getTime();
      }
      if (lastMessageA) return -1;
      if (lastMessageB) return 1;

      // Finally by room creation date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rooms, unreadCounts, messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Loading rooms...</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-gray-400 text-center">
          No rooms yet. Create or join a room to start chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-1">
        {sortedRooms.map((room) => {
          const unreadCount = unreadCounts.get(room.id) || 0;
          const hasUnread = unreadCount > 0;

          return (
            <button
              key={room.id}
              onClick={() => selectRoom(room.id)}
              className={`w-full p-3 rounded text-left transition relative ${
                currentRoom?.id === room.id
                  ? 'bg-purple-600 text-white'
                  : hasUnread
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'hover:bg-gray-700 text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className={`${hasUnread ? 'font-bold' : 'font-semibold'} flex items-center`}>
                    {hasUnread && (
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2 flex-shrink-0"></span>
                    )}
                    <span className="truncate">{room.name}</span>
                  </div>
                  {room.description && (
                    <div className="text-sm opacity-75 truncate">{room.description}</div>
                  )}
                </div>
                {hasUnread && (
                  <div className="ml-2 flex-shrink-0">
                    <span className="bg-purple-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
