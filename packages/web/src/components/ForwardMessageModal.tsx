import { useState, useMemo } from 'react';
import { Room, Message } from '../types';

interface ForwardMessageModalProps {
  message: Message & { decryptedContent?: string };
  rooms: Room[];
  currentRoomId: string;
  onForward: (roomIds: string[]) => void;
  onClose: () => void;
}

export default function ForwardMessageModal({
  message,
  rooms,
  currentRoomId,
  onForward,
  onClose,
}: ForwardMessageModalProps) {
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter out current room and apply search
  const availableRooms = useMemo(() => {
    return rooms
      .filter(room => room.id !== currentRoomId)
      .filter(room =>
        searchQuery === '' ||
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [rooms, currentRoomId, searchQuery]);

  const handleToggleRoom = (roomId: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const handleForward = () => {
    if (selectedRooms.size > 0) {
      onForward(Array.from(selectedRooms));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg">Forward Message</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message preview */}
        <div className="p-4 border-b border-gray-700 bg-gray-750">
          <div className="text-xs text-gray-400 mb-1">Message to forward:</div>
          <div className="bg-gray-700 rounded p-3">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                {message.sender.displayName?.[0] || message.sender.username[0]}
              </div>
              <span className="text-sm font-medium text-white">
                {message.sender.displayName || message.sender.username}
              </span>
            </div>
            <p className="text-sm text-gray-300 line-clamp-3">{message.decryptedContent}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex items-center space-x-1 mt-2 text-xs text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <span>{message.attachments.length} attachment(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white text-sm"
          />
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availableRooms.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {searchQuery ? 'No rooms found' : 'No other rooms available'}
            </div>
          ) : (
            availableRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleToggleRoom(room.id)}
                className={`w-full p-3 rounded text-left transition ${
                  selectedRooms.has(room.id)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{room.name}</div>
                    {room.description && (
                      <div className="text-xs opacity-75 truncate">{room.description}</div>
                    )}
                  </div>
                  {selectedRooms.has(room.id) && (
                    <svg className="w-5 h-5 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              Cancel
            </button>
            <button
              onClick={handleForward}
              disabled={selectedRooms.size === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition"
            >
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
