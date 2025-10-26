import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';
import { format } from 'date-fns';
import RoomSettings from './RoomSettings';

export default function ChatRoom() {
  const { currentRoom, messages, members, sendMessage } = useChatStore();
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const roomMessages = currentRoom ? messages.get(currentRoom.id) || [] : [];
  const roomMembers = currentRoom ? members.get(currentRoom.id) || [] : [];

  const canManageRoom = currentRoom && (user?.id === currentRoom.creatorId || user?.isAdmin);

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

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && selectedFiles.length === 0) || !currentRoom) return;

    try {
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

      // Send message with attachments
      await sendMessage(currentRoom.id, messageInput || ' ', attachments.length > 0 ? attachments : undefined);
      setMessageInput('');
      setSelectedFiles([]);
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

      {/* Mobile room header with settings */}
      <div className="md:hidden flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex-1 min-w-0">
          {currentRoom.description && (
            <p className="text-xs text-gray-400 truncate">{currentRoom.description}</p>
          )}
        </div>
        {canManageRoom && (
          <button
            onClick={() => setShowSettings(true)}
            className="ml-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messageContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 bg-gray-900 relative"
        style={{ minHeight: 0 }}
      >
        {roomMessages.map((message) => (
          <div key={message.id} className="flex items-start space-x-2 md:space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm md:text-base">
              {message.sender.displayName?.[0] || message.sender.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline space-x-2">
                <span className="font-semibold text-white text-sm md:text-base truncate">
                  {message.sender.displayName || message.sender.username}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {format(new Date(message.createdAt), 'HH:mm')}
                </span>
              </div>
              <p className="text-gray-300 mt-1 break-words">{(message as any).decryptedContent}</p>

              {/* YouTube Preview */}
              {(() => {
                const youtubePreview = getYouTubePreview((message as any).decryptedContent || '');
                if (youtubePreview) {
                  return (
                    <a
                      href={youtubePreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block max-w-sm rounded-lg overflow-hidden bg-gray-800 border border-gray-600 hover:border-purple-500 transition"
                    >
                      <div className="relative">
                        <img
                          src={youtubePreview.thumbnail}
                          alt="YouTube video"
                          className="w-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-red-600 bg-opacity-90 rounded-full p-3">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 bg-gray-800">
                        <p className="text-sm text-gray-300 flex items-center">
                          <svg className="w-4 h-4 mr-1 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          YouTube Video
                        </p>
                      </div>
                    </a>
                  );
                }
                return null;
              })()}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, idx) => {
                    const isImage = attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    const isVideo = attachment.match(/\.(mp4|webm|ogg)$/i);
                    const fileName = attachment.split('/').pop() || 'file';

                    const safeUrl = sanitizeUrl(attachment);

                    if (isImage) {
                      return (
                        <div key={idx}>
                          <img
                            src={safeUrl}
                            alt="Attachment"
                            className="max-w-sm rounded border border-gray-600 cursor-pointer hover:opacity-90"
                            onClick={() => window.open(safeUrl, '_blank', 'noopener,noreferrer')}
                          />
                        </div>
                      );
                    } else if (isVideo) {
                      return (
                        <div key={idx}>
                          <video
                            src={safeUrl}
                            controls
                            className="max-w-sm rounded border border-gray-600"
                          />
                        </div>
                      );
                    } else {
                      return (
                        <a
                          key={idx}
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 transition max-w-sm"
                        >
                          <svg
                            className="w-5 h-5 text-gray-400"
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
                          <span className="text-sm text-white truncate">{fileName}</span>
                        </a>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
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

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="flex-shrink-0 p-2 md:p-4 border-t border-gray-700 bg-gray-800">
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
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
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
    </div>
  );
}
