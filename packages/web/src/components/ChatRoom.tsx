import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import RoomSettings from './RoomSettings';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ForwardMessageModal from './ForwardMessageModal';
import MessageSearch from './MessageSearch';
import EmojiPicker from './EmojiPicker';
import { Message } from '../types';

export default function ChatRoom() {
  const { currentRoom, messages, members, rooms, sendMessage, addReaction, removeReaction, editMessage, deleteMessage, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message & { decryptedContent?: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message & { decryptedContent?: string } | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message & { decryptedContent?: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const roomMessages = currentRoom ? messages.get(currentRoom.id) || [] : [];
  const roomMembers = currentRoom ? members.get(currentRoom.id) || [] : [];
  const currentRoomTypingUsers = currentRoom && typingUsers.has(currentRoom.id)
    ? Array.from(typingUsers.get(currentRoom.id)!.values()).filter(username => username !== user?.username)
    : [];

  const canManageRoom = currentRoom && (user?.id === currentRoom.creatorId || user?.isAdmin);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!currentRoom) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing start
    socketService.sendTyping(currentRoom.id, true);

    // Set timeout to send typing stop after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTyping(currentRoom.id, false);
    }, 3000);
  }, [currentRoom]);

  // Clear typing on component unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (currentRoom) {
        socketService.sendTyping(currentRoom.id, false);
      }
    };
  }, [currentRoom]);

  // Handle reply
  const handleReply = (message: Message) => {
    setReplyingTo(message as Message & { decryptedContent?: string });
    messageInputRef.current?.focus();
  };

  // Handle edit
  const handleEdit = (message: Message) => {
    setEditingMessage(message as Message & { decryptedContent?: string });
    setMessageInput((message as any).decryptedContent || '');
    messageInputRef.current?.focus();
  };

  // Handle delete
  const handleDelete = (messageId: string) => {
    if (currentRoom && window.confirm('Are you sure you want to delete this message?')) {
      deleteMessage(messageId, currentRoom.id);
    }
  };

  // Handle forward
  const handleForward = (message: Message) => {
    setForwardingMessage(message as Message & { decryptedContent?: string });
  };

  const handleForwardSubmit = (roomIds: string[]) => {
    if (!forwardingMessage) return;

    roomIds.forEach(roomId => {
      socketService.forwardMessage(forwardingMessage.id, [roomId]);
    });

    setForwardingMessage(null);

    // Show success message
    const roomCount = roomIds.length;
    alert(`Message forwarded to ${roomCount} room${roomCount !== 1 ? 's' : ''}`);
  };

  // Handle search message selection
  const handleSearchMessageSelect = (messageId: string) => {
    // Find the message element and scroll to it
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly
      messageElement.classList.add('ring-2', 'ring-purple-500');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-purple-500');
      }, 2000);
    }
  };

  // Handle reaction
  const handleReact = (messageId: string, emoji: string) => {
    if (currentRoom) {
      addReaction(messageId, currentRoom.id, emoji);
    }
  };

  // Handle remove reaction
  const handleRemoveReaction = (messageId: string, emoji: string) => {
    if (currentRoom) {
      removeReaction(messageId, currentRoom.id, emoji);
    }
  };

  // Handle emoji selection for message input
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // Check if user is at bottom of scroll
  const checkIfAtBottom = () => {
    const container = messageContainerRef.current;
    if (!container) return true;

    const threshold = 100; // pixels from bottom
    const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    return isBottom;
  };

  // Handle scroll event
  const handleScroll = () => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    if (atBottom) {
      setUnreadCount(0);
    }
  };

  // Auto-scroll to bottom only if user is at bottom
  useEffect(() => {
    const wasAtBottom = isAtBottom;

    if (wasAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    } else {
      // User is scrolled up, increment unread counter
      setUnreadCount(prev => prev + 1);
    }
  }, [roomMessages.length]);

  // Scroll to bottom when room changes
  useEffect(() => {
    if (currentRoom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setIsAtBottom(true);
      setUnreadCount(0);
    }
  }, [currentRoom?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    setIsAtBottom(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    handleTyping();
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && selectedFiles.length === 0) || !currentRoom) return;

    try {
      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketService.sendTyping(currentRoom.id, false);

      // Handle edit
      if (editingMessage) {
        await editMessage(editingMessage.id, currentRoom.id, messageInput);
        setMessageInput('');
        setEditingMessage(null);
        messageInputRef.current?.focus();
        return;
      }

      setUploadingFiles(true);

      // Upload files if any
      let attachments: string[] = [];
      if (selectedFiles.length > 0) {
        try {
          const uploadPromises = selectedFiles.map((file) => apiService.uploadFile(file));
          const uploadResults = await Promise.all(uploadPromises);
          attachments = uploadResults.map((result) => result.file.url);
        } catch (uploadError: any) {
          setUploadingFiles(false);
          const errorMsg = uploadError.response?.data?.error || 'Failed to upload file';
          alert(`Upload failed: ${errorMsg}`);
          return;
        }
      }

      // Send message with attachments and optional parent
      await sendMessage(
        currentRoom.id,
        messageInput || ' ',
        attachments.length > 0 ? attachments : undefined,
        replyingTo?.id
      );
      setMessageInput('');
      setSelectedFiles([]);
      setReplyingTo(null);
      setUploadingFiles(false);

      // Keep focus on input after sending
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 0);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
      setUploadingFiles(false);
    }
  };

  const getFilePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // Sanitize URLs to prevent XSS
  const sanitizeUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      // Only allow http, https, and blob URLs
      if (['http:', 'https:', 'blob:'].includes(parsedUrl.protocol)) {
        return url;
      }
    } catch {
      // Invalid URL
    }
    return '#';
  };

  // Extract YouTube video ID from URL
  const extractYouTubeId = (text: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Check if message contains YouTube URL
  const getYouTubePreview = (text: string) => {
    const videoId = extractYouTubeId(text);
    if (!videoId) return null;

    return {
      id: videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  };

  if (!currentRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-xl">Select a room to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900">
      {/* Room header - hidden on mobile, shown on desktop */}
      <div className="hidden md:flex flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-start justify-between w-full">
          <div>
            <h2 className="text-xl font-bold text-white">{currentRoom.name}</h2>
            {currentRoom.description && (
              <p className="text-sm text-gray-400">{currentRoom.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition whitespace-nowrap"
              title="Search messages"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {canManageRoom && (
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition whitespace-nowrap"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile room header with settings */}
      <div className="md:hidden flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex-1 min-w-0">
          {currentRoom.description && (
            <p className="text-xs text-gray-400 truncate">{currentRoom.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            title="Search messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          {canManageRoom && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messageContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 bg-gray-900 relative"
        style={{ minHeight: 0 }}
      >
        {roomMessages.map((message) => {
          const parentMessage = message.parentMessageId
            ? roomMessages.find(m => m.id === message.parentMessageId)
            : undefined;

          return (
            <div key={message.id} id={`message-${message.id}`} className="transition-all">
              <MessageBubble
                message={message as Message & { decryptedContent?: string }}
                currentUserId={user?.id || ''}
                parentMessage={parentMessage as Message & { decryptedContent?: string } | undefined}
                onReact={handleReact}
                onRemoveReaction={handleRemoveReaction}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onForward={handleForward}
                sanitizeUrl={sanitizeUrl}
                getYouTubePreview={getYouTubePreview}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />

        {/* Go to bottom button with unread counter */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-4 md:right-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg z-10 flex items-center justify-center transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Typing indicator */}
      {currentRoomTypingUsers.length > 0 && (
        <TypingIndicator typingUsers={currentRoomTypingUsers} />
      )}

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="flex-shrink-0 p-2 md:p-4 border-t border-gray-700 bg-gray-800">
        {/* Reply preview */}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-gray-700 rounded flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                <span className="text-sm font-semibold text-purple-400">
                  Replying to {replyingTo.sender.displayName || replyingTo.sender.username}
                </span>
              </div>
              <p className="text-sm text-gray-300 truncate">{replyingTo.decryptedContent}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Edit preview */}
        {editingMessage && (
          <div className="mb-2 px-3 py-2 bg-gray-700 rounded flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span className="text-sm font-semibold text-purple-400">Editing message</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setMessageInput('');
              }}
              className="ml-2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* File previews */}
        {selectedFiles.length > 0 && (
          <div className="mb-2 md:mb-3 flex flex-wrap gap-1.5 md:gap-2">
            {selectedFiles.map((file, index) => {
              const preview = getFilePreview(file);
              return (
                <div key={index} className="relative group">
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        alt={file.name}
                        className="w-16 h-16 md:w-24 md:h-24 object-cover rounded border border-gray-600"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-0.5 md:p-1 rounded-b">
                        <div className="truncate text-xs">{file.name}</div>
                        <div className="text-gray-300 text-xs">{formatFileSize(file.size)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 md:w-24 md:h-24 flex flex-col items-center justify-center bg-gray-700 rounded border border-gray-600 p-1 md:p-2">
                      <svg
                        className="w-6 h-6 md:w-8 md:h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-xs text-gray-400 mt-0.5 md:mt-1 truncate max-w-full text-center">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-6 md:h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs md:text-sm font-bold shadow-lg"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex space-x-1.5 md:space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 md:px-4 md:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition flex-shrink-0"
            title="Attach file"
          >
            <svg
              className="w-5 h-5 md:w-5 md:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 md:px-4 md:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition flex-shrink-0"
              title="Insert emoji"
            >
              <svg
                className="w-5 h-5 md:w-5 md:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 right-0 z-50">
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={handleMessageInputChange}
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            disabled={uploadingFiles}
            className="flex-1 px-3 py-2 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white disabled:opacity-50 text-sm md:text-base min-w-0"
          />
          <button
            type="submit"
            disabled={(!messageInput.trim() && selectedFiles.length === 0) || uploadingFiles}
            className="px-3 py-2 md:px-6 md:py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded transition text-sm md:text-base flex-shrink-0"
          >
            {uploadingFiles ? (
              <span className="hidden md:inline">Uploading...</span>
            ) : (
              <span className="hidden md:inline">Send</span>
            )}
            {/* Mobile: Show icon */}
            <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>

      {/* Room Settings Modal */}
      {showSettings && currentRoom && (
        <RoomSettings
          room={currentRoom}
          members={roomMembers}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Forward Message Modal */}
      {forwardingMessage && currentRoom && (
        <ForwardMessageModal
          message={forwardingMessage}
          rooms={rooms}
          currentRoomId={currentRoom.id}
          onForward={handleForwardSubmit}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {/* Message Search Modal */}
      {showSearch && currentRoom && (
        <MessageSearch
          roomId={currentRoom.id}
          roomKey={currentRoom.encryptionKey || ''}
          onClose={() => setShowSearch(false)}
          onSelectMessage={handleSearchMessageSelect}
        />
      )}
    </div>
  );
}
