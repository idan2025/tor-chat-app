import { useEffect, useState } from 'react';
import { Room, User, RoomMember } from '../types';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';

interface RoomSettingsProps {
  room: Room;
  members: RoomMember[];
  onClose: () => void;
}

export default function RoomSettings({ room, members, onClose }: RoomSettingsProps) {
  const { user } = useAuthStore();
  const { deleteRoom, addMember, removeMember } = useChatStore();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreator = user?.id === room.creatorId;
  const isAdmin = user?.isAdmin;
  const canManageRoom = isCreator || isAdmin;
  const canDeleteRoom = room.type === 'private' && canManageRoom;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setAllUsers(data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirm(`Are you sure you want to delete the room "${room.name}"?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await deleteRoom(room.id);
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete room');
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setIsLoading(true);
    setError(null);
    try {
      await addMember(room.id, selectedUserId);
      setSelectedUserId('');
      setIsLoading(false);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to add member');
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await removeMember(room.id, userId);
      setIsLoading(false);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to remove member');
      setIsLoading(false);
    }
  };

  // Filter out users who are already members
  const memberUserIds = new Set(members.map((m) => m.user.id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Room Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-400 mt-2">{room.name}</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-400 bg-red-900/30 border border-red-500 rounded">
              {error}
            </div>
          )}

          {/* Room Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Room Info</h3>
            <div className="space-y-2 text-gray-300">
              <p>
                <span className="text-gray-400">Type:</span>{' '}
                <span className="capitalize">{room.type}</span>
              </p>
              {room.description && (
                <p>
                  <span className="text-gray-400">Description:</span> {room.description}
                </p>
              )}
              <p>
                <span className="text-gray-400">Members:</span> {members.length}
                {room.maxMembers && ` / ${room.maxMembers}`}
              </p>
            </div>
          </div>

          {/* Members List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Members</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
                      {member.user.displayName?.[0] || member.user.username[0]}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {member.user.displayName || member.user.username}
                      </p>
                      <p className="text-sm text-gray-400 capitalize">{member.role}</p>
                    </div>
                  </div>
                  {canManageRoom && member.user.id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.user.id)}
                      disabled={isLoading}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Member (Private Rooms) */}
          {room.type === 'private' && canManageRoom && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Add Member</h3>
              <div className="flex space-x-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
                  disabled={isLoading}
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.username} (@{user.username})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || isLoading}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded transition"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Delete Room */}
          {canDeleteRoom && (
            <div className="pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Danger Zone</h3>
              <button
                onClick={handleDeleteRoom}
                disabled={isLoading}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded transition"
              >
                Delete Room
              </button>
              <p className="text-sm text-gray-400 mt-2">
                This action cannot be undone. All messages will be permanently deleted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
