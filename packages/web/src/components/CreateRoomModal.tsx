import { useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

interface Props {
  onClose: () => void;
}

export default function CreateRoomModal({ onClose }: Props) {
  const { user } = useAuthStore();
  const isAdmin = user?.isAdmin || false;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Default to private for non-admin users, public for admins
  const [type, setType] = useState<'public' | 'private'>(isAdmin ? 'public' : 'private');
  const { createRoom, error, isLoading } = useChatStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRoom({ name, description, type });
      onClose();
    } catch (error) {
      // Error is handled in store
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">Create Room</h2>

        {error && (
          <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/30 border border-red-500 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
              required
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Room Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'public' | 'private')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
            >
              {isAdmin && <option value="public">Public</option>}
              <option value="private">Private</option>
            </select>
            {!isAdmin && (
              <p className="mt-2 text-sm text-gray-400">
                Only admins can create public rooms
              </p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded transition"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
