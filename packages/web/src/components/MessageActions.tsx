import { useState, useRef, useEffect } from 'react';
import { Message } from '../types';

interface MessageActionsProps {
  message: Message & { decryptedContent?: string; isEdited?: boolean; isDeleted?: boolean };
  currentUserId: string;
  onReact: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onForward: () => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

export default function MessageActions({
  message,
  currentUserId,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onForward,
  onClose,
  position,
}: MessageActionsProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState(position || { x: 0, y: 0 });

  const isOwnMessage = message.sender.id === currentUserId;
  const messageAge = new Date().getTime() - new Date(message.createdAt).getTime();
  const twentyMinutes = 20 * 60 * 1000;
  const canEdit = isOwnMessage && messageAge < twentyMinutes && !message.isDeleted;
  const canDelete = isOwnMessage && !message.isDeleted;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    // Adjust menu position to keep it on screen
    if (menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      setMenuPosition({ x: adjustedX, y: adjustedY });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, position]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuStyle = position
    ? {
        position: 'fixed' as const,
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }
    : {};

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px] ${
        !position ? 'absolute right-0 top-8' : ''
      }`}
    >
      <button
        onClick={() => handleAction(onReact)}
        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition flex items-center space-x-2"
      >
        <span>😀</span>
        <span>React</span>
      </button>

      <button
        onClick={() => handleAction(onReply)}
        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
        <span>Reply</span>
      </button>

      {canEdit && (
        <button
          onClick={() => handleAction(onEdit)}
          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span>Edit</span>
        </button>
      )}

      {canDelete && (
        <button
          onClick={() => handleAction(onDelete)}
          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span>Delete</span>
        </button>
      )}

      <div className="border-t border-gray-700 my-1"></div>

      <button
        onClick={() => handleAction(onForward)}
        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
        <span>Forward</span>
      </button>

      <button
        onClick={() => handleAction(onCopy)}
        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span>Copy Text</span>
      </button>
    </div>
  );
}
