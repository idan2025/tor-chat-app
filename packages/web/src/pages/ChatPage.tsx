import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import RoomList from '../components/RoomList';
import ChatRoom from '../components/ChatRoom';
import CreateRoomModal from '../components/CreateRoomModal';

export default function ChatPage() {
  const { user, logout } = useAuthStore();
  const { loadRooms } = useChatStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* User header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">TOR Chat</h2>
              <p className="text-sm text-gray-400">{user?.displayName || user?.username}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition"
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
      <div className="flex-1 flex flex-col">
        <ChatRoom />
      </div>

      {/* Create room modal */}
      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
