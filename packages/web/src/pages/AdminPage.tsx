import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';
import { User, Room } from '../types';

type Tab = 'users' | 'rooms' | 'stats';

export default function AdminPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<{ users: number; rooms: number; messages: number; onlineUsers: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/chat');
      return;
    }
    loadData();
  }, [user, navigate, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const data = await apiService.getAdminUsers();
        setUsers(data.users);
      } else if (activeTab === 'rooms') {
        const data = await apiService.getAdminRooms();
        setRooms(data.rooms);
      } else if (activeTab === 'stats') {
        const data = await apiService.getAdminStats();
        setStats(data);
      }
      setIsLoading(false);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load data');
      setIsLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      if (currentIsAdmin) {
        await apiService.demoteUser(userId);
      } else {
        await apiService.promoteUser(userId);
      }
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to toggle admin status');
    }
  };

  const handleBanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to ban user "${username}"? They will be unable to login.`)) {
      return;
    }

    try {
      await apiService.banUser(userId);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to unban user "${username}"?`)) {
      return;
    }

    try {
      await apiService.unbanUser(userId);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to unban user');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteUser(userId);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`Are you sure you want to delete room "${roomName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteAdminRoom(roomId);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete room');
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
          >
            Back to Chat
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700">
        <div className="flex space-x-1 p-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-2 rounded transition ${
              activeTab === 'stats'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded transition ${
              activeTab === 'users'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-6 py-2 rounded transition ${
              activeTab === 'rooms'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Rooms
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 text-sm text-red-400 bg-red-900/30 border border-red-500 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400 text-xl">Loading...</p>
          </div>
        ) : (
          <>
            {/* Statistics Tab */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Total Users</h3>
                  <p className="text-white text-4xl font-bold">{stats.users}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Online Users</h3>
                  <p className="text-white text-4xl font-bold">{stats.onlineUsers}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Total Rooms</h3>
                  <p className="text-white text-4xl font-bold">{stats.rooms}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Total Messages</h3>
                  <p className="text-white text-4xl font-bold">{stats.messages}</p>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                        {u.displayName?.[0] || u.username[0]}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {u.displayName || u.username}
                          {u.isAdmin && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-600 text-white rounded">
                              ADMIN
                            </span>
                          )}
                          {u.isBanned && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded">
                              BANNED
                            </span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">@{u.username}</p>
                        <p className="text-gray-500 text-xs">
                          {u.isOnline ? (
                            <span className="text-green-400">Online</span>
                          ) : (
                            <span>Last seen: {new Date(u.lastSeen).toLocaleString()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {u.id !== user.id && (
                        <>
                          <button
                            onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                            className={`px-3 py-2 rounded transition text-sm ${
                              u.isAdmin
                                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {u.isAdmin ? 'Demote' : 'Promote'}
                          </button>
                          {u.isBanned ? (
                            <button
                              onClick={() => handleUnbanUser(u.id, u.username)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition text-sm"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBanUser(u.id, u.username)}
                              className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition text-sm"
                            >
                              Ban
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rooms Tab */}
            {activeTab === 'rooms' && (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium text-lg">
                        {room.name}
                        <span className="ml-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded capitalize">
                          {room.type}
                        </span>
                      </p>
                      {room.description && (
                        <p className="text-gray-400 text-sm mt-1">{room.description}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">
                        Created: {new Date(room.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRoom(room.id, room.name)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
