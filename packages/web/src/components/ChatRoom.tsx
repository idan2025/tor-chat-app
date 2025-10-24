import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { format } from 'date-fns';

export default function ChatRoom() {
  const { currentRoom, messages, sendMessage } = useChatStore();
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomMessages = currentRoom ? messages.get(currentRoom.id) || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentRoom) return;

    try {
      await sendMessage(currentRoom.id, messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!currentRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-xl">Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Room header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <h2 className="text-xl font-bold text-white">{currentRoom.name}</h2>
        {currentRoom.description && (
          <p className="text-sm text-gray-400">{currentRoom.description}</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {roomMessages.map((message) => (
          <div key={message.id} className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
              {message.sender.displayName?.[0] || message.sender.username[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline space-x-2">
                <span className="font-semibold text-white">
                  {message.sender.displayName || message.sender.username}
                </span>
                <span className="text-xs text-gray-500">
                  {format(new Date(message.createdAt), 'HH:mm')}
                </span>
              </div>
              <p className="text-gray-300 mt-1">{(message as any).decryptedContent}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
          />
          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
