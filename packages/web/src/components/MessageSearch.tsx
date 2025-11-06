import { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { apiService } from '../services/api';
import { cryptoService } from '../services/crypto';
import { format } from 'date-fns';

interface MessageSearchProps {
  roomId: string;
  roomKey: string;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

export default function MessageSearch({ roomId, roomKey, onClose, onSelectMessage }: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Message & { decryptedContent?: string })[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { messages } = await apiService.searchRoomMessages(roomId, query.trim());

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          try {
            const decryptedContent = await cryptoService.decryptRoomMessage(msg.encryptedContent, roomKey);
            return { ...msg, decryptedContent };
          } catch {
            return { ...msg, decryptedContent: '[Decryption failed]' };
          }
        })
      );

      // Filter results to only show messages that match the query in decrypted content
      const filteredResults = decryptedMessages.filter(msg =>
        msg.decryptedContent?.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(filteredResults);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      performSearch(query);
    }, 500);
  };

  const handleSelectMessage = (messageId: string) => {
    onSelectMessage(messageId);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-gray-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg">Search Messages</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500 text-white"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">Searching...</div>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : searchQuery.trim() === '' ? (
            <div className="text-center text-gray-400 py-8">
              Type to search messages
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No messages found
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message.id)}
                  className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded text-left transition"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {message.sender.displayName?.[0] || message.sender.username[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          {message.sender.displayName || message.sender.username}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(message.createdAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {message.decryptedContent}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-sm text-gray-400">
          {searchResults.length > 0 && (
            <div>
              Found {searchResults.length} message{searchResults.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
