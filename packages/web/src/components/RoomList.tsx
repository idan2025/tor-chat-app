import { useChatStore } from '../store/chatStore';

export default function RoomList() {
  const { rooms, currentRoom, selectRoom, isLoading } = useChatStore();

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
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => selectRoom(room.id)}
            className={`w-full p-3 rounded text-left transition ${
              currentRoom?.id === room.id
                ? 'bg-purple-600 text-white'
                : 'hover:bg-gray-700 text-gray-300'
            }`}
          >
            <div className="font-semibold">{room.name}</div>
            {room.description && (
              <div className="text-sm opacity-75 truncate">{room.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
