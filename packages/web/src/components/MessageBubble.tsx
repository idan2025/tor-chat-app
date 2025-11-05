import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Message, MessageReactions } from '../types';
import MessageActions from './MessageActions';
import EmojiPicker from './EmojiPicker';

interface MessageBubbleProps {
  message: Message & { decryptedContent?: string };
  currentUserId: string;
  parentMessage?: Message & { decryptedContent?: string };
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onForward: (message: Message) => void;
  sanitizeUrl?: (url: string) => string;
  getYouTubePreview?: (text: string) => { id: string; thumbnail: string; url: string } | null;
}

export default function MessageBubble({
  message,
  currentUserId,
  parentMessage,
  onReact,
  onRemoveReaction,
  onReply,
  onEdit,
  onDelete,
  onForward,
  sanitizeUrl,
  getYouTubePreview,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [actionsPosition, setActionsPosition] = useState<{ x: number; y: number } | undefined>();
  const messageRef = useRef<HTMLDivElement>(null);

  const reactions = (message.metadata as any)?.reactions as MessageReactions | undefined;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setActionsPosition({ x: e.clientX, y: e.clientY });
    setShowActions(true);
  };

  const handleActionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActionsPosition({ x: rect.left, y: rect.bottom + 5 });
    setShowActions(true);
  };

  const handleReactionClick = (emoji: string) => {
    const userReacted = reactions?.[emoji]?.includes(currentUserId);
    if (userReacted) {
      onRemoveReaction(message.id, emoji);
    } else {
      onReact(message.id, emoji);
    }
  };

  const handleCopyText = () => {
    if (message.decryptedContent) {
      navigator.clipboard.writeText(message.decryptedContent);
    }
  };

  const handleReactFromMenu = () => {
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    onReact(message.id, emoji);
  };

  const youtubePreview = getYouTubePreview && message.decryptedContent
    ? getYouTubePreview(message.decryptedContent)
    : null;

  if (message.isDeleted) {
    return (
      <div className="flex items-start space-x-2 md:space-x-3 opacity-50">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm md:text-base">
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
          <p className="text-gray-500 mt-1 italic text-sm">Message deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      className="flex items-start space-x-2 md:space-x-3 group relative"
      onContextMenu={handleContextMenu}
    >
      {/* Avatar */}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm md:text-base">
        {message.sender.displayName?.[0] || message.sender.username[0]}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-white text-sm md:text-base truncate">
            {message.sender.displayName || message.sender.username}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {message.isEdited && (
            <span className="text-xs text-gray-500 italic">(edited)</span>
          )}
        </div>

        {/* Reply preview */}
        {parentMessage && (
          <div className="mt-1 mb-1 pl-2 border-l-2 border-gray-600 text-xs text-gray-400">
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              <span className="font-semibold">
                {parentMessage.sender.displayName || parentMessage.sender.username}
              </span>
            </div>
            <p className="truncate">{parentMessage.decryptedContent}</p>
          </div>
        )}

        {/* Message content */}
        <p className="text-gray-300 mt-1 break-words">{message.decryptedContent}</p>

        {/* YouTube Preview */}
        {youtubePreview && (
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
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment, idx) => {
              const isImage = attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isVideo = attachment.match(/\.(mp4|webm|ogg)$/i);
              const fileName = attachment.split('/').pop() || 'file';
              const safeUrl = sanitizeUrl ? sanitizeUrl(attachment) : attachment;

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

        {/* Reactions */}
        {reactions && Object.keys(reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(reactions).map(([emoji, userIds]) => {
              const userReacted = userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition ${
                    userReacted
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-xs">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions button (shown on hover or mobile) */}
      <button
        onClick={handleActionsClick}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-700 transition opacity-0 group-hover:opacity-100 md:opacity-100"
      >
        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {/* Actions menu */}
      {showActions && (
        <MessageActions
          message={message}
          currentUserId={currentUserId}
          onReact={handleReactFromMenu}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onDelete={() => onDelete(message.id)}
          onForward={() => onForward(message)}
          onCopy={handleCopyText}
          onClose={() => setShowActions(false)}
          position={actionsPosition}
        />
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}
